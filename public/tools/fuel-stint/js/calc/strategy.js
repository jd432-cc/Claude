/* =============================================================
   TheRacingData — Fuel & Stint Calculator
   The model. Pure functions, no DOM, importable by Node.

   Every input is something a team can measure in a practice
   session or read off a regulation. Nothing here asks for a
   number that can only be guessed at, and nothing here returns
   one figure where the honest answer is a field and the gaps
   between its entries.

   SI throughout: metres, seconds, litres, kilograms, degrees
   Celsius. Kilometres per hour is the one exception, because
   that is the unit a pit lane speed limit is written in.
   ============================================================= */

/* Reference conditions for the seeded fuels. Overridable per fuel;
   data/fuels.json carries a source for each entry, and the source is
   the point — a density typed from memory is a density that is wrong
   by more than the correction it is being used for. */
export const FUEL_DEFAULTS = {
  tempRef_c: 15,
  beta_per_c: 0.00095,
  density_kg_per_l: 0.745,
};

export const MODEL_DEFAULTS = {
  fuelSensitivity_s_per_kg: 0.030,   // measured, not constant. See below.
  margin: 0.02,                      // 2% on the stint's computed need
  reserve_l: 1.5,                    // in-lap, sampling, pump pickup
  liftCoastCost_s_per_pct: 0.10,     // measured, not constant
};

/* ---------- fuel mass and volume ---------- */

/* Fuel is bought and burned by volume and carried as mass. A tank
   filled warm and raced cold is a different number of kilograms from
   the same litres filled cold, and the difference across a full tank
   is worth more than the margin most teams carry. */
export function density(temp_c, {
  density_kg_per_l = FUEL_DEFAULTS.density_kg_per_l,
  tempRef_c = FUEL_DEFAULTS.tempRef_c,
  beta_per_c = FUEL_DEFAULTS.beta_per_c,
} = {}) {
  return density_kg_per_l * (1 - beta_per_c * (temp_c - tempRef_c));
}

export function fuelMass(volume_l, temp_c, fuel) {
  return volume_l * density(temp_c, fuel);
}

/* ---------- the lap ---------- */

/* Per lap i within a stint. Fuel mass is taken at the start of the
   lap: the car is heaviest when it crosses the line, and a lap is
   scored by the line it starts from. */
export function lapTime(pace, { stintLap, stintLaps, fuelMass_kg }) {
  const {
    baseLap_s = 0,
    fuelSensitivity_s_per_kg = MODEL_DEFAULTS.fuelSensitivity_s_per_kg,
    degLinear_s_per_lap = 0,
    degOffset_s = 0,
    outLapDelta_s = 0,
    inLapDelta_s = 0,
  } = pace;

  return baseLap_s
    + fuelSensitivity_s_per_kg * fuelMass_kg
    + degOffset_s + degLinear_s_per_lap * stintLap
    + (stintLap === 0 ? outLapDelta_s : 0)
    + (stintLap === stintLaps - 1 ? inLapDelta_s : 0);
}

/* Back-computes the fuel sensitivity from two laps of known fuel mass.

       k = (t1 - t2) / (m1 - m2)

   Both laps must already be corrected for degradation and for
   anything else that moved between them, which is the hard part and
   not this function's job. What this does is stop the number being
   typed from memory: 0.030 s/kg is a plausible figure for a
   medium-length circuit and a wrong one for a short or a
   power-limited lap, and it scales with both. */
export function fuelSensitivityFrom(a, b) {
  const dm = a.fuelMass_kg - b.fuelMass_kg;
  if (!Number.isFinite(dm) || Math.abs(dm) < 1e-9) return null;
  return (a.lapTime_s - b.lapTime_s) / dm;
}

/* ---------- pit loss ----------

   Computed, never asked for as one number. A team that types "22
   seconds" has folded the lane, the stop and the entry together and
   can no longer see which of the three moved when the number does. */

export function stationaryTime({
  tyreChange_s = 0, refuelVolume_l = 0, refuelRate_l_per_s = 0,
} = {}) {
  const fuelling = refuelRate_l_per_s > 0 ? refuelVolume_l / refuelRate_l_per_s : 0;
  return Math.max(tyreChange_s, fuelling);
}

