#!/usr/bin/env node
/* =============================================================
   TheRacingData — fuel & stint calculator test.

   Plain Node, no browser, no framework. Every worked example in
   the build brief is an assertion here; a number that cannot be
   reproduced is a number that is wrong, and two of them were.
   Both are marked in place and in the tool's README.

   Run from the repo root:  node tools/test-fuel-stint.mjs
   ============================================================= */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CALC = join(ROOT, '_tools/fuel-stint/js/calc/strategy.js');

const {
  density, fuelMass, fuelSensitivityFrom, pitLoss, stationaryTime,
  stintCapacity, raceDistance, fuelLoad, evenSplit, frontLoaded,
  simulate, enumerate, validate, compute, savingToRemoveStop, undercut,
  MODEL_DEFAULTS,
} = await import(CALC);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

/* ---------- race distance ----------
   A 60-minute race, 1:45.0 base lap, no degradation, no fuel effect.
   Thirty-four laps fit inside the hour (34 x 105 = 3570 s); the
   thirty-fifth is in progress when the clock runs out and is run to
   the flag. */
const flat = raceDistance({ mode: 'time', duration_s: 3600, plusOneLap: true }, () => 105);
ok('race distance: 34 laps inside the hour', flat.lapsWithinTime === 34, String(flat.lapsWithinTime));
ok('race distance: the lap in progress at the flag is run, so 35',
   flat.laps === 35, String(flat.laps));
ok('race distance: dividing the duration by the base lap would have said 34',
   Math.floor(3600 / 105) === 34 && flat.laps !== Math.floor(3600 / 105));

// Landing exactly on the flag is the one case with no lap in progress.
const exact = raceDistance({ mode: 'time', duration_s: 3570, plusOneLap: true }, () => 105);
ok('race distance: a race that lands on the line adds nothing', exact.laps === 34, String(exact.laps));

// Degradation pushes the lap count down, which is the whole reason for
// accumulating rather than dividing.
const degraded = raceDistance({ mode: 'time', duration_s: 3600, plusOneLap: true },
                              i => 105 + 0.08 * i);
ok('race distance: degradation costs laps', degraded.laps < flat.laps,
   `${degraded.laps} vs ${flat.laps}`);

const fixed = raceDistance({ mode: 'laps', laps: 52 }, () => 105);
ok('race distance: a lap race is the laps it says', fixed.laps === 52);

/* ---------- stint length ---------- */
const cap = stintCapacity({ tankCapacity_l: 100, burn_l_per_lap: 3.2, maxLapsPerSet: 25 });
ok('stint: 100 l at 3.2 l/lap is 31 laps of fuel', cap.fuelLaps === 31, String(cap.fuelLaps));
ok('stint: tyres good for 25 bind before the fuel does', cap.tyreLaps === 25 && cap.laps === 25);
ok('stint: and the tool says which one binds', cap.binding === 'tyre', cap.binding);

const fuelBound = stintCapacity({ tankCapacity_l: 100, burn_l_per_lap: 3.2, maxLapsPerSet: 40 });
ok('stint: longer-lasting tyres hand the constraint back to the fuel',
   fuelBound.binding === 'fuel' && fuelBound.laps === 31);
// Brim-full and plannable are different numbers and both are reported:
// 31 laps of fuel fit in the tank, 30 fit with the margin and reserve.
ok('stint: the plannable length carries the margin and the reserve',
   cap.fuelLapsPlannable === 30, String(cap.fuelLapsPlannable));

/* ---------- pit loss ----------
   380 m lane at 60 km/h against a 190 km/h racing equivalent, 3.5 s
   stationary, 1.2 s entry and exit. */
const loss = pitLoss({
  laneLength_m: 380, speedLimit_kph: 60, racingSpeed_kph: 190,
  stationary_s: 3.5, entryExitLoss_s: 1.2,
});
ok('pit loss: lane at the limit takes 22.8 s', near(loss.lane_s, 22.8, 0.05), loss.lane_s.toFixed(2));
ok('pit loss: the same lane at racing speed takes 7.2 s', near(loss.racing_s, 7.2, 0.05), loss.racing_s.toFixed(2));
ok('pit loss: 20.3 s in total', near(loss.total_s, 20.3, 0.1), loss.total_s.toFixed(2));

