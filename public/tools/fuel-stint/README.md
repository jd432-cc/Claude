# Fuel &amp; Stint Calculator

A browser page that builds a stint plan and shows the strategies actually
available, with the gaps between them. No server, no upload, works offline
once loaded.

Live at `/tools/fuel-stint/`. Fills the Strategy category, which was empty.

---

## Why it is built this way

**Every input is measurable.** Nothing here asks for a figure that can only be
guessed at. Tank capacity, burn per lap, lane length, speed limit, base lap,
degradation — each is read off a regulation or measured in a practice session.
Two of them are measured quantities that a tool is tempted to hard-code, and
both are labelled as such in the form: the fuel sensitivity and the lift-and-
coast cost. There is a two-lap helper beside the first one that back-computes
it rather than letting anyone type 0.030 from memory onto a circuit where the
truth is 0.045.

**Pit loss is computed, not entered.** A team that types "22 seconds" has
folded the lane, the stop and the entry into one number and can no longer see
which of the three moved when the number does. The tool takes the lane length,
the limit, the racing-equivalent speed over the same stretch, the stationary
time and the entry/exit loss, and shows the itemised result. It shows the same
stop under safety car alongside it, because the collapse of the racing-speed
reference is the only reason the *timing* of a stop is a decision at all.

**A timed race is not the duration divided by the base lap.** The base lap is
the fastest lap of the race and almost no lap is it. With a full tank and worn
tyres the difference runs to several laps over an hour. The tool accumulates
modelled laps until the clock runs out, then runs the lap in progress to the
flag. Being wrong by one lap is the difference between finishing and stopping
on the last corner.

**The field, not an optimum.** Every legal stop count from the minimum to two
above it, two lap distributions each — even, and front-loaded for track
position — scored on total race time and sorted with the delta to the best.
A single "optimal" answer hides the thing an engineer is actually deciding,
which is whether 0.4 s is worth the track position.

**Which constraint binds is stated per stint.** Fuel-limited and tyre-limited
call for opposite decisions. A fuel-limited stint gets longer by lifting and
coasting; a tyre-limited one does not, and lifting only makes it slower. The
tool never leaves that ambiguous — it is in the strategy table, in the summary
band, and hatched into the chart.

**Nothing leaves the machine.** Motorsport data is confidential and the paddock
has bad signal. Everything runs client-side; autosave is `localStorage`, and
sharing is an explicit file export. The page makes no offsite request at all:
Archivo is vendored under `../_shared/assets/`, and the CSP is
`default-src 'none'`.

**SI is what is stored.** The units toggle is a presentation choice. A display
string is never state, so switching to US gallons cannot change a number.

---

## The model

`js/calc/strategy.js` is pure — no DOM, importable by Node, and every worked
example in the build brief is an assertion in `tools/test-fuel-stint.mjs`.

| | |
| --- | --- |
| Fuel density | `ρ(T) = ρ_ref × (1 − β × (T − T_ref))`, β ≈ 0.00095 /°C |
| Lap time | `base + k·m_fuel + degOffset + deg·i + out/in lap deltas` |
| Pit loss | `(t_lane − t_racing) + stationary + entry/exit` |
| Stationary | `max(tyreChange, refuelVolume / refuelRate)` |
| Stint length | `min(floor(tank / burn), maxLapsPerSet)` |
| Fuel load | `(stintLaps × burn) × (1 + margin) + reserve` |
| Saving to drop a stop | `requiredBurn = tank × stints / raceLaps` |

Fuel mass is taken at the start of each lap: the car is heaviest when it
crosses the line, and a lap is scored by the line it starts from.

Race distance and the stint plan each depend on the other — the laps decide
the fuel load, the load decides the lap times, the lap times decide the laps —
so `compute()` iterates to a fixed point rather than taking one pass.

`data/fuels.json` seeds petrol, E85, methanol and diesel. Every entry carries
a `source` field, and every source says the same thing in different words:
confirm it against the delivery note. A density typed from memory is wrong by
more than the correction it is being used for.

---

## Two numbers in the brief that the tests could not reproduce

The brief says a number that cannot be reproduced by a test is wrong and
should be raised rather than quietly implemented. Two were.

**Stint capacity against the fuel load.** The brief gives
`lapsPerStint_fuel = floor(tankCapacity / burn)` — 31 laps for a 100 l tank at
3.2 l/lap — and separately `load = (stintLaps × burn) × (1 + margin) +
reserve`. Those two do not agree: a 31-lap stint at 2% margin and 1.5 l
reserve wants 102.7 l, which the same brief says is a hard validation failure.
Both numbers are kept and both are reported. `fuelLaps` is the brief's figure —
what the tank holds brim-full — and `fuelLapsPlannable` is what fits once the
margin and the reserve are in it, which is 30. Stints are planned to the
second and the difference is stated in the issues list, because a planner that
generated strategies it then flagged as errors would be worse than either.

**"The crossover lap where the undercut stops paying."** With linear
degradation the advantage accumulates: each lap the rival stays out, their
tyres are one lap older and ours are one lap fresher, so the per-lap gain is
constant and the cumulative gain only grows. There is no lap at which it stops
paying. What there is, is the offset at which it *starts* — the point where the
accumulated gain has covered the out lap, the in lap and any pit-loss
difference. That is what `undercut()` returns as `crossover`, and the UI says
so in those words. A crossover in the other direction needs a degradation model
that is not linear, and the brief's own lap-time model is.

---

## Exports

- **`.trd.json` session** — the same convention as the Report Builder.
- **Stint table CSV** — for the pit wall.
- **PEER strategy fragment** — the selected strategy as a JSON object keyed to
  the PEER schema's own paths, confirmed against
  `_tools/report-builder/js/schemas/peer.js` rather than invented:
  `strategy.stopLap.planned`, `strategy.stationary.planned`,
  `strategy.inLap.planned`, `strategy.outLap.planned`,
  `strategy.undercut.planned`, `fuel.consumption.modelled`,
  `fuel.reserve.modelled`, `fuel.correction.modelled` and `modelPredicted`.
  The `planned` column, because that is what a plan is; the `actual` column is
  filled after the race by whoever writes the report.

---

## Running it

```
node tools/test-fuel-stint.mjs   # 58 assertions
node tools/build-web.mjs         # regenerate the scoped stylesheet
node tools/build-tools.mjs       # copy to public/tools/ for local preview
node dev-server.js               # http://localhost:8788/tools/fuel-stint/
```

---

## Not built yet

- **Safety car scoring.** An assumed safety car is drawn on the chart and
  scales the pit-loss reference, but it does not yet re-score the candidates —
  a stop taken under it should move a strategy up the table and currently does
  not. That is the next thing worth building here.
- **Traffic.** The model has no other cars in it. An undercut that works on
  paper and fails behind a backmarker is the most common way a strategy call
  goes wrong, and nothing here catches it.
- **Non-linear degradation.** Linear degradation with an offset covers a stint
  on a controlled tyre and does not cover a cliff. A cliff changes the answer
  to every question on this page, and modelling it needs per-set data the tool
  does not currently ask for.