export function pitLoss({
  laneLength_m = 0,
  speedLimit_kph = 0,
  racingSpeed_kph = 0,
  stationary_s = 0,
  entryExitLoss_s = 0,
  scPaceFactor = 1,
} = {}) {
  const lane_s = speedLimit_kph > 0 ? laneLength_m / (speedLimit_kph / 3.6) : 0;
  // Under safety car the racing-speed reference collapses, which is the
  // whole reason a stop under SC is cheap. Scale the reference, not the
  // lane: the lane limit does not change.
  const racing_s = racingSpeed_kph > 0
    ? laneLength_m / ((racingSpeed_kph * scPaceFactor) / 3.6)
    : 0;
  return {
    lane_s,
    racing_s,
    stationary_s,
    entryExitLoss_s,
    total_s: (lane_s - racing_s) + stationary_s + entryExitLoss_s,
  };
}

/* ---------- stint length ----------

   Two independent constraints, and which one binds decides the
   opposite thing. A fuel-limited stint gets shorter by lifting and
   coasting; a tyre-limited one does not, and lifting only makes it
   slower. Never leave that ambiguous. */
export function stintCapacity({
  tankCapacity_l = 0,
  burn_l_per_lap = 0,
  maxLapsPerSet = 0,
  margin = MODEL_DEFAULTS.margin,
  reserve_l = MODEL_DEFAULTS.reserve_l,
} = {}) {
  const fuelLaps = burn_l_per_lap > 0
    ? Math.floor(tankCapacity_l / burn_l_per_lap)
    : Infinity;

  /* What the tank holds and what a stint can be planned to are two
     different numbers, and the gap between them is the margin and the
     reserve. A plan built on the first will not fit in the tank once
     the second is added, which is a validation error rather than a
     rounding difference — so both are reported and the planner uses
     the smaller. */
  const fuelLapsPlannable = burn_l_per_lap > 0
    ? Math.floor(Math.max(0, tankCapacity_l - reserve_l) / (burn_l_per_lap * (1 + margin)))
    : Infinity;

  const tyreLaps = maxLapsPerSet > 0 ? maxLapsPerSet : Infinity;

  const laps = Math.min(fuelLaps, tyreLaps);
  let binding = 'unconstrained';
  if (fuelLaps < tyreLaps) binding = 'fuel';
  else if (tyreLaps < fuelLaps) binding = 'tyre';
  else if (Number.isFinite(fuelLaps)) binding = 'both';

  const plannable = Math.min(fuelLapsPlannable, tyreLaps);

  return {
    laps: Number.isFinite(laps) ? laps : 0,
    plannable: Number.isFinite(plannable) ? plannable : 0,
    fuelLaps, fuelLapsPlannable, tyreLaps, binding,
  };
}

/* ---------- race distance ----------

   For a timed race, accumulate modelled laps rather than dividing the
   duration by the base lap. The base lap is the fastest lap of the
   race and almost no lap is it: with a full tank and worn tyres the
   difference runs to several laps over an hour, and being wrong by
   one lap is the difference between finishing and stopping on the
   last corner. */
export function raceDistance(format, lapTimeAt) {
  if (format.mode === 'laps') {
    const laps = Math.max(0, Math.round(Number(format.laps) || 0));
    return { laps, lapsWithinTime: laps, elapsed_s: null, mode: 'laps' };
  }

  const duration = Number(format.duration_s) || 0;
  let elapsed = 0;
  let n = 0;
  // A lap that would take the clock past the flag is the lap in
  // progress when the flag falls; it is not a lap completed within
  // the time.
  const cap = 10000;
  while (n < cap) {
    const t = lapTimeAt(n);
    if (!Number.isFinite(t) || t <= 0) break;
    if (elapsed + t > duration) break;
    elapsed += t;
    n += 1;
  }

  // The chequered flag falls when the leader next crosses the line, so
  // the lap in progress at the flag is run to its end. Landing exactly
  // on the flag is the one case where there is no lap in progress.
  const exact = Math.abs(elapsed - duration) < 1e-9;
  const plusOne = format.plusOneLap !== false && !exact ? 1 : 0;

  return { laps: n + plusOne, lapsWithinTime: n, elapsed_s: elapsed, mode: 'time' };
}