// Under safety car the racing-speed reference collapses: the lane still
// takes 22.8 s, but what the car would have done instead is much slower,
// so the stop costs less against the field. That collapse is the only
// reason the timing of a stop is a decision at all.
const scLoss = pitLoss({
  laneLength_m: 380, speedLimit_kph: 60, racingSpeed_kph: 190,
  stationary_s: 3.5, entryExitLoss_s: 1.2, scPaceFactor: 0.6,
});
ok('pit loss: a stop under safety car costs less against the field',
   scLoss.total_s < loss.total_s, `${scLoss.total_s.toFixed(1)} vs ${loss.total_s.toFixed(1)}`);
ok('pit loss: the lane itself does not get quicker under safety car',
   near(scLoss.lane_s, loss.lane_s, 1e-9));

ok('stationary time: the longer of the tyre change and the refuel',
   stationaryTime({ tyreChange_s: 3.5, refuelVolume_l: 60, refuelRate_l_per_s: 6 }) === 10);
ok('stationary time: a tyres-only stop is the tyre change',
   stationaryTime({ tyreChange_s: 3.5, refuelVolume_l: 0, refuelRate_l_per_s: 6 }) === 3.5);

/* ---------- fuel sensitivity, back-computed ----------
   Two laps of known fuel mass, already corrected for degradation:
   1.50 s apart across 50 kg is 0.030 s/kg. */
const k = fuelSensitivityFrom(
  { lapTime_s: 105.90, fuelMass_kg: 60 },
  { lapTime_s: 104.40, fuelMass_kg: 10 });
ok('fuel sensitivity: back-computed from two laps is 0.030 s/kg',
   near(k, 0.030, 0.001), String(k));
ok('fuel sensitivity: two laps at the same mass answer nothing',
   fuelSensitivityFrom({ lapTime_s: 105, fuelMass_kg: 40 },
                       { lapTime_s: 104, fuelMass_kg: 40 }) === null);

/* ---------- density ----------
   Warm fuel is less dense. Across a full tank the difference is more
   than the margin most teams carry. */
const petrol = { density_kg_per_l: 0.745, tempRef_c: 15, beta_per_c: 0.00095 };
const cold = density(15, petrol);
const warm = density(35, petrol);
ok('density: 35 °C is below 15 °C', warm < cold, `${warm.toFixed(4)} vs ${cold.toFixed(4)}`);
ok('density: the reference temperature returns the reference density',
   near(cold, 0.745, 1e-12));
const dm = fuelMass(100, 15, petrol) - fuelMass(100, 35, petrol);
ok('density: a full 100 l tank differs by more than 1 kg across 20 °C',
   dm > 1, `${dm.toFixed(3)} kg`);

/* ---------- fuel load ---------- */
ok('fuel load: 20 laps at 3.2 l with 2% margin and 1.5 l reserve',
   near(fuelLoad({ stintLaps: 20, burn_l_per_lap: 3.2, margin: 0.02, reserve_l: 1.5 }),
        20 * 3.2 * 1.02 + 1.5, 1e-9));
ok('fuel load: the formation lap is fuel too',
   near(fuelLoad({ stintLaps: 20, burn_l_per_lap: 3.2, margin: 0, reserve_l: 0, formationLap: true }),
        21 * 3.2, 1e-9));

/* ---------- distributions ---------- */
ok('split: 52 laps over 3 stints is 18/17/17', evenSplit(52, 3).join('/') === '18/17/17');
ok('split: the remainder goes to the earlier stints',
   evenSplit(50, 4).join('/') === '13/13/12/12');
ok('split: front-loaded fills the first stint to capacity',
   frontLoaded(52, 3, 22).join('/') === '22/15/15', frontLoaded(52, 3, 22).join('/'));

