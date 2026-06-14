##
# @file    main.py
# @brief   Brantz Rallymeter emulator for the VBOX Motorsport Touch
#
# Recreates the core functions of two Brantz rally instruments on a VBOX Touch:
#   * Brantz International Tripmeter  - total/intermediate distance, calibration,
#     zero, freeze, count up/down, manual edit, km/mile.
#   * Brantz Timer V2 (BR32V2)        - real-time clock (24/12/10hr/100th) and a
#     stopwatch with 4 modes (Standard, Regularity, Jogularity, Std-Cumulative),
#     auto-start, brightness, Start/Stop LED states.
#
# Uses only API demonstrated by the official VBOX Touch python examples:
#   gui, vts, gnss, vbox, digitalio, os, math.
#
# Deploy: copy this file as main.py to the root of the SD card, insert, power on.
#

import gui
import vts
import gnss
import vbox
import digitalio

# --- Constants --------------------------------------------------------------
SCREEN_W = 800
SCREEN_H = 480
TZ_OFFSET_H = 0                 # UTC -> local hours, GNSS time is UTC
CFG_PATH = '/sd/brantz.cfg'
HOLD_MS = 32000                 # Brantz regularity/jogularity 32 s hold
M_PER_MILE = 1609.344

MODE_NAMES = ['Standard', 'Regularity', 'Jogularity', 'Std-Cumul']
CLOCKFMT_NAMES = ['24Hr', '12Hr', '10Hr', '100th']
SWFMT_NAMES = ['MM:SS', 'Sec']
BRIGHT_NAMES = ['Lo', 'Med', 'Hi', 'Off']
BRIGHT_FG = [90, 170, 255]      # foreground intensity for Lo/Med/Hi
BG = gui.RGB(0, 28, 48)

GREEN = (0, 70, 0)
RED = (70, 0, 0)


# --- State ------------------------------------------------------------------
class S:
    page = 0                    # 0 trip, 1 timer, 2 config
    last_ms = 0

    # Tripmeter
    units = 'km'
    cal = 1.000
    total_m = 0.0
    inter_m = 0.0
    freeze = False
    direction = 1               # +1 count up, -1 count down

    # Timer / clock
    clock_fmt = 0
    sw_fmt = 0
    brightness = 2
    prev_brightness = 2
    autostart_en = False
    autostart_hms = (0, 0, 0)
    autostart_fired = False

    # Stopwatch
    mode = 0
    sw_started = False
    sw_running = False
    sw_accum_ms = 0
    sw_t0 = 0
    sw_total_start = None
    sw_section_start = 0
    sw_hold_until = 0
    sw_frozen_ms = 0

    # Physical inputs (active low) - in0 = Remote/Start-Stop, in1 = Reset
    last_in0 = True
    last_in1 = True

    # GPS lock + periodic UI timer
    gps_locked = False
    timer = None


# --- Live display values (mutable 1-element lists bound into the GUI) -------
clock_disp = ['--:--:--']
sw_disp = ['0:00.0']
mode_disp = [MODE_NAMES[0]]
total_disp = ['000.00']
inter_disp = ['00.00']
spd_disp = ['0.0']
cal_disp = ['1.000']
units_disp = ['km']
bright_disp = ['Hi']
clkfmt_disp = ['24Hr']
swfmt_disp = ['MM:SS']
autostart_disp = ['OFF 00:00:00']
clock_secs = [0]
gps_disp = ['GPS: no fix']

clock = vts.Chrono()


def now_ms():
    return clock.read() // 1000


# --- Colours / brightness ---------------------------------------------------
def fg_rgb():
    return (BRIGHT_FG[S.brightness], BRIGHT_FG[S.brightness], BRIGHT_FG[S.brightness])


# --- LEDs -------------------------------------------------------------------
def set_leds(rgb):
    vts.leds(*list(rgb) * 4)


