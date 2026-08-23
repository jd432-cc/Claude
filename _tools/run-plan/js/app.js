/* =============================================================
   TheRacingData — Run Plan & Setup Log
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import * as state from './state.js';
import { renderDocx, download as downloadDocx }
  from '../../_shared/report-engine/docx.js';
import {
  diff, derivedDiff, reconcile, createRevision, revertChange, revisionByNumber,
} from './calc/setup-diff.js';
import { UI } from './ui.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let report = null;
let ui = null;
let saveTimer = null;

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 5000);
}

/* The parameter register is data, and a car class overrides it. The
   default ships with the tool; a class register is loaded from a file
   and replaces it wholesale. */
async function defaultRegister() {
  const res = await fetch('data/setup-register.json');
  if (!res.ok) throw new Error(`setup-register.json (${res.status})`);
  return res.json();
}

try {
  state.installRegister(await defaultRegister());
} catch (err) {
  status(`Could not load ${err.message}. The tool ships with it; if this ` +
         `persists the deploy is incomplete.`, 'warn');
  throw err;
}

report = state.load() || state.blank();

function changed(_report, structural = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!state.save(report)) {
      status('Autosave unavailable — export to a file before you close this tab.', 'warn');
    }
  }, 400);
  if (structural) draw();
  else ui.renderIssues(state.validate(report));
}

function draw() {
  ui.report = report;
  ui.render(state.validate(report));
}

ui = new UI(report, changed);

/* A revert creates a new revision restoring the previous value rather
   than deleting the one that made the change. History is never
   rewritten: that a change was tried and taken back is a different
   fact from it never having been tried, and it is the one that stops
   it being tried again next event. */
ui.onRevert = (run) => {
  const next = revertChange(report.setups, run, state.theRegister());
  if (!next) { status('That run has no change to revert.', 'warn'); return; }
  report.setups.push(next);
  report.activeRev = next.rev;
  report.compareRev = run.setupRev;
  changed(report, true);
  status(`Rev ${next.rev} created: ${next.note}`, 'ok');
};

ui.onBranch = () => {
  const from = revisionByNumber(report.setups, report.activeRev)
    || report.setups.at(-1);
  const next = createRevision(report.setups, {
    basedOnRev: from?.rev ?? null, note: '', values: {},
  });
  report.setups.push(next);
  report.compareRev = from?.rev ?? null;
  report.activeRev = next.rev;
  changed(report, true);
  status(`Rev ${next.rev} created from rev ${from?.rev}. Say what it is.`, 'ok');
};

draw();

/* ---------- exports ---------- */

/* The diff document needs the comparison worked out before the
   payload runs, and the payload hook is pure. So the three blocks it
   reads are attached to the report here, where the register and the
   two revisions are both to hand. */
function withComparison() {
  const register = state.theRegister();
  const b = revisionByNumber(report.setups, report.activeRev) || report.setups.at(-1);
  const a = revisionByNumber(report.setups, report.compareRev)
    || (b ? revisionByNumber(report.setups, b.basedOnRev) : null)
    || { values: {} };

  report._diff = diff(a, b, register);
  report._derivedDiff = derivedDiff(a, b, register);
  report._reconciliation = report.runs.map(run => {
    const applied = revisionByNumber(report.setups, run.setupRev);
    const parent = applied ? revisionByNumber(report.setups, applied.basedOnRev) : null;
    const rec = reconcile(run, parent || { values: {} }, applied || { values: {} }, register);
    return {
      run: run.n,
      declared: rec.declared?.label || '',
      undeclared: rec.undeclared.map(x => x.label).join(', '),
      notApplied: rec.notApplied.map(x => x.label).join(', '),
      verdict: run.verdict || '',
    };
  });
  return report;
}

async function exportDocx(document_, showGuidance) {
  const issues = state.validate(report);
  if (issues.length && !showGuidance) {
    const go = confirm(
      `${issues.length} item${issues.length > 1 ? 's are' : ' is'} unresolved. ` +
      `A RELEASE document should not carry them.\n\nExport anyway?`);
    if (!go) return;
  }
  status('Building document…');
  try {
    const bytes = await renderDocx(withComparison(),
      { document: document_, showGuidance });
    const suffix = state.SCHEMA.documents.find(d => d.id === document_)?.suffix || '';
    downloadDocx(bytes, state.filename(report, `${suffix}.docx`), DOCX_MIME);
    status(showGuidance ? 'DRAFT exported — guidance retained.'
                        : 'RELEASE exported — guidance stripped.', 'ok');
  } catch (err) {
    console.error(err);
    const detail = Array.isArray(err) ? err.map(e => e.message).join('; ') : err.message;
    status(`Export failed: ${detail}`, 'warn');
  }
}

const picker = document.getElementById('doc-type');
for (const doc of state.SCHEMA.documents) picker.append(new Option(doc.label, doc.id));

document.getElementById('export-draft')
  .addEventListener('click', () => exportDocx(picker.value, true));
document.getElementById('export-release')
  .addEventListener('click', () => exportDocx(picker.value, false));

document.getElementById('export-json').addEventListener('click', () => {
  // The three comparison blocks are computed for a document; they are
  // not state and do not belong in the session file.
  const { _diff, _derivedDiff, _reconciliation, ...clean } = report;
  downloadDocx(new TextEncoder().encode(JSON.stringify(clean, null, 2)),
               state.filename(report, 'trd.json'), 'application/json');
  status('Session exported.', 'ok');
});

document.getElementById('export-peer').addEventListener('click', () => {
  downloadDocx(new TextEncoder().encode(
    JSON.stringify(state.toPeerFragment(report), null, 2)),
    state.filename(report, 'peer.json'), 'application/json');
  status('PEER setup fragment exported. Load it in the Report Builder.', 'ok');
});

/* ---------- imports ---------- */
const fileInput = document.getElementById('import-file');
document.getElementById('import-json').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = safeParse(reader.result);

    // A register file names its own parameters; a session names runs.
    if (data && Array.isArray(data.params) && Array.isArray(data.groups)) {
      state.installRegister(data);
      draw();
      status(`Register "${data.label || data.id}" loaded — ` +
             `${data.params.length} parameters.`, 'ok');
      return;
    }

    const next = state.migrate(data);
    if (!next) { status('That file is not a run plan session or a setup register.', 'warn'); return; }
    report = next;
    ui.openRun = null;
    state.save(report);
    draw();
    status('Session loaded.', 'ok');
  };
  reader.readAsText(file);
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Clear this run plan and start again? It is not recoverable unless you exported it.')) return;
  report = state.blank();
  ui.openRun = null;
  state.save(report);
  draw();
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => state.save(report));

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
