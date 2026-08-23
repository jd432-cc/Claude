#!/usr/bin/env node
/* =============================================================
   TheRacingData — load budget & voltage drop test.

   Plain Node, no browser, no framework. Every worked example in
   the build brief is an assertion here, computed to the digit the
   brief prints it to.

   The Loom Planner round trip is asserted against a committed
   fixture of the planner's real export format, not against a
   description of it: import, compute, export, re-import, and
   nothing this tool does not own may move.

   Run from the repo root:  node tools/test-load-budget.mjs
   ============================================================= */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/load-budget');

const {
  resistivity, resistance, voltageDrop, ampacity, baseAmpacity,
  tempDerate, bundleDerate, conductorTemp, fuseCheck, meltTime,
  chargingBudget, loomMass, groundScheme, evaluateCircuit, evaluate,
  DEFAULTS,
} = await import(join(TOOL, 'js/calc/electrical.js'));

const { fromLoom, toLoom, csaForGauge, gaugeForCsa, isLoomExport } =
  await import(join(TOOL, 'js/calc/loom.js'));

const spec = JSON.parse(await readFile(join(TOOL, 'data/wire-spec.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

/* ---------- resistance and drop ----------
   16 AWG (1.31 mm2) annealed copper, 4.0 m one way, dedicated
   return, 10 A at 20 °C:

       R  = 1.724e-8 x 8.0 / 1.31e-6 = 0.1053 ohm
       dV = 1.053 V
       %  = 7.6 at 13.8 V, against a 3% limit */
const at16 = resistance({ csa_mm2: 1.31, length_m: 4.0, dedicatedReturn: true, temp_c: 20 });
ok('resistance: the loop is twice the run for a dedicated return', at16.loopLength_m === 8);
ok('resistance: 1.31 mm2 over 8.0 m is 0.1053 ohm', near(at16.R_ohm, 0.1053, 0.0002),
   at16.R_ohm.toFixed(5));

const d16 = voltageDrop(10, at16.R_ohm, 13.8);
ok('drop: 10 A through it is 1.053 V', near(d16.dV, 1.053, 0.002), d16.dV.toFixed(4));
ok('drop: 7.6% at 13.8 V', near(d16.pct, 7.6, 0.05), d16.pct.toFixed(2));
ok('drop: and that fails the 3% general limit', d16.pct > DEFAULTS.limits.generalDrop_pct);

/* Same circuit, thicker. 14 AWG still fails; 12 AWG is the boundary. */
const at14 = resistance({ csa_mm2: 2.08, length_m: 4.0, dedicatedReturn: true, temp_c: 20 });
const d14 = voltageDrop(10, at14.R_ohm, 13.8);
ok('drop: 2.08 mm2 gives 0.663 V', near(d14.dV, 0.663, 0.002), d14.dV.toFixed(4));
ok('drop: 4.8%, still failing', near(d14.pct, 4.8, 0.05) && d14.pct > 3, d14.pct.toFixed(2));

const at12 = resistance({ csa_mm2: 3.31, length_m: 4.0, dedicatedReturn: true, temp_c: 20 });
const d12 = voltageDrop(10, at12.R_ohm, 13.8);
ok('drop: 3.31 mm2 gives 0.417 V', near(d12.dV, 0.417, 0.002), d12.dV.toFixed(4));
ok('drop: 3.0%, the boundary', near(d12.pct, 3.0, 0.05), d12.pct.toFixed(2));

/* ---------- temperature ----------
   The same circuit at 85 °C conductor temperature is 1.255 times
   the 20 °C resistance, within half a percent. */
const hot = resistance({ csa_mm2: 1.31, length_m: 4.0, dedicatedReturn: true, temp_c: 85 });
const ratio = hot.R_ohm / at16.R_ohm;
ok('temperature: 85 °C is 1.255x the 20 °C resistance',
   near(ratio, 1.255, 1.255 * 0.005), ratio.toFixed(4));
ok('temperature: 20 °C returns the reference resistivity',
   near(resistivity(20), DEFAULTS.resistivity_ohm_m_at_20c, 1e-15));
ok('temperature: copper gets worse when it gets hot',
   resistivity(85) > resistivity(20));

/* ---------- chassis return ----------
   Out through the wire, back through the car. What the car adds is
   measured, not computed. */
const chassis = resistance({
  csa_mm2: 1.31, length_m: 4.0, dedicatedReturn: false,
  groundReturn_mohm: 5, temp_c: 20,
});
ok('chassis return: the loop is the run, not twice it', chassis.loopLength_m === 4);
ok('chassis return: the measured ground resistance is added, not derived',
   near(chassis.chassis_ohm, 0.005, 1e-12));
ok('chassis return: and it is reported as the return path on its own',
   near(chassis.return_ohm, 0.005, 1e-12));
ok('dedicated return: half the conductor loop is the return leg',
   near(at16.return_ohm, at16.conductor_ohm / 2, 1e-12));

/* ---------- ampacity and derating ---------- */
ok('ampacity: the seeded table is read by conductor size',
   baseAmpacity(1.31, 'spec55-150', spec) === 23, String(baseAmpacity(1.31, 'spec55-150', spec)));
ok('ampacity: a size between two rows reads off the smaller one',
   baseAmpacity(1.6, 'spec55-150', spec) === baseAmpacity(1.31, 'spec55-150', spec));
ok('derating: sqrt((rating - ambient) / (rating - 20))',
   near(tempDerate(150, 40), Math.sqrt((150 - 40) / (150 - 20)), 1e-12));
ok('derating: at 20 °C ambient nothing is taken off',
   near(tempDerate(150, 20), 1, 1e-12));
ok('derating: an ambient at the insulation rating leaves nothing',
   tempDerate(150, 150) === 0);
for (const [n, factor] of [[1, 1.00], [2, 1.00], [3, 0.80], [5, 0.80],
                           [6, 0.70], [15, 0.70], [16, 0.50], [40, 0.50]]) {
  ok(`derating: a bundle of ${n} is x${factor.toFixed(2)}`,
     bundleDerate(n, spec.bundleDerating.bands) === factor);
}

const amps = ampacity({ csa_mm2: 1.31, insulation: 'spec55-150', ambient_c: 40, bundleSize: 8 }, spec);
ok('ampacity: derated for ambient and bundle together',
   near(amps.allowed, 23 * Math.sqrt(110 / 130) * 0.70, 1e-9), amps.allowed.toFixed(3));

/* Conductor temperature is either measured or estimated, and the
   tool says which. */
const measured = conductorTemp({ load_a: 10, allowed_a: 15, ambient_c: 40, rating_c: 150, measured_c: 85 });
ok('conductor temperature: a measured figure is used as given',
   measured.temp_c === 85 && measured.basis === 'measured');
const guessed = conductorTemp({ load_a: 10, allowed_a: 15, ambient_c: 40, rating_c: 150, measured_c: '' });
ok('conductor temperature: otherwise estimated from the loading ratio',
   guessed.temp_c > 40 && guessed.basis.startsWith('estimated'), guessed.temp_c.toFixed(1));

/* ---------- fuses ----------
   A 20 A load on a 20 A fuse is under 1.25x and trips mid-stint.
   A 30 A fuse on 1.31 mm2 is above the conductor and is a fire. */
const tight = fuseCheck({ load_a: 20, fuse_a: 20, allowed_a: 30 });
ok('fuse: 20 A on a 20 A fuse raises the 1.25x warning',
   tight.issues.some(i => i.kind === 'fuse-low' && i.severity === 'warning'),
   JSON.stringify(tight.issues.map(i => i.kind)));
ok('fuse: and names 25 A as the minimum', near(tight.minimum_a, 25, 1e-9));

const oversize = fuseCheck({ load_a: 10, fuse_a: 30, allowed_a: amps.allowed });
ok('fuse: 30 A on a 1.31 mm2 conductor is an error, not a warning',
   oversize.issues.some(i => i.kind === 'fuse-high' && i.severity === 'error'),
   JSON.stringify(oversize.issues.map(i => `${i.kind}:${i.severity}`)));
ok('fuse: an inrush load is held to 1.5x rather than 1.25x',
   near(fuseCheck({ load_a: 20, fuse_a: 40, allowed_a: 60, klass: 'inrush' }).minimum_a, 30, 1e-9));
ok('fuse: a correctly sized fuse raises nothing',
   fuseCheck({ load_a: 10, fuse_a: 15, allowed_a: 23 }).issues.length === 0);

ok('fuse: a slow fuse takes longer than a fast one at the same current',
   meltTime(40, 20, 'slow') > meltTime(40, 20, 'fast'));
ok('fuse: below rating a fuse does not melt', meltTime(10, 20, 'fast') === Infinity);
const inrush = fuseCheck({
  load_a: 8, fuse_a: 15, allowed_a: 23, klass: 'inrush',
  inrush_a: 60, inrush_ms: 300, fuseType: 'fast',
});
ok('fuse: a long inrush against a fast fuse is flagged as marginal',
   inrush.issues.some(i => i.kind === 'inrush'));

/* ---------- ground scheme ----------
   A sensor return sharing a stud with an injector return is the
   single most common cause of noisy telemetry. */
const shared = groundScheme([
  { id: 'c1', name: 'TPS return', kind: 'sensor', dedicatedReturn: false, groundNode: 'G1', critical: true },
  { id: 'c2', name: 'Injector 1 return', kind: 'injector', dedicatedReturn: false, groundNode: 'G1' },
  { id: 'c3', name: 'Fan return', kind: 'motor', dedicatedReturn: false, groundNode: 'G2' },
]);
ok('ground: a sensor return sharing a node with an injector return is flagged',
   shared.issues.some(i => i.kind === 'ground-shared' && i.node === 'G1'),
   JSON.stringify(shared.issues.map(i => i.node)));
ok('ground: and it is an error, not a note',
   shared.issues[0]?.severity === 'error');
ok('ground: a motor alone on its own node is not flagged',
   !shared.issues.some(i => i.node === 'G2'));
ok('ground: a dedicated return shares nothing',
   groundScheme([
     { id: 'c1', name: 'TPS return', kind: 'sensor', dedicatedReturn: true, critical: true },
     { id: 'c2', name: 'Injector', kind: 'injector', dedicatedReturn: true },
   ]).issues.length === 0);

/* ---------- charging budget ---------- */
const budget = chargingBudget([
  { load_a: 8, duty_pct: 100 },
  { load_a: 12, duty_pct: 50 },
  { load_a: 20, duty_pct: 25 },
], { alternator_a_at_idle: 18, alternator_a_at_race: 55,
     batteryCapacity_ah: 20, batteryReserve_pct: 20 });
ok('budget: continuous draw is the duty-weighted sum',
   near(budget.continuousDraw_a, 8 + 6 + 5, 1e-9), budget.continuousDraw_a.toFixed(2));
ok('budget: peak draw is not', near(budget.peakDraw_a, 40, 1e-9));
ok('budget: headroom at race speed', near(budget.headroom_a, 55 - 19, 1e-9));
ok('budget: and the alternator is short at idle', budget.idleHeadroom_a < 0);
ok('budget: time to flat is the endurance figure on the battery alone',
   near(budget.timeToFlat_min, (20 * 0.8 / 19) * 60, 1e-9), budget.timeToFlat_min.toFixed(1));

/* ---------- loom mass ---------- */
const mass = loomMass([
  { csa_mm2: 1.31, length_m: 4, dedicatedReturn: true, insulation: 'spec55-150', group: 'Power' },
  { csa_mm2: 0.326, length_m: 2, dedicatedReturn: false, insulation: 'spec55-150', group: 'Sensors' },
], spec);
ok('mass: copper is csa x length x 8.96 g per metre',
   mass.total_g > 1.31 * 8 * 8.96 && mass.total_g < 1.31 * 8 * 8.96 * 1.8,
   mass.total_g.toFixed(1));
ok('mass: totalled by group', mass.byGroup.length === 2);
ok('mass: and reported in kilograms too', near(mass.total_kg, mass.total_g / 1000, 1e-12));

/* ---------- a circuit end to end ---------- */
const system = { nominalV: 12.0, runningV: 13.8, crankingV: 9.5, ambient_c: 20, groundReturn_mohm: 5 };
const sensor = evaluateCircuit({
  id: 'c1', name: '5V reference', kind: 'sensor', critical: true,
  load_a: 0.05, duty_pct: 100, class: 'continuous',
  length_m: 1.8, dedicatedReturn: true,
  csa_mm2: 0.326, conductor: 'copper', insulation: 'spec55-150',
  bundleSize: 6, fuse_a: 3, fuseType: 'fast', conductorTemp_c: 20,
}, system, spec);
ok('circuit: a sensor reference is held to the tighter limit',
   sensor.limit_pct === DEFAULTS.limits.criticalDrop_pct);
ok('circuit: a well-sized sensor feed passes', sensor.margin === 'ok',
   `${sensor.running.pct.toFixed(3)}%`);

const failing = evaluateCircuit({
  id: 'c2', name: 'ECU feed', kind: 'power', critical: false,
  load_a: 10, duty_pct: 100, class: 'continuous',
  length_m: 4, dedicatedReturn: true,
  csa_mm2: 1.31, conductor: 'copper', insulation: 'spec55-150',
  bundleSize: 1, fuse_a: 15, fuseType: 'fast', conductorTemp_c: 20,
}, system, spec);
ok('circuit: the failing 16 AWG example is over limit', failing.margin === 'over');
ok('circuit: and says so as a drop error',
   failing.issues.some(i => i.kind === 'drop' && i.severity === 'error'));
ok('circuit: the return path is reported separately',
   failing.returnDrop.dV > 0 && failing.returnDrop.dV < failing.running.dV);

/* ---------- the whole loom ---------- */
const whole = evaluate({
  system,
  supply: { alternator_a_at_idle: 18, alternator_a_at_race: 55,
            batteryCapacity_ah: 20, batteryReserve_pct: 20 },
  circuits: [
    { id: 'c1', name: '5V reference', kind: 'sensor', critical: true, load_a: 0.05,
      duty_pct: 100, class: 'continuous', length_m: 1.8, dedicatedReturn: false,
      groundNode: 'G1', csa_mm2: 0.326, conductor: 'copper',
      insulation: 'spec55-150', bundleSize: 6, fuse_a: 3, fuseType: 'fast' },
    { id: 'c2', name: 'Injector 1', kind: 'injector', critical: false, load_a: 4,
      duty_pct: 40, class: 'intermittent', length_m: 2.1, dedicatedReturn: false,
      groundNode: 'G1', csa_mm2: 0.823, conductor: 'copper',
      insulation: 'spec55-150', bundleSize: 6, fuse_a: 10, fuseType: 'fast' },
  ],
}, spec);
ok('loom: every circuit is evaluated', whole.results.length === 2);
ok('loom: the shared ground is raised at loom level',
   whole.issues.some(i => i.kind === 'ground-shared'));
ok('loom: failing and marginal counts are computed once, not in the view',
   Number.isInteger(whole.failing) && Number.isInteger(whole.marginal));

/* ---------- the Loom Planner round trip ----------
   Import a real export, compute against it, export, re-import.
   Nothing this tool does not own may move. */
const loom = JSON.parse(await readFile(join(ROOT, 'tools/fixtures/loom-planner-export.json'), 'utf8'));
ok('loom planner: the fixture is recognised as an export', isLoomExport(loom));
ok('loom planner: a .trd.json session is not', !isLoomExport({ _schema: 'load-budget' }));

ok('awg: the map is data, and 16 AWG is 1.31 mm2', csaForGauge('16', spec) === 1.31);
ok('awg: every gauge in the brief is present',
   ['22', '20', '18', '16', '14', '12', '10', '8', '4', '2', '0']
     .every(g => csaForGauge(g, spec) > 0));
ok('awg: a conductor size maps back to a gauge at or above it',
   gaugeForCsa(1.31, spec) === '16' && Number(spec.awg.map[gaugeForCsa(1.4, spec)]) >= 1.4);

const imported = fromLoom(loom, spec);
ok('loom planner: every wire becomes a circuit',
   imported.circuits.length === loom.wires.length);
ok('loom planner: gauge becomes a conductor size',
   imported.circuits[0].csa_mm2 === 1.31);
ok('loom planner: length comes across', imported.circuits[0].length_m === 2.4);
ok('loom planner: the from and to labels are resolved through the pins',
   imported.circuits[0].from === 'Fusebox:F1' && imported.circuits[0].to === 'ECU A:A1',
   `${imported.circuits[0].from} -> ${imported.circuits[0].to}`);
ok('loom planner: wire groups become circuit groups',
   imported.circuits[0].group === 'Power');
ok('loom planner: only the load and the duty are left to fill',
   imported.circuits.every(c => c.load_a === ''));

// Fill in what this tool owns, then send it back.
const filled = {
  ...imported,
  system, supply: {},
  circuits: imported.circuits.map((c, i) => ({
    ...c, load_a: [6, 0.05, 0.05, 9, 18, 4][i], duty_pct: 100,
    csa_mm2: i === 0 ? 2.08 : c.csa_mm2,       // resized by this tool
  })),
};
const back = toLoom(filled, spec);

ok('loom planner: the export is shaped like the planner\'s state',
   isLoomExport(back) && back.wires.length === loom.wires.length);
ok('loom planner: the resized conductor is written back as a gauge',
   back.wires[0].gauge === '14', back.wires[0].gauge);

// Nothing else moved. Compared field by field against the original.
const moved = [];
for (const [i, before] of loom.wires.entries()) {
  const after = back.wires[i];
  for (const key of Object.keys(before)) {
    if (key === 'gauge') continue;                  // the one field this tool owns
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      moved.push(`wires[${i}].${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`);
    }
  }
}
ok('loom planner: no field this tool does not own moved', moved.length === 0, moved.join('; '));

for (const key of ['connectors', 'components', 'routeNodes', 'connectorGroups', 'wireGroups']) {
  ok(`loom planner: ${key} come back byte for byte`,
     JSON.stringify(loom[key]) === JSON.stringify(back[key]));
}

// And it re-imports, keeping what was filled in against the same wires.
const round = fromLoom(back, spec, filled.circuits);
ok('loom planner: re-importing keeps the load already filled in',
   round.circuits.every((c, i) => c.load_a === filled.circuits[i].load_a));
ok('loom planner: and the conductor size this tool arrived at',
   round.circuits[0].csa_mm2 === 2.08, String(round.circuits[0].csa_mm2));
ok('loom planner: the circuit ids are stable across the round trip',
   round.circuits.map(c => c.id).join() === filled.circuits.map(c => c.id).join());

/* ---------- the spec file ---------- */
ok('spec: every conductor carries a source',
   spec.conductors.every(c => typeof c.source === 'string' && c.source.length > 20));
ok('spec: every insulation carries a source',
   spec.insulations.every(i => typeof i.source === 'string' && i.source.length > 20));
ok('spec: the ampacity table carries a source and a warning',
   spec.ampacity.source.length > 20 && spec.warning.includes('SEED DATA'));
ok('spec: the three insulation classes the brief names are present',
   ['pvc-105', 'spec55-150', 'tefzel-200'].every(id => spec.insulations.some(i => i.id === id)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
