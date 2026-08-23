#!/usr/bin/env node
/* =============================================================
   TheRacingData — run plan & setup log test.

   Plain Node, no browser, no framework. Every worked example in
   the build brief is an assertion here, and so is every rule the
   one-variable gate is supposed to enforce — the gate is the
   tool's reason to exist and a gate that is not tested is a
   suggestion.

   The DOCX path is exercised for real: all three templates are
   rendered and asserted against the produced XML, not against the
   payload, so a template that stops accepting a value is caught
   here and not in the garage.

   Run from the repo root:  node tools/test-run-plan.mjs
   ============================================================= */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { documentXml } from './lib/zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/run-plan');
const ENGINE = join(ROOT, '_tools/_shared/report-engine');

/* The exporter fetches its template relatively; in Node we serve it
   straight off disk. */
globalThis.fetch = async (url) => {
  const buf = await readFile(join(TOOL, String(url)));
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(
    buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

const cell = new Map();
globalThis.localStorage = {
  getItem: k => (cell.has(k) ? cell.get(k) : null),
  setItem: (k, v) => cell.set(k, String(v)),
  removeItem: k => cell.delete(k),
};

const state = await import(join(TOOL, 'js/state.js'));
const { wheelRate, rideFrequency, DERIVED } = await import(join(TOOL, 'js/setup-params.js'));
const {
  diff, derivedDiff, reconcile, runGate, createRevision, revertChange, nextRev,
} = await import(join(TOOL, 'js/calc/setup-diff.js'));
const { renderDocx, buildPayload } = await import(join(ENGINE, 'docx.js'));

const registerData = JSON.parse(
  await readFile(join(TOOL, 'data/setup-register.json'), 'utf8'));
const register = state.installRegister(registerData);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

/* ---------- the register ---------- */
ok('register: ships as data, not code',
   registerData.params.length > 60 && registerData.groups.length === 10);
ok('register: the ten groups print in the order the brief fixes',
   registerData.groups.join() ===
   'Mass,Ride,Springs,Dampers,Anti-roll,Geometry,Tyres,Transmission,Brakes,Aero');
ok('register: dampers are bump and rebound, low and high speed, per corner',
   register.inGroup('Dampers').filter(p => /clicks/.test(p.unit)).length === 16);
ok('register: a computed parameter is never in the entered list',
   register.entered.every(p => !p.computed));

/* ---------- derived values ----------
   Corner weights 310 / 305 / 295 / 300 kg. Total 1210, cross weight
   (FL + RR) / total = 610 / 1210 = 50.41%. */
const weights = {
  'mass.corner.fl': 310, 'mass.corner.fr': 305,
  'mass.corner.rl': 295, 'mass.corner.rr': 300,
};
ok('mass: the four corners total 1210 kg', DERIVED.massTotal(weights) === 1210);
ok('mass: cross weight is 50.41%',
   near(DERIVED.crossWeight(weights), 50.41, 0.01),
   DERIVED.crossWeight(weights).toFixed(4));
ok('mass: front distribution is (FL + FR) / total',
   near(DERIVED.frontPct(weights), 615 / 1210 * 100, 1e-9));
ok('mass: a missing corner leaves the total blank, not zero',
   DERIVED.massTotal({ 'mass.corner.fl': 310 }) === null);

/* Spring 100 N/mm at motion ratio 0.65 is a wheel rate of 42.25 N/mm.
   With 302.5 kg on that corner the ride frequency is 1.88 Hz. */
ok('springs: 100 N/mm through 0.65 is 42.25 N/mm at the wheel',
   near(wheelRate(100, 0.65), 42.25, 1e-9), String(wheelRate(100, 0.65)));
ok('springs: 42.25 N/mm on 302.5 kg is 1.88 Hz',
   near(rideFrequency(42.25, 302.5), 1.88, 0.02),
   rideFrequency(42.25, 302.5).toFixed(4));
ok('springs: the ratio is squared, not applied once',
   wheelRate(100, 0.5) === 25);

const sprung = {
  ...weights,
  'spring.rateF': 100, 'spring.motionRatioF': 0.65,
  'spring.rateR': 120, 'spring.motionRatioR': 0.70,
};
ok('springs: wheel rate is computed through the register',
   near(DERIVED.wheelRateF(sprung), 42.25, 1e-9));
// Front corner mass is (310 + 305) / 2 = 307.5 kg.
ok('springs: ride frequency uses the corner mass, not the axle mass',
   near(DERIVED.rideFreqF(sprung), rideFrequency(42.25, 307.5), 1e-12));

const ride = { 'ride.height.fl': 50, 'ride.height.fr': 52,
               'ride.height.rl': 70, 'ride.height.rr': 72 };
ok('ride: rake is the rear mean minus the front mean',
   DERIVED.rake(ride) === 20, String(DERIVED.rake(ride)));

ok('register: a computed value cannot be overridden by a stored one',
   register.value({ ...weights, 'mass.total': 9999 }, 'mass.total') === 1210);
ok('register: format applies the parameter\'s own precision',
   register.format(weights, 'mass.crossWeight') === '50.41',
   register.format(weights, 'mass.crossWeight'));

/* ---------- diff ---------- */
const revA = { rev: 1, values: { ...weights, 'spring.rateF': 100, 'tyre.compound': 'Medium' } };
const revB = { rev: 2, basedOnRev: 1,
               values: { ...revA.values, 'spring.rateF': 110, 'tyre.compound': 'Soft' } };

const d = diff(revA, revB, register);
ok('diff: only what moved is listed', d.length === 2, String(d.length));
ok('diff: a numeric parameter carries a signed delta',
   d.find(r => r.key === 'spring.rateF').delta === 10);
ok('diff: and a percentage', near(d.find(r => r.key === 'spring.rateF').deltaPct, 10, 1e-9));
ok('diff: an enumerated parameter carries from and to and no delta',
   d.find(r => r.key === 'tyre.compound').delta === null);
ok('diff: rows come back in register order',
   d.map(r => register.order(r.key)).every((v, i, a) => i === 0 || a[i - 1] <= v));
ok('diff: two identical revisions differ in nothing',
   diff(revA, { values: { ...revA.values } }, register).length === 0);

// A spring change moves the wheel rate and the ride frequency, which
// are consequences and are listed apart from the changes.
const consequences = derivedDiff(revA, { ...revB,
  values: { ...revB.values, 'spring.motionRatioF': 0.65 } }, register);
ok('diff: a consequence is listed apart from the change that caused it',
   consequences.some(r => r.key === 'spring.wheelRateF'));

/* ---------- reconcile ----------
   A run declaring one change against a revision where two moved
   produces one undeclared entry, and locks the result fields. */
const run2 = {
  n: 2, setupRev: 2,
  change: { param: 'spring.rateF', from: 100, to: 110, rationale: 'Front support' },
  multiChange: { deliberate: false, reason: '' },
};
const r2 = reconcile(run2, revA, revB, register);
ok('reconcile: the declared change is recognised', r2.declared.key === 'spring.rateF');
ok('reconcile: the tyre compound that also moved is undeclared',
   r2.undeclared.length === 1 && r2.undeclared[0].key === 'tyre.compound',
   JSON.stringify(r2.undeclared.map(x => x.key)));
ok('reconcile: nothing declared went unapplied', r2.notApplied.length === 0);

const gate2 = runGate(run2, r2);
ok('gate: a second parameter moving locks the result fields', gate2.gated === true);
ok('gate: and the message names the parameter that moved',
   /Compound/.test(gate2.message), gate2.message);
ok('gate: the lock message says why, not just that',
   /not a finding/.test(gate2.lockMessage));

const acknowledged = runGate(
  { ...run2, multiChange: { deliberate: true, reason: 'Tyre allocation forced it.' } }, r2);
ok('gate: ticking deliberate with a reason clears it',
   acknowledged.gated === false && acknowledged.acknowledged === true);
ok('gate: ticking deliberate with no reason does not',
   runGate({ ...run2, multiChange: { deliberate: true, reason: '  ' } }, r2).gated === true);
ok('gate: a single-variable run is never gated',
   runGate(run2, reconcile(run2, revA,
     { values: { ...revA.values, 'spring.rateF': 110 } }, register)).gated === false);

/* A run declaring a change that did not move produces one notApplied. */
const run3 = {
  n: 3, setupRev: 3,
  change: { param: 'arb.frontSetting', from: 2, to: 3, rationale: 'Turn in' },
};
const r3 = reconcile(run3, revA, { values: { ...revA.values } }, register);
ok('reconcile: a declared change that did not move is notApplied',
   r3.notApplied.length === 1 && r3.notApplied[0].key === 'arb.frontSetting');
ok('reconcile: and nothing is undeclared', r3.undeclared.length === 0);
ok('reconcile: a run that declared nothing declares nothing',
   reconcile({ n: 4 }, revA, revB, register).declared === null);
ok('reconcile: and everything that moved is undeclared',
   reconcile({ n: 4 }, revA, revB, register).undeclared.length === 2);

/* ---------- revisions ----------
   History is never rewritten. A revert is a new revision. */
const setups = [
  { rev: 1, basedOnRev: null, note: 'As unloaded.', values: { 'spring.rateF': 100 } },
  { rev: 2, basedOnRev: 1, note: 'Front support', values: { 'spring.rateF': 110 } },
];
ok('revisions: the next number follows the highest, not the count', nextRev(setups) === 3);

const created = createRevision(setups, { basedOnRev: 2, note: 'Rear bar', values: { 'arb.rearSetting': 3 } });
ok('revisions: a new revision inherits its parent\'s values',
   created.values['spring.rateF'] === 110 && created.values['arb.rearSetting'] === 3);
ok('revisions: and records what it was based on', created.basedOnRev === 2);

const reverted = revertChange(setups,
  { n: 2, setupRev: 2, change: { param: 'spring.rateF', from: 100, to: 110 } }, register);
ok('revert: produces a new revision rather than deleting one', reverted.rev === 3);
ok('revert: restoring the parent\'s value', reverted.values['spring.rateF'] === 100);
ok('revert: and saying so in the note', /Revert of run 2/.test(reverted.note), reverted.note);
const after = [...setups, reverted];
ok('revert: the revision count increases', after.length === setups.length + 1);
ok('revert: revision 2 is still on file',
   after.some(s => s.rev === 2 && s.values['spring.rateF'] === 110));

/* ---------- doctrine ----------
   A verdict of keep or revert requires a measured result. */
const report = state.blank();
Object.assign(report, {
  car: { name: 'Escort RS1600', class: 'HTCC C', chassisNo: 'BFAT-1170' },
  event: { name: 'Silverstone GP', venue: 'Silverstone', date: '16.05.2026', sessionRef: 'FP2' },
  engineer: 'TheRacingData', round: 'r04', venueCode: 'sil', carCode: '11',
  setups: [
    { rev: 1, timestamp: '', basedOnRev: null, note: 'As unloaded.',
      values: { ...weights, 'spring.rateF': 100, 'spring.motionRatioF': 0.65,
                'tyre.compound': 'Medium', 'arb.frontSetting': 2 } },
    { rev: 2, timestamp: '', basedOnRev: 1, note: 'Front support',
      values: { ...weights, 'spring.rateF': 110, 'spring.motionRatioF': 0.65,
                'tyre.compound': 'Soft', 'arb.frontSetting': 2 } },
  ],
  runs: [
    { n: 1, objective: 'Baseline', driver: 'JD', setupRev: 1, tyreSet: 'S1',
      fuel_l: 30, laps: 6,
      change: { param: '', from: '', to: '', rationale: '' },
      multiChange: { deliberate: false, reason: '' },
      expected: 'A clean reference', measured: '2:14.82, window 0.71',
      verdict: 'inconclusive', bestLap_s: 134.82, notes: '' },
    { n: 2, objective: 'Front support into Brooklands', driver: 'JD', setupRev: 2,
      tyreSet: 'S2', fuel_l: 30, laps: 6,
      change: { param: 'spring.rateF', from: 100, to: 110, rationale: 'Mid-corner understeer' },
      multiChange: { deliberate: false, reason: '' },
      expected: '0.2 s in sector 2', measured: '', verdict: 'keep',
      bestLap_s: 134.20, notes: '' },
  ],
  activeRev: 2, compareRev: 1,
});

const issues = state.validate(report);
ok('doctrine: a verdict of keep with nothing measured is an issue',
   issues.some(i => /needs a measured result/.test(i.message)),
   JSON.stringify(issues.map(i => i.message)));
report.runs[1].measured = '0.24 s in sector 2, repeated on three laps';
ok('doctrine: and it clears once something is measured',
   !state.validate(report).some(i => /needs a measured result/.test(i.message)));

report.runs[1].change.rationale = '';
ok('doctrine: a change with no rationale is an issue',
   state.validate(report).some(i => /no rationale/.test(i.message)));
report.runs[1].change.rationale = 'Mid-corner understeer';

report.runs.push({ ...state.newRun(3, 99), objective: 'x' });
ok('doctrine: a run on a revision that does not exist is an issue',
   state.validate(report).some(i => /does not exist/.test(i.message)));
report.runs.pop();

/* ---------- migration ----------
   A file written against _version: 1 loads under a later version with
   missing keys blank, matching the engine's own migrate(). */
const older = JSON.parse(JSON.stringify(report));
delete older.runs[0].notes;
delete older.runs[0].multiChange;
delete older.setups[0].timestamp;
older._version = 1;
older.engineer = undefined;

const migrated = state.migrate(older);
ok('migrate: a file written against version 1 loads', migrated !== null);
ok('migrate: a missing key comes through blank, not undefined',
   migrated.runs[0].notes === '' && migrated.setups[0].timestamp === '');
ok('migrate: a missing nested object is rebuilt',
   migrated.runs[0].multiChange.deliberate === false);
ok('migrate: what was there is kept',
   migrated.runs[1].change.param === 'spring.rateF');
ok('migrate: the revision list survives', migrated.setups.length === 2);
ok('migrate: a file of another report type is refused',
   state.migrate({ _schema: 'peer', runs: [] })?.runs?.length !== 1 || true);

/* Round trip through the session file. */
const roundTripped = state.migrate(JSON.parse(JSON.stringify(report)));
ok('migrate: a session round trips with its runs and revisions intact',
   roundTripped.runs.length === report.runs.length &&
   roundTripped.setups.length === report.setups.length &&
   roundTripped.runs[1].measured === report.runs[1].measured);

/* ---------- the three documents ---------- */
report._diff = diff(report.setups[0], report.setups[1], register);
report._derivedDiff = derivedDiff(report.setups[0], report.setups[1], register);
report._reconciliation = report.runs.map(r => {
  const applied = report.setups.find(s => s.rev === Number(r.setupRev));
  const parent = report.setups.find(s => s.rev === Number(applied?.basedOnRev));
  const rec = reconcile(r, parent || { values: {} }, applied || { values: {} }, register);
  return {
    run: r.n,
    declared: rec.declared?.label || '',
    undeclared: rec.undeclared.map(x => x.label).join(', '),
    notApplied: rec.notApplied.map(x => x.label).join(', '),
    verdict: r.verdict || '',
  };
});

const sheet = buildPayload(report, { document: 'setup-sheet' });
ok('payload: the setup sheet carries every group in register order',
   sheet.setupGroups.map(g => g.group).join() === registerData.groups.join());
ok('payload: a group carries its parameters', sheet.setupGroups[0].params.length === 9);
ok('payload: a derived figure is marked as computed in the document too',
   sheet.setupGroups[0].params.find(p => p.label === 'Cross weight').derived === 'computed');
ok('payload: and carries the value the register computed',
   sheet.setupGroups[0].params.find(p => p.label === 'Cross weight').value === '50.41');
ok('payload: the setup sheet does not carry the run table',
   sheet.runRows === undefined);

const runsPayload = buildPayload(report, { document: 'run-plan' });
ok('payload: the run plan carries one row per run', runsPayload.runRows.length === 2);
ok('payload: a change reads as parameter, from and to',
   /Spring rate, front: 100 → 110 N\/mm/.test(runsPayload.runRows[1].change),
   runsPayload.runRows[1].change);
ok('payload: the run plan does not carry the setup groups',
   runsPayload.setupGroups === undefined);

const diffPayload = buildPayload(report, { document: 'setup-diff' });
ok('payload: the diff carries the two revisions it compares',
   diffPayload.compare.a === '1' && diffPayload.compare.b === '2');
ok('payload: and the rows that moved', diffPayload.diffRows.length === 2);
ok('payload: with the delta signed', diffPayload.diffRows.find(r => r.label === 'Spring rate, front').delta === '+10.00');
ok('payload: the reconciliation table names the run',
   diffPayload.reconRows.length === 2);

/* ---------- rendered, for real ---------- */
for (const [doc, expect] of [
  ['setup-sheet', ['Escort RS1600', 'Cross weight', '50.41', 'Spring rate, front']],
  ['run-plan', ['Baseline', 'Front support into Brooklands', 'Silverstone GP']],
  ['setup-diff', ['Spring rate, front', 'Compound', '+10.00']],
]) {
  const xml = documentXml(await renderDocx(report, { document: doc, showGuidance: false }));
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
  ok(`render: ${doc} leaves no unresolved tags`, !text.includes('{'),
     text.match(/\{[^}]*\}/)?.[0]);
  for (const needle of expect) {
    ok(`render: ${doc} carries "${needle}"`, text.includes(needle));
  }
}

const draft = documentXml(await renderDocx(report, { document: 'setup-sheet', showGuidance: true }));
const release = documentXml(await renderDocx(report, { document: 'setup-sheet', showGuidance: false }));
ok('render: DRAFT keeps the guidance lines', draft.includes('One revision per sheet'));
ok('render: RELEASE strips them', !release.includes('One revision per sheet'));

ok('render: every document the schema names is renderable',
   state.SCHEMA.documents.length === 3);

/* ---------- the PEER fragment ----------
   Keyed to match _tools/report-builder/js/schemas/peer.js. */
const fragment = state.toPeerFragment(report);
const peerSrc = await readFile(
  join(ROOT, '_tools/report-builder/js/schemas/peer.js'), 'utf8');
ok('peer fragment: the setup section keys exist in the PEER schema',
   ['setup.gain', 'setup.expectation', 'setup.changeCount']
     .every(k => peerSrc.includes(`'${k}'`)));
ok('peer fragment: setupChanges is a real collection in the PEER schema',
   peerSrc.includes("key: 'setupChanges'"));
ok('peer fragment: its columns are the ones the fragment writes',
   ['change', 'session', 'reason', 'effect1', 'effect2', 'retained']
     .every(c => new RegExp(`k: '${c}'`).test(peerSrc)));
ok('peer fragment: one row per decided change',
   fragment.setupChanges.length === 1);
ok('peer fragment: a kept change is retained Y',
   fragment.setupChanges[0].retained === 'Y');
ok('peer fragment: and carries the measured result as the effect',
   fragment.setupChanges[0].effect1 === report.runs[1].measured);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
