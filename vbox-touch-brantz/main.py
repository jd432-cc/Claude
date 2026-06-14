##
# @file    main.py
# @brief   Rally Computer for the VBOX Motorsport Touch
#
# A combined rally instrument inspired by two Brantz devices, on a VBOX Touch:
#   * Time of day (from GPS) in 24/12/10hr/100th formats
#   * Stopwatch with 4 modes (Standard, Regularity, Jogularity, Std-Cumulative)
#   * Distance travelled (integrated from GPS ground speed)
#
# MAIN screen shows everything with minimal controls; CFG holds the settings.
# Uses only API demonstrated by the official VBOX Touch python examples:
#   gui, vts, gnss, vbox, digitalio.
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
TZ_OFFSET_H = 0                 # UTC -> local hours (GPS time is UTC)
CFG_PATH = '/sd/brantz.cfg'
HOLD_MS = 32000                 # regularity / jogularity 32 s hold
M_PER_MILE = 1609.344

MODE_NAMES = ['Standard', 'Regularity', 'Jogularity', 'Std-Cumul']
CLOCKFMT_NAMES = ['24Hr', '12Hr', '10Hr', '100th']
SWFMT_NAMES = ['MM:SS', 'Sec']
BRIGHT_NAMES = ['Lo', 'Med', 'Hi', 'Off']
BRIGHT_FG = [90, 170, 255]      # display/LED intensity for Lo/Med/Hi
BG = gui.RGB(0, 28, 48)

GREEN = (0, 70, 0)
RED = (70, 0, 0)


# --- State ------------------------------------------------------------------
class S:
    page = 0                    # 0 main, 1 config
    last_ms = 0
    gps_locked = False
    timer = None
    tod_ms = 0                  # GPS time of day (ms since UTC midnight)
    sats = 0

    # Distance (single GPS-integrated trip value)
    units = 'km'
    dist_m = 0.0

    # Clock / display
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


# --- Live display values (mutable 1-element lists bound into the GUI) -------
clock_disp = ['--:--:--']
sw_disp = ['0:00.0']
mode_disp = [MODE_NAMES[0]]
dist_disp = ['0.00 km']
spd_disp = ['0.0 km/h']
units_disp = ['km']
bright_disp = ['Hi']
clkfmt_disp = ['24Hr']
swfmt_disp = ['MM:SS']
autostart_disp = ['OFF 00:00:00']
gps_disp = ['Sats: 0']

clock = vts.Chrono()


def now_ms():
    return clock.read() // 1000


# --- Colours / brightness ---------------------------------------------------
def fg_rgb():
    v = BRIGHT_FG[S.brightness] if S.brightness < 3 else 0
    return (v, v, v)


# --- LEDs (also scaled by the brightness setting) ---------------------------
def set_leds(rgb):
    if S.brightness == 3:
        vts.leds(*[0] * 12)
        return
    f = BRIGHT_FG[S.brightness] / 255.0
    c = (int(rgb[0] * f), int(rgb[1] * f), int(rgb[2] * f))
    vts.leds(*list(c) * 4)


