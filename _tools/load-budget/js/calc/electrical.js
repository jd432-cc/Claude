/* =============================================================
   TheRacingData — Load Budget & Voltage Drop
   The model. Pure functions, no DOM, importable by Node.

   Sizes conductors, fuses and the charging system for a race car
   loom, and proves the numbers rather than asserting them. Every
   figure below can be checked by hand from the inputs printed
   beside it, which is the point: a loom nobody can check is a
   loom nobody will argue with when it is wrong.

   SI throughout, with the two units the trade actually uses:
   square millimetres for conductor area and metres for length.
   Amps, volts, ohms and degrees Celsius are themselves.
   ============================================================= */

export const DEFAULTS = {
  resistivity_ohm_m_at_20c: 1.724e-8,   // annealed copper, IEC 60028
  alpha_per_c: 0.00393,
  copperDensity_g_per_cm3: 8.96,
  limits: {
    generalDrop_pct: 3,
    criticalDrop_pct: 1,
    criticalDrop_v: 0.25,
    crankingDrop_pct: 10,
    fuseOverLoad: 1.25,
    fuseOverInrushLoad: 1.5,
  },
};

/* ---------- resistance ----------

   Copper gets worse when it gets hot, by about 0.4% per degree, and
   a loom in a transmission tunnel is nowhere near 20 °C. Sizing at
   the bench temperature is how a circuit that passed on paper drops
   a volt on the car. */
export function resistivity(temp_c, {
  rho20 = DEFAULTS.resistivity_ohm_m_at_20c,
  alpha = DEFAULTS.alpha_per_c,
} = {}) {
  return rho20 * (1 + alpha * (temp_c - 20));
}

/* A dedicated return is out and back through the same conductor
   size, so the loop is twice the run. A chassis return is out
   through the wire and back through the car, and what the car adds
   is a measured property of that car — a bolted, painted, corroded
   joint is not something a formula knows. It goes in as
   groundReturn_mohm and the tool says so in the field's help. */
export function resistance({
  csa_mm2 = 0,
  length_m = 0,
  dedicatedReturn = true,
  groundReturn_mohm = 0,
  temp_c = 20,
  rho20 = DEFAULTS.resistivity_ohm_m_at_20c,
  alpha = DEFAULTS.alpha_per_c,
} = {}) {
  if (!(csa_mm2 > 0)) return { R_ohm: Infinity, loopLength_m: 0, rho: 0, chassis_ohm: 0 };
  const rho = resistivity(temp_c, { rho20, alpha });
  const loopLength_m = dedicatedReturn ? 2 * length_m : length_m;
  const conductor_ohm = rho * loopLength_m / (csa_mm2 * 1e-6);
  const chassis_ohm = dedicatedReturn ? 0 : groundReturn_mohm / 1000;
  return {
    rho,
    loopLength_m,
    conductor_ohm,
    chassis_ohm,
    R_ohm: conductor_ohm + chassis_ohm,
    // The return leg on its own. Shared grounds are where looms
    // actually fail, and a single loop figure hides them.
    return_ohm: dedicatedReturn ? conductor_ohm / 2 : chassis_ohm,
  };
}

/* ---------- voltage drop ---------- */
export function voltageDrop(current_a, R_ohm, systemV) {
  const dV = current_a * R_ohm;
  return { dV, pct: systemV > 0 ? (dV / systemV) * 100 : Infinity };
}

/* ---------- ampacity ----------

   The free-air rating is the starting point and almost never the
   answer. Ambient takes some of it and the bundle takes more. */
export function tempDerate(rating_c, ambient_c) {
  if (!(rating_c > 20)) return 0;
  const num = rating_c - ambient_c;
  if (num <= 0) return 0;
  return Math.sqrt(num / (rating_c - 20));
}

export function bundleDerate(bundleSize, bands) {
  const n = Math.max(1, Math.round(bundleSize || 1));
  const table = bands || [
    { upTo: 2, factor: 1.00 },
    { upTo: 5, factor: 0.80 },
    { upTo: 15, factor: 0.70 },
    { upTo: null, factor: 0.50 },
  ];
  for (const band of table) {
    if (band.upTo == null || n <= band.upTo) return band.factor;
  }
  return table[table.length - 1].factor;
}

export function ampacity({ csa_mm2, insulation, ambient_c = 40, bundleSize = 1 }, spec) {
  const base = baseAmpacity(csa_mm2, insulation, spec);
  const rating_c = insulationRating(insulation, spec);
  const kTemp = tempDerate(rating_c, ambient_c);
  const kBundle = bundleDerate(bundleSize, spec?.bundleDerating?.bands);
  return {
    base, rating_c, kTemp, kBundle,
    allowed: base * kTemp * kBundle,
  };
}