/* ---------- fuel load ----------

   Fill what the stint needs and no more. Fuel carried is fuel paid
   for twice: once at the pump and once at 0.03 s per kilogram per
   lap for the whole stint. */
export function fuelLoad({
  stintLaps = 0,
  burn_l_per_lap = 0,
  margin = MODEL_DEFAULTS.margin,
  reserve_l = MODEL_DEFAULTS.reserve_l,
  formationLap = false,
} = {}) {
  const laps = stintLaps + (formationLap ? 1 : 0);
  return laps * burn_l_per_lap * (1 + margin) + reserve_l;
}

/* ---------- one candidate strategy ----------

   Runs the whole race lap by lap, so the total is the sum of laps
   actually modelled rather than an average multiplied by a count. */
export function simulate(state, stintLaps) {
  const { car, pace, tyres, format } = state;
  const fuel = fuelDescriptor(state);
  const margin = num(car.margin, MODEL_DEFAULTS.margin);
  const reserve = num(car.reserve_l, MODEL_DEFAULTS.reserve_l);
  const burn = num(car.burn_l_per_lap, 0);
  const tank = num(car.tankCapacity_l, 0);
  const maxLapsPerSet = num(tyres?.maxLapsPerSet, 0);

  const stints = [];
  let total = 0;
  let lap = 0;

  stintLaps.forEach((laps, s) => {
    const formationLap = s === 0 && !!format.formationLap;
    const load = fuelLoad({ stintLaps: laps, burn_l_per_lap: burn, margin, reserve_l: reserve, formationLap });
    const startVolume = load - (formationLap ? burn : 0);

    let stintTime = 0;
    for (let i = 0; i < laps; i++) {
      const volume = Math.max(0, startVolume - i * burn);
      stintTime += lapTime(pace, {
        stintLap: i,
        stintLaps: laps,
        fuelMass_kg: fuelMass(volume, num(car.fuelTemp_c, fuel.tempRef_c), fuel),
      });
    }

    const fuelLaps = burn > 0
      ? Math.floor(Math.max(0, tank - reserve) / (burn * (1 + margin)))
      : Infinity;
    const tyreLaps = maxLapsPerSet > 0 ? maxLapsPerSet : Infinity;
    let binding = 'unconstrained';
    if (laps >= fuelLaps && fuelLaps <= tyreLaps) binding = 'fuel';
    else if (laps >= tyreLaps && tyreLaps < fuelLaps) binding = 'tyre';
    else if (Number.isFinite(fuelLaps) || Number.isFinite(tyreLaps)) binding = 'slack';

    stints.push({
      n: s + 1,
      laps,
      fromLap: lap + 1,
      toLap: lap + laps,
      load_l: load,
      loadMass_kg: fuelMass(load, num(car.fuelTemp_c, fuel.tempRef_c), fuel),
      time_s: stintTime,
      binding,
      overTank: load > tank + 1e-9,
    });
    total += stintTime;
    lap += laps;
  });

  const stops = stintLaps.length - 1;
  const loss = candidatePitLoss(state, stints);
  total += stops * loss.total_s;

  return { stints, stops, pitLoss_s: loss.total_s, pitLoss: loss, total_s: total };
}

function candidatePitLoss(state, stints) {
  const { pit, car } = state;
  // A stop that refuels is as long as the fuelling takes; a stop that
  // only changes tyres is as long as the tyres take. The larger of the
  // two is what the car is stationary for.
  const biggestLoad = stints.reduce((a, s) => Math.max(a, s.load_l), 0);
  const stationary = num(pit.stationary_s, 0) || stationaryTime({
    tyreChange_s: num(pit.tyreChange_s, 0),
    refuelVolume_l: car.refuelAllowed ? biggestLoad : 0,
    refuelRate_l_per_s: num(car.refuelRate_l_per_s, 0),
  });
  return pitLoss({
    laneLength_m: num(pit.laneLength_m, 0),
    speedLimit_kph: num(pit.speedLimit_kph, 0),
    racingSpeed_kph: num(pit.racingSpeed_kph, 0),
    stationary_s: stationary,
    entryExitLoss_s: num(pit.entryExitLoss_s, 0),
  });
}

