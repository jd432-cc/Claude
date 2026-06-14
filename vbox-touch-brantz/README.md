# Brantz Rallymeter for VBOX Motorsport Touch

A single self-contained MicroPython app (`main.py`) that combines the core
functions of two classic **Brantz** rally instruments onto one **VBOX Motorsport
Touch** screen:

| Source manual | Function on the MAIN screen |
|---|---|
| `Brantz International Tripmeter` | Distance travelled (from GPS) |
| `Brantz Timer V2 (BR32V2)` | Time of day (from GPS) + 4-mode stopwatch |

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

## Screens

Two screens — **MAIN** and **CFG** — switched by **swiping** left/right or
tapping the **MAIN / CFG** tabs (top right).

A **GPS indicator** sits under the title: a coloured dot (green = valid GPS time,
red = none) plus the live satellite count (`Sats: 11`), both read from the VBOX
sample (`sats_used`).

### MAIN
- **Time of day** from the GPS sample (`tod_ms`) in the configured `24Hr / 12Hr /
  10Hr-decimal / 100th` format. Shows `--:--:--` until the GPS time is valid; the
  stopwatch needs no fix.
- **Stopwatch** (large) with the active mode label; the 4 Brantz modes are:
  - **Standard** – start / stop / hold / reset.
  - **Regularity** – free-runs; a press holds the display ~32 s then internally
    resets and restarts timing the next section.
  - **Jogularity** – free-runs; a press holds the display ~32 s while counting
    continues, showing the cumulative total.
  - **Std-Cumulative** – start/stop with background counting; shows cumulative.
- **Distance travelled** (large), integrated from GPS ground speed, plus **Speed**.
- Minimal buttons: `Start/Stop`, `SW Reset`, `Dist +`, `Dist -`, `Dist 0`.
- The 4 front LEDs mirror the Brantz Start/Stop LED: **red** = stopped,
  **green** = running, **flashing** = paused/hold (scaled by the brightness
  setting).

### CFG
- `Change` buttons cycle **Units** (km/mile), **Clock format**, **Stopwatch
  mode**, **Stopwatch format** (MM:SS / seconds) and **Brightness**
  (Lo/Med/Hi/Off — affects the display and the front LEDs).
- `Auto On/Off` + `+H/+M/+S` set the stopwatch auto-start time; `Save SD` and
  `Factory` reset.
- Settings are written to `/sd/brantz.cfg` whenever changed and reloaded on
  startup (emulates "settings saved on power down").

### Physical inputs
The `digitalio` inputs are treated as the Brantz **Remote** button (Start/Stop)
and **Reset** button, in addition to the on-screen buttons.

## Feature → VBOX Touch API mapping

| Function | VBOX Touch implementation |
|---|---|
| Time of day (24/12/10/100th) | `vbox.get_sample().tod_ms` (ms since UTC midnight) formatted per mode |
| GPS indicator / lock | `vbox.get_sample().sats_used` for satellites; locked when `tod_ms > 0` |
| UI / clock / stopwatch refresh | `vts.Timer(100, True)` 10 Hz tick (works without a fix) |
| Stopwatch timing | `vts.Chrono` monotonic time; 4-mode state machine |
| 32-second hold | timestamp + `HOLD_MS` compare |
| Start/Stop LED states | `vts.leds(*[r,g,b]*4)`, time-based flashing, brightness-scaled |
| Remote / Reset buttons | `digitalio.get()` falling-edge + on-screen buttons |
| Distance travelled | integrate `vbox.get_sample().speed_gnd_mps` · dt |
| Units km / mile | display scaling |
| Brightness Lo/Med/Hi/Off | display intensity + LED scaling; Off blanks until tapped |
| Settings persistence | `open('/sd/brantz.cfg')`, guarded by `vts.sd_present()` |
| Screens / swiping | `gui.show` + `EVT_SWIPE` / `gui.swipe_info()` |

## Fidelity notes / limitations

- Distance and time both come from **GPS**; there is no wheel-sensor calibration
  (removed — GPS provides the distance directly).
- Satellites and time of day are read from the **VBOX sample** — `sats_used` and
  `tod_ms` (**milliseconds** since UTC midnight, converted to H:M:S) — not the
  `gnss.*` getters, which read 0 on the unit. `vbox.init` uses
  `VBOX_SRC_GNSS_STD` (where `tod_ms` lives) and falls back to
  `VBOX_SRC_GNSS_BASIC`; a keep-alive loop holds the script open so the 10 Hz
  timer keeps running. GPS "lock" = `tod_ms > 0`.
- Brightness is emulated by scaling drawn intensity and LED output (the examples
  expose no backlight-PWM register).
- Clock time is GPS **UTC**; set `TZ_OFFSET_H` at the top of `main.py` for local
  time.
- Built-in GUI fonts are used for big readouts (no external `.rft`/`.png`
  assets to deploy).

## Verification performed

- `python3 -m py_compile main.py` — compiles cleanly.
- Import/API scan — every `gui/vts/gnss/vbox/digitalio` symbol used is present in
  the official examples or the two user-supplied working scripts; no other modules
  are imported.
- Logic tests against stubbed hardware (clock formats, all stopwatch modes,
  distance integration, units, brightness/LED scaling, and the settings
  save/load round-trip) — all pass.
- Sample/GPS tests — `tod_ms` (e.g. `52420000` ms → `14:33:40`) drives the clock,
  `sats_used` drives the satellite count, lock follows `tod_ms > 0`, a `None`
  sample blanks the clock, distance integrates from the sample speed, and `main()`
  inits `VBOX_SRC_GNSS_STD` first and wires the 10 Hz timer — all pass.
- On-hardware execution was **not** performed here (the `gui/vts/gnss/vbox/...`
  modules exist only on the VBOX Touch); correctness is argued via the mapping
  above and the tests.