/* The seeded table is indexed by exact conductor size. A size between
   two rows is read off the smaller one: rounding an ampacity up is
   the one direction that starts fires. */
export function baseAmpacity(csa_mm2, insulation, spec) {
  const rows = spec?.ampacity?.byCsa || [];
  if (!rows.length || !(csa_mm2 > 0)) return 0;
  const sorted = [...rows].sort((a, b) => a.csa_mm2 - b.csa_mm2);
  let chosen = null;
  for (const row of sorted) {
    if (row.csa_mm2 <= csa_mm2 + 1e-9) chosen = row;
  }
  if (!chosen) return 0;
  return Number(chosen[insulation]) || 0;
}

export function insulationRating(insulation, spec) {
  return Number(spec?.insulations?.find(i => i.id === insulation)?.rating_c) || 105;
}

/* ---------- conductor temperature ----------

   Either measured, or estimated from how hard the wire is working
   against its derated rating. The estimate is a square law because
   heating is, and it is an estimate: the tool prints which of the
   two it used beside every drop it computes from it. */
export function conductorTemp({ load_a, allowed_a, ambient_c, rating_c, measured_c }) {
  if (Number.isFinite(measured_c) && measured_c !== '' && measured_c !== null) {
    return { temp_c: Number(measured_c), basis: 'measured' };
  }
  if (!(allowed_a > 0)) return { temp_c: ambient_c, basis: 'ambient' };
  const ratio = Math.min(2, load_a / allowed_a);
  const rise = (rating_c - ambient_c) * ratio * ratio;
  return { temp_c: ambient_c + rise, basis: 'estimated from the loading ratio' };
}

/* ---------- fuse ----------

   Two directions, and they fail differently. A fuse above the
   conductor rating means the wire is the fuse, which is a fire. A
   fuse below 1.25 times the continuous load is a nuisance trip, and
   a nuisance trip mid-stint is a retirement. */
export function fuseCheck({
  load_a = 0, duty_pct = 100, klass = 'continuous',
  fuse_a = 0, fuseType = 'fast', allowed_a = 0,
  inrush_a = 0, inrush_ms = 0,
}, limits = DEFAULTS.limits) {
  const out = { minimum_a: 0, maximum_a: allowed_a, issues: [] };
  if (!(fuse_a > 0)) return out;

  const factor = klass === 'inrush' ? limits.fuseOverInrushLoad : limits.fuseOverLoad;
  out.minimum_a = load_a * factor;

  if (fuse_a < out.minimum_a - 1e-9) {
    out.issues.push({
      severity: 'warning', kind: 'fuse-low',
      message: `${fuse_a} A fuse against a ${load_a} A load needs to be at least ` +
               `${out.minimum_a.toFixed(1)} A (${factor}x). Below that it is a nuisance trip mid-stint.`,
    });
  }
  if (allowed_a > 0 && fuse_a > allowed_a + 1e-9) {
    out.issues.push({
      severity: 'error', kind: 'fuse-high',
      message: `${fuse_a} A fuse on a conductor rated ${allowed_a.toFixed(1)} A after derating. ` +
               `The wire is the fuse. This is a fire, not a margin.`,
    });
  }

  if (klass === 'inrush' && inrush_a > 0 && inrush_ms > 0) {
    const event = inrush_a * inrush_a * (inrush_ms / 1000);
    const melt_s = meltTime(inrush_a, fuse_a, fuseType);
    out.inrush = { i2t: event, melt_s, ratio: inrush_a / fuse_a };
    if (melt_s < (inrush_ms / 1000) * 2) {
      out.issues.push({
        severity: 'warning', kind: 'inrush',
        message: `Inrush of ${inrush_a} A for ${inrush_ms} ms against a ${fuseType} ` +
                 `${fuse_a} A fuse: modelled melting time ${(melt_s * 1000).toFixed(0)} ms. ` +
                 `Marginal. Check the fuse's own time-current curve.`,
      });
    }
  }
  return out;
}

/* A coarse time-current model, not a datasheet. A fast fuse opens at
   twice rating in about a second; a slow one takes five times as
   long. Enough to catch a motor that will blow its fuse on every
   start, and not enough to certify one that will not. */
export function meltTime(current_a, fuse_a, fuseType = 'fast') {
  if (!(fuse_a > 0) || !(current_a > fuse_a)) return Infinity;
  const k = fuseType === 'slow' ? 20 : 4;
  const ratio = current_a / fuse_a;
  return k / (ratio * ratio);
}