# --- Persistence ------------------------------------------------------------
def save_cfg(*_):
    if not vts.sd_present():
        return False
    try:
        with open(CFG_PATH, 'w') as f:
            f.write('units={}\n'.format(S.units))
            f.write('cal={:.3f}\n'.format(S.cal))
            f.write('clock_fmt={}\n'.format(S.clock_fmt))
            f.write('sw_fmt={}\n'.format(S.sw_fmt))
            f.write('mode={}\n'.format(S.mode))
            f.write('brightness={}\n'.format(S.brightness))
            f.write('autostart_en={}\n'.format(1 if S.autostart_en else 0))
            f.write('autostart={},{},{}\n'.format(*S.autostart_hms))
        return True
    except Exception as e:
        print('save_cfg failed:', e)
        return False


def load_cfg():
    if not vts.sd_present():
        return
    try:
        with open(CFG_PATH, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                if k == 'units':
                    S.units = v
                elif k == 'cal':
                    S.cal = float(v)
                elif k == 'clock_fmt':
                    S.clock_fmt = int(v)
                elif k == 'sw_fmt':
                    S.sw_fmt = int(v)
                elif k == 'mode':
                    S.mode = int(v)
                elif k == 'brightness':
                    S.brightness = int(v) % 4
                elif k == 'autostart_en':
                    S.autostart_en = (v == '1')
                elif k == 'autostart':
                    p = v.split(',')
                    S.autostart_hms = (int(p[0]), int(p[1]), int(p[2]))
    except Exception as e:
        print('load_cfg failed:', e)


# --- Tripmeter --------------------------------------------------------------
def integrate(dt, v):
    if dt <= 0 or dt > 1.0:
        return
    if v < 0:
        v = 0.0
    d = v * dt * S.cal * S.direction
    S.inter_m += d
    if not S.freeze:
        S.total_m += d


def dist_in_units(m):
    return m / 1000.0 if S.units == 'km' else m / M_PER_MILE


def fmt_dist(m, pad):
    return '{:{p}.2f}'.format(dist_in_units(m), p=pad)


# --- Clock ------------------------------------------------------------------
def fmt_clock():
    h = (gnss.h() + TZ_OFFSET_H) % 24
    m = gnss.m()
    s = gnss.s()
    c = gnss.cs()
    f = S.clock_fmt
    if f == 0:
        return '{:02d}:{:02d}:{:02d}'.format(h, m, s)
    if f == 1:
        ap = 'AM' if h < 12 else 'PM'
        hh = h % 12
        hh = 12 if hh == 0 else hh
        return '{:2d}:{:02d}:{:02d} {}'.format(hh, m, s, ap)
    if f == 2:
        sod = h * 3600 + m * 60 + s + c / 100.0
        dd = sod / 86400.0
        return '{:d}:{:02d}:{:02d}'.format(
            int(dd * 10) % 10, int(dd * 1000) % 100, int(dd * 100000) % 100)
    cc = int(((s + c / 100.0) / 60.0) * 100) % 100
    return '{:02d}:{:02d}.{:02d}'.format(h, m, cc)


# --- Stopwatch --------------------------------------------------------------
def sw_is_started():
    return S.sw_started if S.mode == 0 else (S.sw_total_start is not None)


def sw_value(now):
    m = S.mode
    held = S.sw_hold_until > now
    if m == 0:
        if not S.sw_started:
            return 0, False
        base = S.sw_accum_ms + ((now - S.sw_t0) if S.sw_running else 0)
        return base, S.sw_running
    if S.sw_total_start is None:
        return 0, False
    if held:
        return S.sw_frozen_ms, False
    if m == 1:
        return now - S.sw_section_start, True
    return now - S.sw_total_start, True


def sw_press(*_):
    now = now_ms()
    m = S.mode
    if m == 0:
        if not S.sw_started:
            S.sw_started = True
            S.sw_running = True
            S.sw_t0 = now
            S.sw_accum_ms = 0
        elif S.sw_running:
            S.sw_accum_ms += now - S.sw_t0
            S.sw_running = False
        else:
            S.sw_t0 = now
            S.sw_running = True
    elif m == 3:
        if S.sw_total_start is None:
            S.sw_total_start = now
            S.sw_hold_until = 0
        elif S.sw_hold_until > now:
            S.sw_hold_until = 0
        else:
            S.sw_frozen_ms = now - S.sw_total_start
            S.sw_hold_until = now + 10 ** 9
    else:
        if S.sw_total_start is None:
            S.sw_total_start = now
            S.sw_section_start = now
            S.sw_hold_until = 0
        else:
            if m == 1:
                S.sw_frozen_ms = now - S.sw_section_start
                S.sw_section_start = now
            else:
                S.sw_frozen_ms = now - S.sw_total_start
            S.sw_hold_until = now + HOLD_MS


def sw_reset(*_):
    S.sw_started = False
    S.sw_running = False
    S.sw_accum_ms = 0
    S.sw_t0 = 0
    S.sw_total_start = None
    S.sw_section_start = 0
    S.sw_hold_until = 0
    S.sw_frozen_ms = 0


def fmt_sw(ms):
    if S.sw_fmt == 1:
        return '{:.1f}'.format(ms / 1000.0)
    total_s = ms // 1000
    return '{:d}:{:02d}.{:1d}'.format(total_s // 60, total_s % 60, (ms % 1000) // 100)


def update_leds(now, state):
    if state == 'run':
        set_leds(GREEN)
    elif state == 'stopped':
        set_leds(RED)
    else:
        set_leds(GREEN if (now // 300) % 2 else RED)


# --- Periodic UI tick (10 Hz, runs with or without a GPS fix) ---------------
def ui_tick():
    now = now_ms()
    dt = (now - S.last_ms) / 1000.0
    S.last_ms = now

    # GPS lock status
    try:
        q = gnss.quality()
        n = gnss.sat_count()
    except Exception:
        q, n = 0, 0
    locked = q > 0
    if locked:
        gps_disp[0] = 'GPS LOCK: {} sat (fix {})'.format(n, q)
    else:
        gps_disp[0] = 'GPS: searching... ({} sat)'.format(n)
    if locked != S.gps_locked:
        S.gps_locked = locked
        draw()

    speed = 0.0
    try:
        speed = vbox.get_sample().speed_gnd_mps
    except Exception:
        speed = 0.0
    integrate(dt, speed)

    spd_disp[0] = '{:.1f}'.format(speed * (3.6 if S.units == 'km' else 2.23694))
    total_disp[0] = fmt_dist(S.total_m, '06')
    inter_disp[0] = fmt_dist(S.inter_m, '05')
    if locked:
        clock_disp[0] = fmt_clock()
        clock_secs[0] = ((gnss.h() + TZ_OFFSET_H) % 24) * 3600 + gnss.m() * 60 + gnss.s()
    else:
        clock_disp[0] = '--:--:--'

    # Auto-start (needs a valid GNSS time)
    if locked and S.autostart_en and not sw_is_started():
        if (gnss.h(), gnss.m(), gnss.s()) == S.autostart_hms:
            if not S.autostart_fired:
                S.autostart_fired = True
                sw_press()
        else:
            S.autostart_fired = False

    val, counting = sw_value(now)
    sw_disp[0] = fmt_sw(val)
    if not sw_is_started():
        update_leds(now, 'stopped')
    elif counting:
        update_leds(now, 'run')
    else:
        update_leds(now, 'hold')

    # Physical Remote / Reset buttons (active low -> falling edge = press)
    try:
        in0, in1 = digitalio.get()
        if S.last_in0 and not in0:
            sw_press()
        if S.last_in1 and not in1:
            sw_reset()
        S.last_in0, S.last_in1 = in0, in1
    except Exception:
        pass

    gui.redraw()


# --- Button callbacks -------------------------------------------------------
def set_page(p):
    S.page = p
    draw()


def tab_trip(b):
    set_page(0)


def tab_timer(b):
    set_page(1)


def tab_cfg(b):
    set_page(2)


def zero_int(b):
    S.inter_m = 0.0


def zero_total(b):
    S.total_m = 0.0


def toggle_freeze(b):
    S.freeze = not S.freeze
    draw()


def toggle_dir(b):
    S.direction = -S.direction
    draw()


def edit_minus(b):
    step = 0.01 * (1000.0 if S.units == 'km' else M_PER_MILE)
    S.total_m -= step


def edit_plus(b):
    step = 0.01 * (1000.0 if S.units == 'km' else M_PER_MILE)
    S.total_m += step


def toggle_units(b):
    S.units = 'mi' if S.units == 'km' else 'km'
    units_disp[0] = S.units
    save_cfg()
    draw()


def cal_minus(b):
    S.cal = max(0.500, round(S.cal - 0.001, 3))
    cal_disp[0] = '{:.3f}'.format(S.cal)
    save_cfg()


def cal_plus(b):
    S.cal = min(2.000, round(S.cal + 0.001, 3))
    cal_disp[0] = '{:.3f}'.format(S.cal)
    save_cfg()


def cycle_mode(b):
    sw_reset()
    S.mode = (S.mode + 1) % 4
    mode_disp[0] = MODE_NAMES[S.mode]
    save_cfg()
    draw()


def cycle_clkfmt(b):
    S.clock_fmt = (S.clock_fmt + 1) % 4
    clkfmt_disp[0] = CLOCKFMT_NAMES[S.clock_fmt]
    save_cfg()
    draw()


def cycle_swfmt(b):
    S.sw_fmt = (S.sw_fmt + 1) % 2
    swfmt_disp[0] = SWFMT_NAMES[S.sw_fmt]
    save_cfg()
    draw()


def cycle_bright(b):
    if S.brightness != 3:
        S.prev_brightness = S.brightness
    S.brightness = (S.brightness + 1) % 4
    bright_disp[0] = BRIGHT_NAMES[S.brightness]
    save_cfg()
    draw()


def restore_bright(b):
    S.brightness = S.prev_brightness if S.prev_brightness != 3 else 2
    bright_disp[0] = BRIGHT_NAMES[S.brightness]
    save_cfg()
    draw()


def sync_autostart_disp():
    autostart_disp[0] = '{} {:02d}:{:02d}:{:02d}'.format(
        'ON' if S.autostart_en else 'OFF', *S.autostart_hms)


def toggle_autostart(b):
    S.autostart_en = not S.autostart_en
    S.autostart_fired = False
    sync_autostart_disp()
    save_cfg()
    draw()


def _bump_autostart(idx, step):
    h, m, s = S.autostart_hms
    v = [h, m, s]
    cap = [24, 60, 60]
    v[idx] = (v[idx] + step) % cap[idx]
    S.autostart_hms = (v[0], v[1], v[2])
    sync_autostart_disp()
    save_cfg()


def autostart_h(b):
    _bump_autostart(0, 1)


def autostart_m(b):
    _bump_autostart(1, 1)


def autostart_s(b):
    _bump_autostart(2, 1)


def factory_reset(b):
    S.units = 'km'
    S.cal = 1.000
    S.clock_fmt = 0
    S.sw_fmt = 0
    S.mode = 0
    S.brightness = 2
    S.autostart_en = False
    S.autostart_hms = (0, 0, 0)
    S.total_m = 0.0
    S.inter_m = 0.0
    sw_reset()
    sync_disp()
    save_cfg()
    draw()


# --- GUI assembly -----------------------------------------------------------
def vsync_cb(l):
    gui.redraw()


def swipe_cb(gui_list, start):
    if start:
        return
    si = gui.swipe_info()
    if si.dx <= -50:
        S.page = (S.page + 1) % 3
        draw()
    elif si.dx >= 50:
        S.page = (S.page - 1) % 3
        draw()


def header():
    title = ['TRIPMETER', 'RALLY TIMER', 'CONFIGURATION'][S.page]
    dot = GREEN if S.gps_locked else RED
    return [
        [gui.EVT_VSYNC, vsync_cb],
        [gui.EVT_SWIPE, 50, swipe_cb],
        [gui.PARAM_CLRCOLOR, BG],
        [gui.DL_COLOR_RGB(*fg_rgb())],
        [gui.CTRL_TEXT, 12, 8, 29, 0, title],
        # GPS lock indicator: coloured dot + live status text
        [gui.DL_COLOR_RGB(dot[0] * 3, dot[1] * 3, dot[2] * 3)],
        [gui.PRIM_RECTS, [gui.DL_VERTEX2F(14, 46), gui.DL_VERTEX2F(30, 62)]],
        [gui.DL_COLOR_RGB(*fg_rgb())],
        [gui.CTRL_TEXT, 40, 44, 22, 0, gps_disp],
        # Page tabs
        [gui.CTRL_BUTTON, 545, 6, 78, 40, 28, 'TRIP', tab_trip],
        [gui.CTRL_BUTTON, 629, 6, 86, 40, 28, 'TIMER', tab_timer],
        [gui.CTRL_BUTTON, 721, 6, 68, 40, 28, 'CFG', tab_cfg],
    ]


def page_trip():
    fg = fg_rgb()
    freeze_lbl = 'Unfreeze' if S.freeze else 'Freeze'
    dir_lbl = 'Count -' if S.direction < 0 else 'Count +'
    return [
        [gui.DL_COLOR_RGB(*fg)],
        [gui.CTRL_TEXT, 400, 80, 28, gui.OPT_CENTER, 'TOTAL ({})'.format(S.units)],
        [gui.CTRL_TEXT, 400, 134, 31, gui.OPT_CENTER, total_disp],
        [gui.CTRL_TEXT, 400, 208, 26, gui.OPT_CENTER, 'INTERMEDIATE'],
        [gui.CTRL_TEXT, 400, 246, 30, gui.OPT_CENTER, inter_disp],
        [gui.CTRL_TEXT, 20, 306, 26, 0, 'Speed:'],
        [gui.CTRL_TEXT, 150, 306, 26, 0, spd_disp],
        [gui.CTRL_TEXT, 560, 306, 26, 0, 'Cal:'],
        [gui.CTRL_TEXT, 640, 306, 26, 0, cal_disp],
        [gui.CTRL_BUTTON, 15, 356, 185, 52, 28, 'Zero Int', zero_int],
        [gui.CTRL_BUTTON, 205, 356, 185, 52, 28, 'Zero Tot', zero_total],
        [gui.CTRL_BUTTON, 395, 356, 185, 52, 28, freeze_lbl, toggle_freeze],
        [gui.CTRL_BUTTON, 585, 356, 185, 52, 28, dir_lbl, toggle_dir],
        [gui.CTRL_BUTTON, 15, 416, 148, 52, 28, 'Edit -', edit_minus],
        [gui.CTRL_BUTTON, 167, 416, 148, 52, 28, 'Edit +', edit_plus],
        [gui.CTRL_BUTTON, 319, 416, 148, 52, 28, 'Units', toggle_units],
        [gui.CTRL_BUTTON, 471, 416, 148, 52, 28, 'Cal -', cal_minus],
        [gui.CTRL_BUTTON, 623, 416, 148, 52, 28, 'Cal +', cal_plus],
    ]


def page_timer():
    fg = fg_rgb()
    return [
        [gui.DL_COLOR_RGB(*fg)],
        [gui.CTRL_TEXT, 250, 88, 31, gui.OPT_CENTER, clock_disp],
        [gui.CTRL_TEXT, 250, 128, 24, gui.OPT_CENTER, 'TIME OF DAY'],
        [gui.CTRL_CLOCK, 690, 122, 62, True, True, True, clock_secs],
        [gui.CTRL_TEXT, 250, 176, 26, gui.OPT_CENTER, mode_disp],
        [gui.CTRL_TEXT, 250, 244, 31, gui.OPT_CENTER, sw_disp],
        [gui.CTRL_TEXT, 250, 298, 24, gui.OPT_CENTER, 'STOPWATCH'],
        [gui.CTRL_BUTTON, 15, 356, 150, 52, 28, 'Start/Stop', sw_press],
        [gui.CTRL_BUTTON, 167, 356, 150, 52, 28, 'Reset', sw_reset],
        [gui.CTRL_BUTTON, 319, 356, 150, 52, 28, 'Mode', cycle_mode],
        [gui.CTRL_BUTTON, 471, 356, 150, 52, 28, 'Clk Fmt', cycle_clkfmt],
        [gui.CTRL_BUTTON, 623, 356, 150, 52, 28, 'SW Fmt', cycle_swfmt],
        [gui.CTRL_BUTTON, 15, 416, 185, 52, 28, 'Bright', cycle_bright],
        [gui.CTRL_TEXT, 215, 432, 26, 0, bright_disp],
    ]


def page_cfg():
    fg = fg_rgb()
    return [
        [gui.DL_COLOR_RGB(*fg)],
        [gui.CTRL_TEXT, 20, 70, 26, 0, 'Units:'],
        [gui.CTRL_TEXT, 260, 70, 26, 0, units_disp],
        [gui.CTRL_TEXT, 20, 105, 26, 0, 'Calibration:'],
        [gui.CTRL_TEXT, 260, 105, 26, 0, cal_disp],
        [gui.CTRL_TEXT, 20, 140, 26, 0, 'Clock format:'],
        [gui.CTRL_TEXT, 260, 140, 26, 0, clkfmt_disp],
        [gui.CTRL_TEXT, 20, 175, 26, 0, 'Stopwatch format:'],
        [gui.CTRL_TEXT, 260, 175, 26, 0, swfmt_disp],
        [gui.CTRL_TEXT, 20, 210, 26, 0, 'Stopwatch mode:'],
        [gui.CTRL_TEXT, 260, 210, 26, 0, mode_disp],
        [gui.CTRL_TEXT, 20, 245, 26, 0, 'Brightness:'],
        [gui.CTRL_TEXT, 260, 245, 26, 0, bright_disp],
        [gui.CTRL_TEXT, 20, 280, 26, 0, 'Auto-start:'],
        [gui.CTRL_TEXT, 260, 280, 26, 0, autostart_disp],
        [gui.CTRL_BUTTON, 430, 66, 150, 50, 28, 'Auto On/Off', toggle_autostart],
        [gui.CTRL_BUTTON, 590, 66, 60, 50, 28, '+H', autostart_h],
        [gui.CTRL_BUTTON, 656, 66, 60, 50, 28, '+M', autostart_m],
        [gui.CTRL_BUTTON, 722, 66, 60, 50, 28, '+S', autostart_s],
        [gui.CTRL_BUTTON, 15, 416, 200, 52, 28, 'Save to SD', save_cfg],
        [gui.CTRL_BUTTON, 227, 416, 230, 52, 28, 'Factory Reset', factory_reset],
    ]


def draw():
    if S.brightness == 3:
        gui.show([
            [gui.PARAM_CLRCOLOR, gui.RGB(0, 0, 0)],
            [gui.DL_COLOR_RGB(40, 40, 40)],
            [gui.CTRL_TEXT, 400, 220, 28, gui.OPT_CENTER, 'DISPLAY OFF'],
            [gui.CTRL_BUTTON, 300, 280, 200, 50, 26, 'Tap to restore', restore_bright],
        ])
        return
    gui_l = header()
    gui_l.extend([page_trip, page_timer, page_cfg][S.page]())
    gui.show(gui_l)


def sync_disp():
    units_disp[0] = S.units
    cal_disp[0] = '{:.3f}'.format(S.cal)
    clkfmt_disp[0] = CLOCKFMT_NAMES[S.clock_fmt]
    swfmt_disp[0] = SWFMT_NAMES[S.sw_fmt]
    mode_disp[0] = MODE_NAMES[S.mode]
    bright_disp[0] = BRIGHT_NAMES[S.brightness]
    sync_autostart_disp()


# --- Main -------------------------------------------------------------------
def main():
    clock.start()
    S.last_ms = now_ms()
    load_cfg()
    sync_disp()

    waited = 0
    while gnss.init_status() > 0 and waited < 5000:
        vts.delay_ms(100)
        waited += 100

    try:
        vbox.init(vbox.VBOX_SRC_GNSS_BASIC)
    except Exception as e:
        print('vbox init failed:', e)

    vts.Timer.destroy_all()
    S.timer = vts.Timer(100, True)
    S.timer.set_callback(ui_tick)

    draw()


if __name__ == '__main__':
    main()
