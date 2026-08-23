/* =============================================================
   TheRacingData — Load Budget & Voltage Drop
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import { blank, load, save, migrate, newCircuit, toCsv, download, SCHEMA_ID }
  from './state.js';
import { evaluate } from './calc/electrical.js';
import { fromLoom, toLoom, isLoomExport } from './calc/loom.js';
import { UI } from './ui.js';

let session = load() || blank();
let saveTimer = null;
let ui = null;
let spec = null;

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 5000);
}

/* The wire spec ships with the tool. Without it nothing can be
   computed — every ampacity and every insulation rating is in it —
   so a failure to read it is stated plainly rather than papered over
   with a default that would be wrong in an interesting way. */
async function loadSpec() {
  const res = await fetch('data/wire-spec.json');
  if (!res.ok) throw new Error(`wire-spec.json (${res.status})`);
  return res.json();
}

function model() {
  return evaluate(session, spec);
}

function changed(_session, rerender = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!save(session)) {
      status('Autosave unavailable — export to a file before you close this tab.', 'warn');
    }
  }, 400);
  if (rerender) ui.render(model());
  else ui.refresh(model());
}

try {
  spec = await loadSpec();
} catch (err) {
  status(`Could not load ${err.message}. The tool ships with it; if this ` +
         `persists the deploy is incomplete.`, 'warn');
  throw err;
}

ui = new UI(session, spec, changed);
ui.render(model());

/* ---------- circuits ---------- */
document.addEventListener('click', (e) => {
  if (e.target?.id === 'add-circuit') {
    session.circuits.push(newCircuit(nextId()));
    changed(session, true);
  }
  if (e.target?.id === 'export-spec') {
    download(JSON.stringify(spec, null, 2), 'trd-wire-spec.json', 'application/json');
    status('Rating table exported. Edit it against the wire datasheet and load it back.', 'ok');
  }
});

function nextId() {
  const used = new Set(session.circuits.map(c => c.id));
  let n = session.circuits.length + 1;
  while (used.has(`c${n}`)) n++;
  return n;
}

/* ---------- export ---------- */
document.getElementById('export-json').addEventListener('click', () => {
  download(JSON.stringify(session, null, 2), filename('trd.json'), 'application/json');
  status('Session exported.', 'ok');
});

document.getElementById('export-csv').addEventListener('click', () => {
  download(toCsv(session, model()), filename('csv'), 'text/csv');
  status('Circuit table exported.', 'ok');
});

document.getElementById('export-loom').addEventListener('click', () => {
  download(JSON.stringify(toLoom(session, spec), null, 2),
           filename('loom.json'), 'application/json');
  status('Loom Planner file exported. Only the gauge column carries this tool\'s answer.', 'ok');
});

document.getElementById('print-chart').addEventListener('click', () => {
  // The print stylesheet hides everything but #fuse-chart. No blob, no
  // new window, nothing the page's own policy would have to allow.
  window.print();
});

/* ---------- import ----------
   One file input for both kinds of file. A Loom Planner export and a
   .trd.json session are told apart by their shape, not by their
   extension, because both are .json and nobody renames them. */
const fileInput = document.getElementById('import-file');
document.getElementById('import-any').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = safeParse(reader.result);

    if (isLoomExport(data)) {
      const { circuits, _loomState } = fromLoom(data, spec, session.circuits);
      session.circuits = circuits;
      session._loomState = _loomState;
      save(session);
      ui.session = session;
      ui.render(model());
      status(`${circuits.length} wires imported from the Loom Planner. ` +
             `Fill in the load current and the duty cycle.`, 'ok');
      return;
    }

    const next = migrate(data);
    if (!next) { status('That file is neither a load budget session nor a Loom Planner export.', 'warn'); return; }
    session = next;
    ui.session = session;
    save(session);
    ui.render(model());
    status('Session loaded.', 'ok');
  };
  reader.readAsText(file);
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Clear this loom and start again? It is not recoverable unless you exported it.')) return;
  session = blank();
  ui.session = session;
  save(session);
  ui.render(model());
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => save(session));

function filename(ext) {
  const name = String(session.title || 'loom').trim().replace(/\s+/g, '-').toUpperCase();
  return `${SCHEMA_ID.toUpperCase()}-${name}.${ext}`;
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