/* ---------- a whole race ---------- */
const state = {
  event: { name: 'Silverstone GP', lapDistance_m: 5891 },
  format: { mode: 'time', duration_s: 3600, plusOneLap: true, formationLap: true },
  car: {
    tankCapacity_l: 100, burn_l_per_lap: 3.2, fuelDensity_kg_per_l: 0.745,
    fuelTemp_c: 25, refuelAllowed: true, refuelRate_l_per_s: 6,
    margin: 0.02, reserve_l: 1.5,
  },
  pace: {
    baseLap_s: 105, fuelSensitivity_s_per_kg: 0.030, degLinear_s_per_lap: 0.04,
    degOffset_s: 0, outLapDelta_s: 2.5, inLapDelta_s: 1.8,
    liftCoastCost_s_per_pct: 0.10, rivalStintLap: 12,
  },
  pit: {
    laneLength_m: 380, speedLimit_kph: 60, racingSpeed_kph: 190,
    stationary_s: 0, entryExitLoss_s: 1.2, tyreChange_s: 3.5,
  },
  rules: { minStops: 0, maxStints: 0, mandatoryWindow: [], refuelForbiddenUnderSC: true },
  tyres: { setsAvailable: 6, maxLapsPerSet: 25 },
  sc: { assumed: [] },
};

const run = compute(state);
ok('compute: the race is a plausible length',
   run.derived.raceLaps > 28 && run.derived.raceLaps < 36, String(run.derived.raceLaps));
ok('compute: candidates are generated and sorted by total time',
   run.derived.candidates.length >= 2 &&
   run.derived.candidates.every((c, i, a) => i === 0 || a[i - 1].total_s <= c.total_s));
ok('compute: the best candidate has a zero delta',
   near(run.derived.candidates[0].delta_s, 0, 1e-9));
ok('compute: every stint says what binds it',
   run.derived.candidates[0].stints.every(s => typeof s.binding === 'string'));
ok('compute: the stints add up to the race',
   run.derived.candidates[0].stints.reduce((a, s) => a + s.laps, 0) === run.derived.raceLaps);
ok('compute: no candidate is planned over the tank',
   run.derived.candidates.every(c => c.stints.every(s => !s.overTank)));
ok('compute: the safety car figure is reported alongside the racing one',
   run.derived.pitLossSC.total_s !== run.derived.pitLoss.total_s);

// Fuel is heavy and the first laps are the slowest, degradation aside.
const first = run.derived.candidates[0].stints[0];
ok('compute: a stint is fuelled for its own length, not brim-full',
   first.load_l < state.car.tankCapacity_l, first.load_l.toFixed(1));

/* ---------- a strategy that will not fit in the tank ----------
   32 laps at 3.125 l/lap with a 1.0 l reserve wants 101 l. The tank
   holds 100. That is an error, not a warning: the plan cannot be run. */
const overfull = {
  ...state,
  format: { ...state.format, formationLap: false },
  car: { ...state.car, burn_l_per_lap: 3.125, margin: 0, reserve_l: 1.0 },
};
const brim = compute(overfull);
const forced = simulate(brim, [32]);
ok('overfull: 32 laps at 3.125 l/lap plus 1 l reserve is 101 l',
   near(forced.stints[0].load_l, 101, 1e-9), forced.stints[0].load_l.toFixed(3));
ok('overfull: 101 l in a 100 l tank is flagged on the stint',
   forced.stints[0].overTank === true);
const overIssues = validate(brim, [forced]);
ok('overfull: and raised as an error, not a warning',
   overIssues.some(i => i.severity === 'error' && /101\.0 l in a 100\.0 l tank/.test(i.message)),
   JSON.stringify(overIssues.filter(i => i.severity === 'error').map(i => i.message)));
ok('overfull: nothing about it is downgraded to a warning',
   !overIssues.some(i => i.severity === 'warning' && /tank/.test(i.message)));