/* ---------- lap distributions ---------- */

/* As even as the arithmetic allows, remainder to the earlier stints:
   a long stint late is a long stint on a light car, which is the
   cheaper place to put it. */
export function evenSplit(raceLaps, stints) {
  const base = Math.floor(raceLaps / stints);
  const extra = raceLaps - base * stints;
  return Array.from({ length: stints }, (_, i) => base + (i < extra ? 1 : 0));
}

/* First stint at capacity, the rest even. Buys track position at the
   cost of running the heaviest laps longest. */
export function frontLoaded(raceLaps, stints, capacity) {
  if (stints < 2) return [raceLaps];
  const first = Math.min(capacity, raceLaps - (stints - 1));
  const rest = evenSplit(raceLaps - first, stints - 1);
  return [first, ...rest];
}

/* ---------- enumeration ----------

   Every legal stop count, two distributions each, scored and sorted.
   Not one optimum: the field and the gaps between its entries, which
   is what an engineer is actually deciding between at 0.4 s apart. */
export function enumerate(state) {
  const raceLaps = state.derived.raceLaps;
  // Planned against what fits with the margin and the reserve, not
  // against what the tank holds brim-full.
  const capacity = state.derived.capacity.plannable;
  if (!raceLaps || !capacity) return [];

  const floorStops = Math.max(
    Math.ceil(raceLaps / capacity) - 1,
    Math.max(0, Math.round(num(state.rules?.minStops, 0))),
  );
  const maxStints = Math.round(num(state.rules?.maxStints, 0));

  const out = [];
  for (let stops = floorStops; stops <= floorStops + 2; stops++) {
    const stints = stops + 1;
    if (maxStints > 0 && stints > maxStints) continue;
    // Enough sets to change at every stop, if the tool has been told
    // how many there are.
    const sets = Math.round(num(state.tyres?.setsAvailable, 0));
    const setsShort = sets > 0 && stints > sets;

    for (const [shape, laps] of [
      ['even', evenSplit(raceLaps, stints)],
      ['front-loaded', frontLoaded(raceLaps, stints, capacity)],
    ]) {
      if (laps.some(l => l <= 0)) continue;
      if (stints > 1 && shape === 'front-loaded' &&
          laps.join() === evenSplit(raceLaps, stints).join()) continue;

      const run = simulate(state, laps);
      run.shape = shape;
      run.id = `${stops}-${shape}`;
      run.legal = [];
      if (laps.some(l => l > capacity)) {
        run.legal.push(`Stint of ${Math.max(...laps)} laps exceeds the ${capacity}-lap limit.`);
      }
      if (setsShort) {
        run.legal.push(`${stints} stints against ${sets} tyre sets.`);
      }
      const windows = windowCheck(state, laps);
      run.legal.push(...windows);
      out.push(run);
    }
  }

  out.sort((a, b) => a.total_s - b.total_s);
  const best = out.find(c => !c.legal.length) || out[0];
  for (const c of out) c.delta_s = best ? c.total_s - best.total_s : 0;
  return out;
}

/* A mandatory window is satisfied by a stop inside it. A candidate
   that misses one is still shown, and still scored, and marked: the
   time it would have taken is the reason the window costs what it
   costs. */
function windowCheck(state, laps) {
  const windows = (state.rules?.mandatoryWindow || [])
    .filter(w => Number.isFinite(Number(w.openLap)) && Number.isFinite(Number(w.closeLap)));
  if (!windows.length) return [];

  const stopLaps = [];
  let at = 0;
  for (let i = 0; i < laps.length - 1; i++) { at += laps[i]; stopLaps.push(at); }

  return windows
    .filter(w => !stopLaps.some(l => l >= Number(w.openLap) && l <= Number(w.closeLap)))
    .map(w => `No stop inside the mandatory window, laps ${w.openLap}-${w.closeLap}.`);
}

