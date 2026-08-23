/* =============================================================
   TheRacingData — Event Pack Builder
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import * as state from './state.js';
import { renderDocx, download as downloadBytes }
  from '../../_shared/report-engine/docx.js';
import { UI } from './ui.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let report = null;
let ui = null;
let saveTimer = null;
let catalogue = [];

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 5000);
}

/* A static host cannot list a directory, so the default checklists
   name themselves in an index alongside them. */
async function loadCatalogue() {
  try {
    const res = await fetch('data/checklists/index.json');
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()).lists;
  } catch {
    status('Default checklists unavailable. You can still write your own.', 'warn');
    return [];
  }
}

catalogue = await loadCatalogue();
report = state.load() || state.blank();

function draw() {
  ui.report = report;
  ui.catalogue = catalogue;
  ui.render(state.validate(report));
}

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

ui = new UI(report, catalogue, changed);

ui.onAddList = async (entry) => {
  try {
    const res = await fetch(`data/checklists/${entry.file}`);
    if (!res.ok) throw new Error(String(res.status));
    const list = await res.json();
    // A copy, not a reference: the team edits its own list and the
    // default stays the default.
    report.checklists.push({
      id: list.id, title: list.title, note: list.note,
      items: (list.items || []).map(i => ({ ...i, packed: false })),
    });
    changed(report, true);
    status(`${list.title} added — ${list.items.length} items.`, 'ok');
  } catch {
    status(`Could not load ${entry.file}.`, 'warn');
  }
};

draw();

/* ---------- export ---------- */
const picker = document.getElementById('doc-type');
for (const doc of state.SCHEMA.documents) picker.append(new Option(doc.label, doc.id));

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
    const bytes = await renderDocx(report, { document: document_, showGuidance });
    const suffix = state.SCHEMA.documents.find(d => d.id === document_)?.suffix || '';
    downloadBytes(bytes, state.filename(report, `${suffix}.docx`), DOCX_MIME);
    status(showGuidance ? 'DRAFT exported — guidance retained.'
                        : 'RELEASE exported — guidance stripped.', 'ok');
  } catch (err) {
    console.error(err);
    const detail = Array.isArray(err) ? err.map(e => e.message).join('; ') : err.message;
    status(`Export failed: ${detail}`, 'warn');
  }
}

document.getElementById('export-draft')
  .addEventListener('click', () => exportDocx(picker.value, true));
document.getElementById('export-release')
  .addEventListener('click', () => exportDocx(picker.value, false));

document.getElementById('export-json').addEventListener('click', () => {
  downloadBytes(new TextEncoder().encode(JSON.stringify(report, null, 2)),
                state.filename(report, 'trd.json'), 'application/json');
  status('Session exported.', 'ok');
});

/* The calendar. A small function that puts the plan on every crew
   phone without an account, a login or a server. */
document.getElementById('export-ics').addEventListener('click', () => {
  const ics = state.icsFor(report);
  downloadBytes(new TextEncoder().encode(ics), state.filename(report, 'ics'), 'text/calendar');
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  status(`${events} calendar entries exported — sessions and mandatory tasks.`, 'ok');
});

/* ---------- import ---------- */
const fileInput = document.getElementById('import-file');
document.getElementById('import-json').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = safeParse(reader.result);

    // A checklist file names its own items; a session names an event.
    if (data && Array.isArray(data.items) && data.id && !data.sessions) {
      report.checklists.push({
        id: data.id, title: data.title || data.id, note: data.note || '',
        items: data.items.map(i => ({ ...i, packed: !!i.packed })),
      });
      state.save(report);
      draw();
      status(`Checklist "${data.title || data.id}" added.`, 'ok');
      return;
    }

    const next = state.migrate(data);
    if (!next) { status('That file is not an event pack session or a checklist.', 'warn'); return; }
    report = next;
    state.save(report);
    draw();
    status('Session loaded.', 'ok');
  };
  reader.readAsText(file);
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Clear this event pack and start again? It is not recoverable unless you exported it.')) return;
  report = state.blank();
  state.save(report);
  draw();
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => state.save(report));

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