/* ---------- the saving that removes a stop ---------- */
const saving = savingToRemoveStop(run, 2);
ok('saving: two stints on a 100 l tank need a burn the race can be run at',
   near(saving.requiredBurn_l_per_lap, 100 * 2 / run.derived.raceLaps, 1e-9));
ok('saving: stated as a percentage and as litres per lap',
   Number.isFinite(saving.savingPct) && Number.isFinite(saving.saving_l_per_lap));
ok('saving: the verdict is a signed number of seconds',
   Number.isFinite(saving.netGain_s));
ok('saving: the cost is the saving in points times the lift-and-coast rate',
   near(saving.lapTimeCost_s, saving.savingPct * 0.10, 1e-9));
ok('saving: the verdict is the pit loss against the cost over the race',
   near(saving.netGain_s,
        run.derived.pitLoss.total_s - saving.lapTimeCost_s * run.derived.raceLaps, 1e-9));

// A saving that has to come out of a much smaller tank does not pay:
// the lap time cost outruns the stop it removes.
const thirsty = compute({ ...state, car: { ...state.car, tankCapacity_l: 55 } });
const impossible = savingToRemoveStop(thirsty, 1);
ok('saving: a saving big enough to remove every stop costs more than the stop',
   impossible.netGain_s < 0, impossible.netGain_s.toFixed(1));
ok('saving: a saving that is not needed reports so',
   savingToRemoveStop(run, 4).needed === false);

/* ---------- undercut ---------- */
const uc = undercut(run, { rivalStintLap: 12 });
ok('undercut: computed over 1 to 5 laps of offset', uc.rows.length === 5);
ok('undercut: the out lap is paid once, so the first lap is the worst',
   uc.rows[0].gain_s < uc.rows[1].gain_s - uc.rows[0].gain_s + 1e-9);
ok('undercut: a rival on fresh tyres offers nothing',
   undercut(run, { rivalStintLap: 0 }).rows.every(r => r.gain_s <= 0));
ok('undercut: a rival deep into a stint offers more than one early in it',
   undercut(run, { rivalStintLap: 20 }).rows[2].gain_s >
   undercut(run, { rivalStintLap: 5 }).rows[2].gain_s);

/* ---------- mandatory windows ---------- */
const windowed = compute({
  ...state,
  rules: { ...state.rules, mandatoryWindow: [{ openLap: 5, closeLap: 8 }] },
});
ok('rules: a candidate that misses a mandatory window is marked, not hidden',
   windowed.derived.candidates.length > 0 &&
   windowed.derived.candidates.some(c => c.legal.some(m => /mandatory window/.test(m))));

/* ---------- the fuels data file ---------- */
const fuels = JSON.parse(await readFile(join(ROOT, '_tools/fuel-stint/data/fuels.json'), 'utf8'));
ok('fuels: petrol, E85 and methanol are seeded',
   ['petrol', 'e85', 'methanol'].every(id => fuels.fuels.some(f => f.id === id)));
ok('fuels: every entry carries a source',
   fuels.fuels.every(f => typeof f.source === 'string' && f.source.length > 20));
ok('fuels: the seeded densities are the ones the brief names',
   fuels.fuels.find(f => f.id === 'petrol').density_kg_per_l === 0.745 &&
   fuels.fuels.find(f => f.id === 'e85').density_kg_per_l === 0.785 &&
   fuels.fuels.find(f => f.id === 'methanol').density_kg_per_l === 0.792);

/* ---------- defaults the brief fixes ---------- */
ok('defaults: fuel sensitivity 0.030 s/kg',
   MODEL_DEFAULTS.fuelSensitivity_s_per_kg === 0.030);
ok('defaults: 2% margin and 1.5 l reserve',
   MODEL_DEFAULTS.margin === 0.02 && MODEL_DEFAULTS.reserve_l === 1.5);
ok('defaults: lift and coast at 0.10 s/lap per 1% saved',
   MODEL_DEFAULTS.liftCoastCost_s_per_pct === 0.10);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
