# Brantz Rallymeter for VBOX Motorsport Touch

A single self-contained MicroPython app (`main.py`) that reproduces the core
functions of two classic **Brantz** rally instruments on the **VBOX Motorsport
Touch** display:

| Source manual | Emulated instrument |
|---|---|
| `Brantz International Tripmeter` | Distance / trip computer page |
| `Brantz Timer V2 (BR32V2)` | Real-time clock + 4-mode stopwatch page |

It uses **only** functions demonstrated by the official VBOX Touch python
examples (`gui`, `vts`, `gnss`, `vbox`, `digitalio`) — no invented APIs.

## Deploy

Per the VBOX Touch examples' `Readme.txt`:

1. Copy `main.py` to the **root of the SD card**.
2. Insert the SD card **before** powering on the VBOX Touch.
3. Power on — `main.py` runs automatically.
4. To revert to normal operation, delete `main.py` from the SD card.

Debug/`print()` output appears on the serial port (Connector 3, via an
RLCAB001 cable).

## Pages

Switch pages by **swiping** left/right or tapping the **TRIP / TIMER / CFG**
tabs (top right).

### TRIPMETER (Brantz International Tripmeter)
- **TOTAL** and **INTERMEDIATE** distance, derived by integrating GNSS ground
  speed; **Speed** and **Calibration** readouts.
- `Zero Int`, `Zero Tot`, `Freeze` (freeze total), `Count +/-` (direction),
  `Edit -/+` (nudge total), `Units` (km/mile), `Cal -/+` (calibration multiplier,
  emulating the push-wheel calibration switches).

### RALLY TIMER (Brantz Timer V2)
- **Time of day** in `24Hr / 12Hr / 10Hr-decimal / 100th` formats (+ a small
  analog clock), GNSS-sourced (UTC; set `TZ_OFFSET_H` for local time).
- **Stopwatch** with the 4 Brantz modes, cycled by `Mode`:
  - **Standard** – start / stop / hold / reset.
  - **Regularity** – free-runs; a press holds the display ~32 s then internally
    resets and restarts timing the next section.
  - **Jogularity** – free-runs; a press holds the display ~32 s while counting
    continues, showing the cumulative total.
  - **Std-Cumulative** – start/stop with background counting; shows cumulative.
- `Start/Stop`, `Reset`, `Clk Fmt`, `SW Fmt` (MM:SS / decimal seconds),
  `Bright` (Lo/Med/Hi/Off).
- The 4 front LEDs mirror the Brantz Start/Stop LED: **red** = stopped,
  **green** = running, **flashing** = paused/hold.

### CONFIG
- Shows all settings; `Auto On/Off` + `+H/+M/+S` set the stopwatch auto-start
  time; `Save to SD` and `Factory Reset`.
- Settings are written to `/sd/brantz.cfg` whenever changed and reloaded on
  startup (emulates "settings saved on power down").

### Physical inputs
The `digitalio` inputs are treated as the Brantz **Remote** button (Start/Stop)
and **Reset** button, in addition to the on-screen buttons.

## Feature → VBOX Touch API mapping

| Brantz function | VBOX Touch implementation |
|---|---|
| Real-time clock (24/12/10/100th) | `gnss.h/m/s/cs()` formatted per mode |
| Stopwatch timing | `vts.Chrono` monotonic time; 4-mode state machine |
| 32-second hold | timestamp + `HOLD_MS` compare |
| Start/Stop LED states | `vts.leds(*[r,g,b]*4)` with time-based flashing |
| Remote / Reset buttons | `digitalio.get()` falling-edge + on-screen buttons |
| Total / Intermediate distance | integrate `vbox.get_sample().speed_gnd_mps` · dt |
| Calibration factor | numeric multiplier on integrated distance |
| Units km / mile | display scaling |
| Brightness Lo/Med/Hi/Off | foreground intensity; Off blanks until tapped |
| Settings persistence | `open('/sd/brantz.cfg')`, guarded by `vts.sd_present()` |
| Pages / swiping | `gui.show` + `EVT_SWIPE` / `gui.swipe_info()` |

## Fidelity notes / limitations

- Tripmeter distance comes from **GNSS speed**, not a wheel sensor, so the
  calibration factor is a fine-trim multiplier rather than a pulse divider.
- Brightness is emulated by scaling drawn intensity (the examples expose no
  backlight-PWM register).
- Clock time is GNSS **UTC**; set `TZ_OFFSET_H` at the top of `main.py` for
  local time.
- Built-in GUI fonts are used for big readouts (no external `.rft`/`.png`
  assets to deploy).

## Verification performed

- `python3 -m py_compile main.py` — compiles cleanly.
- Import/API scan — every `gui/vts/gnss/vbox/digitalio` symbol used is present in
  the official examples; no other modules are imported.
- Logic tests against stubbed hardware (clock formats, all stopwatch modes,
  distance integration with calibration/units/freeze/direction, and the
  settings save/load round-trip) — all pass.
- On-hardware execution was **not** performed here (the `gui/vts/gnss/vbox/...`
  modules exist only on the VBOX Touch); correctness is argued via the mapping
  above and the tests.