/* ---------- charging budget ---------- */
export function chargingBudget(circuits, supply = {}) {
  const continuousDraw_a = circuits.reduce(
    (a, c) => a + (Number(c.load_a) || 0) * ((Number(c.duty_pct) || 0) / 100), 0);
  const peakDraw_a = circuits.reduce((a, c) => a + (Number(c.load_a) || 0), 0);

  const race = Number(supply.alternator_a_at_race) || 0;
  const idle = Number(supply.alternator_a_at_idle) || 0;
  const capacity = Number(supply.batteryCapacity_ah) || 0;
  const reserve = (Number(supply.batteryReserve_pct) || 0) / 100;

  /* The alternator-failure endurance figure. For most club and
     endurance entries this is the number that decides whether an
     alternator failure is a retirement or a finish, and almost
     nobody has it written down. */
  const timeToFlat_min = continuousDraw_a > 0
    ? (capacity * (1 - reserve) / continuousDraw_a) * 60
    : Infinity;

  return {
    continuousDraw_a, peakDraw_a,
    headroom_a: race - continuousDraw_a,
    idleHeadroom_a: idle - continuousDraw_a,
    timeToFlat_min,
  };
}

/* ---------- loom mass ----------

   Weight is a performance parameter and a loom is one of the few
   places it is thrown away casually: a car carrying 2.08 mm2
   everywhere because the drum was open is carrying kilograms it
   does not need. */
export function loomMass(circuits, spec) {
  const density = Number(spec?.conductors?.[0]?.density_g_per_cm3)
    || DEFAULTS.copperDensity_g_per_cm3;

  const byGroup = new Map();
  let total_g = 0;

  for (const c of circuits) {
    const csa = Number(c.csa_mm2) || 0;
    const length = Number(c.length_m) || 0;
    const runs = c.dedicatedReturn ? 2 : 1;
    const wall = Number(
      spec?.insulations?.find(i => i.id === c.insulation)?.wall_g_per_m_per_mm2) || 0;

    // 1 mm2 x 1 m is 1 cm3.
    const copper_g = csa * length * runs * density;
    const insulation_g = csa * length * runs * wall;
    const g = copper_g + insulation_g;

    total_g += g;
    const key = c.group || 'ungrouped';
    byGroup.set(key, (byGroup.get(key) || 0) + g);
  }

  return {
    total_g,
    total_kg: total_g / 1000,
    byGroup: [...byGroup].map(([group, g]) => ({ group, g })),
  };
}

/* ---------- ground scheme ----------

   A topology check on the circuit list, and it catches the single
   most common cause of noisy telemetry: a sensor return sharing a
   stud with something that switches amps. A sensor reference is a
   measurement, and every millivolt the injector puts on that stud
   is an error in it. */
const NOISY = new Set(['ignition', 'injector', 'motor', 'lighting', 'heater', 'starter']);
const QUIET = new Set(['sensor', 'signal', 'logic']);

export function groundScheme(circuits) {
  const nodes = new Map();
  for (const c of circuits) {
    if (c.dedicatedReturn) continue;
    const node = (c.groundNode || '').trim() || 'chassis';
    if (!nodes.has(node)) nodes.set(node, []);
    nodes.get(node).push(c);
  }

  const issues = [];
  for (const [node, members] of nodes) {
    const quiet = members.filter(c => QUIET.has(c.kind) || c.critical);
    const noisy = members.filter(c => NOISY.has(c.kind));
    if (quiet.length && noisy.length) {
      issues.push({
        severity: 'error', kind: 'ground-shared', node,
        circuits: [...quiet, ...noisy].map(c => c.id),
        message: `Ground node "${node}": ${quiet.map(c => c.name).join(', ')} ` +
                 `${quiet.length > 1 ? 'return' : 'returns'} through the same point as ` +
                 `${noisy.map(c => c.name).join(', ')}. Every millivolt the second puts ` +
                 `on that stud is measurement error in the first.`,
      });
    }
  }
  return { nodes: [...nodes.keys()], issues };
}