/* ---------- the saving that removes a stop ----------

   The question every engineer actually asks, and the one a strategy
   table does not answer on its own. */
export function savingToRemoveStop(state, stints) {
  const raceLaps = state.derived.raceLaps;
  const burn = num(state.car.burn_l_per_lap, 0);
  const tank = num(state.car.tankCapacity_l, 0);
  const liftCoast = num(state.pace.liftCoastCost_s_per_pct, MODEL_DEFAULTS.liftCoastCost_s_per_pct);
  const pitLoss_s = state.derived.pitLoss.total_s;
  if (!raceLaps || !burn || !tank) return null;

  const requiredBurn_l_per_lap = tank * stints / raceLaps;
  const savingFraction = 1 - requiredBurn_l_per_lap / burn;
  const savingPct = savingFraction * 100;
  const saving_l_per_lap = burn - requiredBurn_l_per_lap;
  const lapTimeCost_s = savingPct * liftCoast;
  const netGain_s = pitLoss_s - lapTimeCost_s * raceLaps;

  return {
    stints,
    requiredBurn_l_per_lap,
    savingPct,
    // The driver is told a percentage and the ECU is told litres per
    // lap. Neither number is the other one, and the pit wall has to
    // say both out loud.
    saving_l_per_lap,
    lapTimeCost_s,
    netGain_s,
    needed: savingFraction > 0,
  };
}

/* ---------- undercut and overcut ----------

   Over n laps of offset, our fresh tyres against a rival's aged ones.
   The per-lap advantage is the rival's degradation at their stint lap
   against ours at a stint just started, and the out lap is paid once. */
export function undercut(state, {
  rivalStintLap = 0, offsets = [1, 2, 3, 4, 5], pitLossDelta_s = 0,
} = {}) {
  const deg = num(state.pace.degLinear_s_per_lap, 0);
  const outLap = num(state.pace.outLapDelta_s, 0);
  const inLap = num(state.pace.inLapDelta_s, 0);

  const rows = offsets.map(n => {
    let gain = 0;
    for (let j = 0; j < n; j++) {
      const rivalPace = deg * (rivalStintLap + j);
      const ourPace = deg * j + (j === 0 ? outLap : 0);
      gain += rivalPace - ourPace;
    }
    const net = gain - inLap - pitLossDelta_s;
    return { offset: n, gain_s: gain, net_s: net, pays: net > 0 };
  });

  // Where the sign changes. With linear degradation the advantage
  // accumulates, so this is the offset from which the undercut starts
  // paying, not one at which it stops — see the README.
  let crossover = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].pays && (i === 0 || !rows[i - 1].pays)) { crossover = rows[i].offset; break; }
  }
  return { rows, crossover };
}

/* ---------- validation ----------

   An error is a strategy that cannot be run. A warning is one that
   can be run and probably should not be. A tank that will not hold
   the fuel the plan calls for is the first, not the second. */
