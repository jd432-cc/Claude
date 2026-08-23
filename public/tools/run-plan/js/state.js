/* =============================================================
   TheRacingData — Run Plan & Setup Log
   The report register, and the two collections the engine does
   not know about.

   The shared engine's `blank()` builds whatever the schema
   declares as a table, a fixed grid or a check grid. A run plan
   has neither: it has a list of setup revisions and a list of
   runs, both with nested objects inside them, and neither is a
   flat row of columns. So they are added here, on top of the
   engine's blank, and stripped back to the same shape on the way
   in. Everything else — persistence, validation, the DOCX export
   — is the engine's.
   ============================================================= */

import { createRegistry, useRegistry }
  from '../../_shared/report-engine/registry.js';
import * as store from '../../_shared/report-engine/store.js';
import { RUN_PLAN, useRegister } from './schemas/run-plan.js';
import { createRegister } from './setup-params.js';

export const REPORTS = [RUN_PLAN];

useRegistry(createRegistry(REPORTS));

export { SCHEMA, byId as reportById, setActive as setReport }
  from '../../_shared/report-engine/registry.js';

/* The parameter register is data. Loaded once at boot and handed to
   both the schema and everything else that needs to know what a
   parameter is called. */
let register = null;

export function installRegister(data) {
  register = createRegister(data);
  useRegister(register);
  return register;
}

export function theRegister() {
  return register;
}

/* ---------- the report ---------- */

export function blank() {
  return {
    ...store.blank(),
    setups: [firstRevision()],
    runs: [],
    activeRev: 1,
    compareRev: null,
  };
}

/* A sheet starts with a revision rather than with nothing. There is
   no such thing as a car with no setup, and a run that has to be
   attributed to "before anyone wrote it down" is a run wasted. */
function firstRevision() {
  return {
    rev: 1,
    timestamp: new Date().toISOString(),
    basedOnRev: null,
    note: 'As unloaded.',
    values: {},
  };
}

export function migrate(data) {
  const base = store.migrate(data);
  if (!base) return null;

  base.setups = Array.isArray(data?.setups) && data.setups.length
    ? data.setups.map(normaliseRevision)
    : [firstRevision()];
  base.runs = Array.isArray(data?.runs) ? data.runs.map(normaliseRun) : [];
  base.activeRev = data?.activeRev ?? base.setups.at(-1).rev;
  base.compareRev = data?.compareRev ?? null;
  return base;
}

/* A file written against an older version comes through with missing
   keys blank rather than being rejected, which is what the engine's
   own migrate() does for fields and what these two need doing for
   them. */
function normaliseRevision(s) {
  return {
    rev: Number(s?.rev) || 0,
    timestamp: s?.timestamp || '',
    basedOnRev: s?.basedOnRev ?? null,
    note: s?.note ?? '',
    values: (s?.values && typeof s.values === 'object') ? { ...s.values } : {},
  };
}

export function newRun(n, setupRev) {
  return {
    n,
    objective: '', driver: '', setupRev, tyreSet: '', fuel_l: '', laps: '',
    change: { param: '', from: '', to: '', rationale: '' },
    multiChange: { deliberate: false, reason: '' },
    expected: '', measured: '', verdict: '', bestLap_s: '', notes: '',
  };
}

function normaliseRun(r) {
  const base = newRun(r?.n ?? 0, r?.setupRev ?? '');
  return {
    ...base, ...r,
    change: { ...base.change, ...(r?.change || {}) },
    multiChange: { ...base.multiChange, ...(r?.multiChange || {}) },
  };
}

export function load() {
  const raw = store.load();
  return raw ? migrate(raw) : null;
}

export const save = store.save;
export const validate = store.validate;
export const derive = store.derive;
export const filename = store.filename;

/* ---------- the PEER fragment ----------

   The current revision, shaped for the PEER report's setup section.
   The keys are confirmed against _tools/report-builder/js/schemas/peer.js:
   the section carries setup.gain, setup.expectation, setup.changeCount
   and a `setupChanges` row loop whose columns are change, session,
   reason, effect1, effect2 and retained. */
export function toPeerFragment(report) {
  const runs = report.runs || [];
  const decided = runs.filter(r => r.change?.param && r.verdict);

  return {
    _schema: 'peer',
    _fragment: 'setup',
    _source: 'run-plan v1',
    setup: {
      gain: '',
      expectation: '',
      changeCount: String(decided.length),
    },
    setupChanges: decided.map(r => ({
      change: changeText(r),
      session: report.event?.sessionRef || '',
      reason: r.change.rationale || '',
      effect1: r.measured || '',
      effect2: '',
      retained: r.verdict === 'keep' ? 'Y' : r.verdict === 'revert' ? 'N' : '',
    })),
  };
}

function changeText(run) {
  const param = register?.byKey(run.change.param);
  const label = param?.label || run.change.param;
  const unit = param?.unit ? ` ${param.unit}` : '';
  const from = run.change.from === '' || run.change.from == null ? 'blank' : run.change.from;
  const to = run.change.to === '' || run.change.to == null ? 'blank' : run.change.to;
  return `${label}: ${from} → ${to}${unit}`;
}

export function download(bytes, name, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