def update_leds(now, state):
    if state == 'run':
        set_leds(GREEN)
    elif state == 'stopped':
        set_leds(RED)
    else:
        set_leds(GREEN if (now // 300) % 2 else RED)


# --- Persistence ------------------------------------------------------------
def save_cfg(*_):
    if not vts.sd_present():
        return False
    try:
        with open(CFG_PATH, 'w') as f:
            f.write('units={}\n'.format(S.units))
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


# --- Distance ---------------------------------------------------------------
def integrate(dt, v):
    if dt <= 0 or dt > 1.0:
        return
    if v < 0:
        v = 0.0
    S.dist_m += v * dt


def dist_in_units(m):
    return m / 1000.0 if S.units == 'km' else m / M_PER_MILE


def dist_step():
    return 0.01 * (1000.0 if S.units == 'km' else M_PER_MILE)


# --- Clock (time of day from the VBOX sample's tod_ms) ----------------------
def tod_local_ms(tod_ms):
    return (tod_ms + TZ_OFFSET_H * 3600000) % 86400000


def tod_hms(tod_ms):
    total_s = tod_local_ms(tod_ms) // 1000
    return (total_s // 3600) % 24, (total_s // 60) % 60, total_s % 60


def fmt_clock(tod_ms):
    t = tod_local_ms(tod_ms)
    total_s = t // 1000
    h = (total_s // 3600) % 24
    m = (total_s // 60) % 60
    s = total_s % 60
    c = (t % 1000) // 10
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


# --- Periodic UI tick (10 Hz, runs with or without a GPS fix) ---------------
def ui_tick():
    now = now_ms()
    dt = (now - S.last_ms) / 1000.0
    S.last_ms = now

    # Satellites, time of day and speed all come from the VBOX sample
    sample = vbox.get_sample()
    if sample is None:
        locked = False
        speed = 0.0
        S.sats = 0
        S.tod_ms = 0
    else:
        S.sats = getattr(sample, 'sats_used', 0)
        S.tod_ms = getattr(sample, 'tod_ms', 0)
        speed = getattr(sample, 'speed_gnd_mps', 0.0)
        locked = S.tod_ms > 0
    gps_disp[0] = 'Sats: {}'.format(S.sats)
    if locked != S.gps_locked:
        S.gps_locked = locked
        draw()

    integrate(dt, speed)

    spd_disp[0] = '{:.1f} {}'.format(
        speed * (3.6 if S.units == 'km' else 2.23694),
        'km/h' if S.units == 'km' else 'mph')
    dist_disp[0] = '{:.2f} {}'.format(dist_in_units(S.dist_m), S.units)
    clock_disp[0] = fmt_clock(S.tod_ms) if locked else '--:--:--'

    # Auto-start (needs a valid GPS time)
    if locked and S.autostart_en and not sw_is_started():
        if tod_hms(S.tod_ms) == S.autostart_hms:
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


def tab_main(b):
    set_page(0)


def tab_cfg(b):
    set_page(1)


def dist_plus(b):
    S.dist_m += dist_step()


def dist_minus(b):
    S.dist_m = max(0.0, S.dist_m - dist_step())


def dist_reset(b):
    S.dist_m = 0.0


def toggle_units(b):
    S.units = 'mi' if S.units == 'km' else 'km'
    units_disp[0] = S.units
    save_cfg()
    draw()


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
    v = list(S.autostart_hms)
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
    S.clock_fmt = 0
    S.sw_fmt = 0
    S.mode = 0
    S.brightness = 2
    S.autostart_en = False
    S.autostart_hms = (0, 0, 0)
    S.dist_m = 0.0
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
        S.page = (S.page + 1) % 2
        draw()
    elif si.dx >= 50:
        S.page = (S.page - 1) % 2
        draw()


def header():
    title = ['RALLY COMPUTER', 'CONFIGURATION'][S.page]
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
        [gui.CTRL_BUTTON, 620, 6, 80, 40, 28, 'MAIN', tab_main],
        [gui.CTRL_BUTTON, 708, 6, 72, 40, 28, 'CFG', tab_cfg],
    ]


def page_main():
    fg = fg_rgb()
    return [
        [gui.DL_COLOR_RGB(*fg)],
        [gui.CTRL_TEXT, 400, 80, 24, gui.OPT_CENTER, 'TIME OF DAY'],
        [gui.CTRL_TEXT, 400, 116, 31, gui.OPT_CENTER, clock_disp],
        [gui.CTRL_TEXT, 210, 176, 24, gui.OPT_CENTER, 'STOPWATCH'],
        [gui.CTRL_TEXT, 210, 224, 31, gui.OPT_CENTER, sw_disp],
        [gui.CTRL_TEXT, 210, 268, 24, gui.OPT_CENTER, mode_disp],
        [gui.CTRL_TEXT, 590, 176, 24, gui.OPT_CENTER, 'DISTANCE'],
        [gui.CTRL_TEXT, 590, 224, 31, gui.OPT_CENTER, dist_disp],
        [gui.CTRL_TEXT, 400, 330, 26, gui.OPT_CENTER, spd_disp],
        [gui.CTRL_BUTTON, 15, 398, 150, 68, 28, 'Start/Stop', sw_press],
        [gui.CTRL_BUTTON, 167, 398, 150, 68, 28, 'SW Reset', sw_reset],
        [gui.CTRL_BUTTON, 319, 398, 150, 68, 28, 'Dist +', dist_plus],
        [gui.CTRL_BUTTON, 471, 398, 150, 68, 28, 'Dist -', dist_minus],
        [gui.CTRL_BUTTON, 623, 398, 150, 68, 28, 'Dist 0', dist_reset],
    ]


def page_cfg():
    fg = fg_rgb()
    out = [[gui.DL_COLOR_RGB(*fg)]]
    rows = [
        ('Units', units_disp, toggle_units),
        ('Clock format', clkfmt_disp, cycle_clkfmt),
        ('Stopwatch mode', mode_disp, cycle_mode),
        ('Stopwatch format', swfmt_disp, cycle_swfmt),
        ('Brightness', bright_disp, cycle_bright),
    ]
    y = 72
    for label, val, cb in rows:
        out.append([gui.CTRL_TEXT, 20, y, 28, 0, label])
        out.append([gui.CTRL_TEXT, 340, y, 28, 0, val])
        out.append([gui.CTRL_BUTTON, 560, y - 8, 200, 40, 26, 'Change', cb])
        y += 46
    out.append([gui.CTRL_TEXT, 20, y, 28, 0, 'Auto-start'])
    out.append([gui.CTRL_TEXT, 340, y, 28, 0, autostart_disp])
    y += 40
    out.append([gui.CTRL_BUTTON, 20, y, 170, 44, 26, 'Auto On/Off', toggle_autostart])
    out.append([gui.CTRL_BUTTON, 200, y, 70, 44, 26, '+H', autostart_h])
    out.append([gui.CTRL_BUTTON, 278, y, 70, 44, 26, '+M', autostart_m])
    out.append([gui.CTRL_BUTTON, 356, y, 70, 44, 26, '+S', autostart_s])
    out.append([gui.CTRL_BUTTON, 470, y, 150, 44, 26, 'Save SD', save_cfg])
    out.append([gui.CTRL_BUTTON, 628, y, 150, 44, 26, 'Factory', factory_reset])
    return out


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
    gui_l.extend([page_main, page_cfg][S.page]())
    gui.show(gui_l)


def sync_disp():
    units_disp[0] = S.units
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

    # tod_ms lives in the STD source; fall back to BASIC if unavailable
    try:
        vbox.init(vbox.VBOX_SRC_GNSS_STD)
    except Exception:
        try:
            vbox.init(vbox.VBOX_SRC_GNSS_BASIC)
        except Exception as e:
            print('vbox init failed:', e)

    vts.Timer.destroy_all()
    S.timer = vts.Timer(100, True)
    S.timer.set_callback(ui_tick)

    draw()

    # Keep the script alive so the timer callbacks keep running
    while True:
        vts.delay_ms(100)


if __name__ == '__main__':
    main()