export function validate(state, candidates) {
  const issues = [];
  const push = (severity, message) => issues.push({ severity, message });

  const tank = num(state.car.tankCapacity_l, 0);
  const burn = num(state.car.burn_l_per_lap, 0);

  if (tank <= 0) push('error', 'Tank capacity is not set. Every fuel number below depends on it.');
  if (burn <= 0) push('error', 'Fuel burn per lap is not set. Measure it over a full stint, not a lap.');
  if (num(state.pace.baseLap_s, 0) <= 0) push('error', 'Base lap time is not set.');

  for (const c of candidates || []) {
    for (const s of c.stints) {
      if (s.overTank) {
        push('error',
          `${c.stops} stop${c.stops === 1 ? '' : 's'}${c.shape ? `, ${c.shape}` : ''}: stint ${s.n} needs ` +
          `${s.load_l.toFixed(1)} l in a ${tank.toFixed(1)} l tank. ` +
          `The strategy cannot be run as planned.`);
      }
    }
  }

  const cap = state.derived.capacity;
  if (cap.binding === 'tyre' && Number.isFinite(cap.fuelLaps)) {
    push('note',
      `Stints are tyre-limited at ${cap.tyreLaps} laps; the tank would carry ${cap.fuelLaps}. ` +
      `Lifting and coasting buys nothing here.`);
  }
  if (cap.binding === 'fuel' && Number.isFinite(cap.tyreLaps)) {
    push('note',
      `Stints are fuel-limited at ${cap.fuelLaps} laps; the tyres would last ${cap.tyreLaps}. ` +
      `A saving of ${(100 / cap.fuelLaps).toFixed(1)}% per lap buys roughly one more lap.`);
  }
  if (Number.isFinite(cap.fuelLaps) && cap.fuelLapsPlannable < cap.fuelLaps) {
    push('note',
      `The tank holds ${cap.fuelLaps} laps of fuel brim-full and ` +
      `${cap.fuelLapsPlannable} once the ${(num(state.car.margin, MODEL_DEFAULTS.margin) * 100).toFixed(0)}% margin ` +
      `and ${num(state.car.reserve_l, MODEL_DEFAULTS.reserve_l)} l reserve are in it. ` +
      `Stints are planned to the second figure.`);
  }

  const sens = num(state.pace.fuelSensitivity_s_per_kg, MODEL_DEFAULTS.fuelSensitivity_s_per_kg);
  if (sens < 0.015 || sens > 0.060) {
    push('warning',
      `Fuel sensitivity of ${sens.toFixed(3)} s/kg is outside the 0.020-0.050 range ` +
      `most circuits fall in. It is a measured quantity — check it against two laps.`);
  }

  return issues;
}

/* ---------- the whole computation ----------

   One call, so the UI never assembles a half-computed state and the
   tests never assert against one. */
export function compute(state) {
  const s = { ...state, derived: {} };
  const fuel = fuelDescriptor(s);
  const car = s.car, pace = s.pace;

  const burn = num(car.burn_l_per_lap, 0);
  const margin = num(car.margin, MODEL_DEFAULTS.margin);
  const reserve = num(car.reserve_l, MODEL_DEFAULTS.reserve_l);

  s.derived.density_kg_per_l = density(num(car.fuelTemp_c, fuel.tempRef_c), fuel);
  s.derived.capacity = stintCapacity({
    tankCapacity_l: num(car.tankCapacity_l, 0),
    burn_l_per_lap: burn,
    maxLapsPerSet: num(s.tyres?.maxLapsPerSet, 0),
    margin, reserve,
  });

  /* Race distance and the stint plan each depend on the other: the
     laps decide the fuel load, the load decides the lap times, the
     lap times decide the laps. Iterate to a fixed point rather than
     dividing the duration by the base lap and calling it done. */
  let laps = seedLaps(s);
  for (let pass = 0; pass < 12; pass++) {
    const plan = laps > 0 && s.derived.capacity.plannable > 0
      ? evenSplit(laps, Math.max(1, Math.ceil(laps / s.derived.capacity.plannable)))
      : [laps];
    const next = raceDistance(s.format, lapTimeIndex(s, plan, fuel));
    if (next.laps === laps) { s.derived.race = next; break; }
    laps = next.laps;
    s.derived.race = next;
  }
  s.derived.raceLaps = s.derived.race?.laps ?? laps;

  s.derived.pitLoss = pitLoss({
    laneLength_m: num(s.pit.laneLength_m, 0),
    speedLimit_kph: num(s.pit.speedLimit_kph, 0),
    racingSpeed_kph: num(s.pit.racingSpeed_kph, 0),
    stationary_s: num(s.pit.stationary_s, 0) || stationaryTime({
      tyreChange_s: num(s.pit.tyreChange_s, 0),
      refuelVolume_l: car.refuelAllowed ? num(car.tankCapacity_l, 0) : 0,
      refuelRate_l_per_s: num(car.refuelRate_l_per_s, 0),
    }),
    entryExitLoss_s: num(s.pit.entryExitLoss_s, 0),
  });

  // The same stop under safety car, for comparison. Showing one number
  // hides the only reason the timing of a stop is a decision at all.
  s.derived.pitLossSC = pitLoss({
    laneLength_m: num(s.pit.laneLength_m, 0),
    speedLimit_kph: num(s.pit.speedLimit_kph, 0),
    racingSpeed_kph: num(s.pit.racingSpeed_kph, 0),
    stationary_s: s.derived.pitLoss.stationary_s,
    entryExitLoss_s: num(s.pit.entryExitLoss_s, 0),
    scPaceFactor: scFactor(s),
  });

  s.derived.candidates = enumerate(s);

  /* The headline pit loss above assumed a brim-full refuel, because
     the stint loads did not exist yet. They do now, so the figure the
     summary shows is the one the leading candidate actually pays. */
  const lead = s.derived.candidates.find(c => !c.legal.length) || s.derived.candidates[0];
  if (lead) {
    s.derived.pitLoss = lead.pitLoss;
    s.derived.pitLossSC = pitLoss({
      laneLength_m: num(s.pit.laneLength_m, 0),
      speedLimit_kph: num(s.pit.speedLimit_kph, 0),
      racingSpeed_kph: num(s.pit.racingSpeed_kph, 0),
      stationary_s: lead.pitLoss.stationary_s,
      entryExitLoss_s: num(s.pit.entryExitLoss_s, 0),
      scPaceFactor: scFactor(s),
    });
  }

  s.derived.issues = validate(s, s.derived.candidates);
  s.derived.saving = savingToRemoveStop(
    s, Math.max(1, (s.derived.candidates[0]?.stops ?? 0) + 1 - 1) || 1);
  s.derived.savingByStints = [1, 2, 3, 4]
    .map(n => savingToRemoveStop(s, n))
    .filter(Boolean);
  s.derived.undercut = undercut(s, {
    rivalStintLap: Math.round(num(pace.rivalStintLap, 10)),
  });

  return s;
}