/* ---------- one circuit, end to end ---------- */
export function evaluateCircuit(circuit, system, spec, limits = DEFAULTS.limits) {
  const conductor = spec?.conductors?.find(c => c.id === circuit.conductor)
    || spec?.conductors?.[0] || {};
  const rho20 = Number(conductor.resistivity_ohm_m_at_20c) || DEFAULTS.resistivity_ohm_m_at_20c;
  const alpha = Number(conductor.alpha_per_c) || DEFAULTS.alpha_per_c;

  const load_a = Number(circuit.load_a) || 0;
  const csa_mm2 = Number(circuit.csa_mm2) || 0;
  const ambient_c = Number(system.ambient_c) || 20;

  const amps = ampacity({
    csa_mm2, insulation: circuit.insulation,
    ambient_c, bundleSize: Number(circuit.bundleSize) || 1,
  }, spec);

  const temp = conductorTemp({
    load_a, allowed_a: amps.allowed, ambient_c,
    rating_c: amps.rating_c, measured_c: circuit.conductorTemp_c,
  });

  const R = resistance({
    csa_mm2,
    length_m: Number(circuit.length_m) || 0,
    dedicatedReturn: !!circuit.dedicatedReturn,
    groundReturn_mohm: Number(system.groundReturn_mohm) || 0,
    temp_c: temp.temp_c,
    rho20, alpha,
  });

  const running = voltageDrop(load_a, R.R_ohm, Number(system.runningV) || 0);
  const cranking = voltageDrop(load_a, R.R_ohm, Number(system.crankingV) || 0);
  const returnDrop = voltageDrop(load_a, R.return_ohm, Number(system.runningV) || 0);

  const limit_pct = circuit.critical ? limits.criticalDrop_pct : limits.generalDrop_pct;
  const limit_v = circuit.critical ? limits.criticalDrop_v : Infinity;

  const fuse = fuseCheck({
    load_a, duty_pct: Number(circuit.duty_pct) || 0,
    klass: circuit.class, fuse_a: Number(circuit.fuse_a) || 0,
    fuseType: circuit.fuseType, allowed_a: amps.allowed,
    inrush_a: Number(circuit.inrush_a) || 0, inrush_ms: Number(circuit.inrush_ms) || 0,
  }, limits);

  const issues = [...fuse.issues];

  if (running.pct > limit_pct + 1e-9) {
    issues.push({
      severity: 'error', kind: 'drop',
      message: `${circuit.name}: ${running.dV.toFixed(3)} V, ` +
               `${running.pct.toFixed(1)}% at ${system.runningV} V, against a ${limit_pct}% limit.`,
    });
  }
  if (circuit.critical && running.dV > limit_v + 1e-9) {
    issues.push({
      severity: 'error', kind: 'drop-absolute',
      message: `${circuit.name}: ${running.dV.toFixed(3)} V against a ${limit_v} V absolute limit ` +
               `for a sensor reference. The drop appears directly as measurement error.`,
    });
  }
  if (cranking.pct > limits.crankingDrop_pct + 1e-9) {
    issues.push({
      severity: 'warning', kind: 'drop-cranking',
      message: `${circuit.name}: ${cranking.pct.toFixed(1)}% at ${system.crankingV} V cranking, ` +
               `against a ${limits.crankingDrop_pct}% limit.`,
    });
  }
  if (amps.allowed > 0 && load_a > amps.allowed + 1e-9) {
    issues.push({
      severity: 'error', kind: 'ampacity',
      message: `${circuit.name}: ${load_a} A through a conductor derated to ` +
               `${amps.allowed.toFixed(1)} A (${amps.base} A free air, ` +
               `x${amps.kTemp.toFixed(2)} ambient, x${amps.kBundle.toFixed(2)} bundle).`,
    });
  }

  const worst = Math.max(
    limit_pct > 0 ? running.pct / limit_pct : 0,
    amps.allowed > 0 ? load_a / amps.allowed : 0,
  );

  return {
    id: circuit.id,
    ampacity: amps,
    conductorTemp: temp,
    resistance: R,
    running, cranking, returnDrop,
    limit_pct, limit_v,
    fuse,
    issues,
    // Within limits, within 10% of one, or over: the three states the
    // table colours by, computed once here rather than in the view.
    margin: worst > 1 ? 'over' : worst > 0.9 ? 'marginal' : 'ok',
  };
}

/* ---------- the whole loom ---------- */
export function evaluate(state, spec) {
  const limits = { ...DEFAULTS.limits, ...(spec?.limits || {}), ...(state.limits || {}) };
  const circuits = state.circuits || [];
  const results = circuits.map(c => evaluateCircuit(c, state.system || {}, spec, limits));
  const ground = groundScheme(circuits);
  const budget = chargingBudget(circuits, state.supply || {});
  const mass = loomMass(circuits, spec);

  const issues = [
    ...results.flatMap(r => r.issues),
    ...ground.issues,
  ];

  if (budget.headroom_a < 0) {
    issues.push({
      severity: 'error', kind: 'alternator',
      message: `Continuous draw of ${budget.continuousDraw_a.toFixed(1)} A against ` +
               `${state.supply?.alternator_a_at_race || 0} A at race speed. The battery is ` +
               `making up the difference for the whole race.`,
    });
  } else if (budget.idleHeadroom_a < 0) {
    issues.push({
      severity: 'warning', kind: 'alternator-idle',
      message: `Continuous draw exceeds the alternator at idle by ` +
               `${Math.abs(budget.idleHeadroom_a).toFixed(1)} A. Fine on track, not in the pit lane.`,
    });
  }

  return {
    limits,
    results,
    byId: new Map(results.map(r => [r.id, r])),
    ground,
    budget,
    mass,
    issues,
    failing: results.filter(r => r.margin === 'over').length,
    marginal: results.filter(r => r.margin === 'marginal').length,
  };
}