/* A first guess at the lap count, only good enough to start the
   iteration from. */
function seedLaps(s) {
  if (s.format.mode === 'laps') return Math.round(num(s.format.laps, 0));
  const base = num(s.pace.baseLap_s, 0);
  return base > 0 ? Math.ceil(num(s.format.duration_s, 0) / base) : 0;
}

/* Maps a race-lap index onto its stint and stint-lap, so the timed
   race accumulates the same lap the strategy table would score. */
function lapTimeIndex(s, plan, fuel) {
  const burn = num(s.car.burn_l_per_lap, 0);
  const margin = num(s.car.margin, MODEL_DEFAULTS.margin);
  const reserve = num(s.car.reserve_l, MODEL_DEFAULTS.reserve_l);
  const temp = num(s.car.fuelTemp_c, fuel.tempRef_c);

  const bounds = [];
  let at = 0;
  for (const laps of plan) { bounds.push([at, at + laps, laps]); at += laps; }

  return (i) => {
    const found = bounds.find(([a, b]) => i >= a && i < b) || bounds[bounds.length - 1];
    if (!found) return num(s.pace.baseLap_s, 0);
    const [start, , laps] = found;
    const stintLap = i - start;
    const formationLap = start === 0 && !!s.format.formationLap;
    const load = fuelLoad({ stintLaps: laps, burn_l_per_lap: burn, margin, reserve_l: reserve, formationLap });
    const volume = Math.max(0, load - (formationLap ? burn : 0) - stintLap * burn);
    return lapTime(s.pace, {
      stintLap, stintLaps: laps, fuelMass_kg: fuelMass(volume, temp, fuel),
    });
  };
}

function scFactor(s) {
  const first = (s.sc?.assumed || [])[0];
  return first && Number(first.paceFactor) > 0 ? Number(first.paceFactor) : 0.6;
}

function fuelDescriptor(state) {
  return {
    density_kg_per_l: num(state.car.fuelDensity_kg_per_l, FUEL_DEFAULTS.density_kg_per_l),
    tempRef_c: num(state.car.fuelTempRef_c, FUEL_DEFAULTS.tempRef_c),
    beta_per_c: num(state.car.fuelBeta_per_c, FUEL_DEFAULTS.beta_per_c),
  };
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== null ? n : fallback;
}

export { num as toNumber };
