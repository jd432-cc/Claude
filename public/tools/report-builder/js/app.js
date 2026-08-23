/* =============================================================
   TheRacingData — Report Builder
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import { SCHEMA, REPORTS, setReport } from './schema.js';
import { blank, load, save, migrate, validate, filename } from '../../_shared/report-engine/store.js';
import { Form } from '../../_shared/report-engine/form.js';
import { renderDocx, download } from '../../_shared/report-engine/docx.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const LAST_REPORT = 'trd_report_last';

let report;
let saveTimer = null;

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 4000);
}

/* ---------- report type ----------
   Each type keeps its own autosave, so swapping is not destructive:
   leave a half-written PSDR, fill a PSDB, come back and the PSDR is
   still there. Which one was open last is remembered separately. */
const picker = document.getElementById('report-type');
for (const r of REPORTS) picker.append(new Option(r.menuLabel, r.id));

function remember(id) {
  try { localStorage.setItem(LAST_REPORT, id); } catch { /* private mode */ }
}

function chrome() {
  document.getElementById('doc-title').textContent = SCHEMA.title;
  document.getElementById('doc-sub').textContent = SCHEMA.subtitle;
  document.title = `${SCHEMA.refCode} Builder — TheRacingData`;
  picker.value = SCHEMA.id;
}

/* Adopt whichever report type is now active: reload its saved work,
   point the form at it and redraw. Called on boot, on a swap, and
   after an import that turned out to be a different type. */
function adopt() {
  report = load() || blank();
  remember(SCHEMA.id);
  chrome();
  if (form) {
    form.report = report;
    form.active = SCHEMA.sections[0].id;
    form.render();
  }
}

let form = null;

picker.addEventListener('change', () => {
  save(report);                       // the outgoing type keeps its work
  setReport(picker.value);
  adopt();
  status(`Switched to ${SCHEMA.title}${SCHEMA.subtitle ? ` (${SCHEMA.subtitle})` : ''}.`, 'ok');
});

/* ---------- boot ---------- */
try {
  const last = localStorage.getItem(LAST_REPORT);
  if (last && REPORTS.some(r => r.id === last)) setReport(last);
} catch { /* private mode; first report it is */ }

report = load() || blank();
chrome();

form = new Form(document.body, report, () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!save(report)) {
      status('Autosave unavailable — export to a file before you close this tab.', 'warn');
    }
  }, 400);
});

/* ---------- export ---------- */
async function exportDocx(showGuidance) {
  const issues = validate(report);
  if (issues.length && !showGuidance) {
    const ok = confirm(
      `${issues.length} item${issues.length > 1 ? 's are' : ' is'} unresolved. ` +
      `A RELEASE document should not carry them.\n\nExport anyway?`);
    if (!ok) return;
  }
  status('Building document…');
  try {
    const bytes = await renderDocx(report, { showGuidance,
      provisional: document.getElementById('provisional').checked });
    download(bytes, filename(report, 'docx'), DOCX_MIME);
    status(showGuidance ? 'DRAFT exported — guidance retained.'
                        : 'RELEASE exported — guidance stripped.', 'ok');
  } catch (err) {
    console.error(err);
    const detail = Array.isArray(err) ? err.map(e => e.message).join('; ') : err.message;
    status(`Export failed: ${detail}`, 'warn');
  }
}

function exportJson() {
  const bytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
  download(bytes, filename(report, 'trd.json'), 'application/json');
  status('Session exported. Hand this to whoever writes the PEER.', 'ok');
}

function importJson(file) {
  const was = SCHEMA.id;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = migrate(JSON.parse(reader.result));
      if (!next) throw new Error('not a report file');
      // migrate() follows the file's own report type. If that moved,
      // the chrome and the outgoing type's autosave move with it.
      const swapped = SCHEMA.id !== was;
      report = next;
      form.report = report;
      if (swapped) { form.active = SCHEMA.sections[0].id; remember(SCHEMA.id); chrome(); }
      save(report);
      form.render();
      status(swapped ? `Session loaded — switched to ${SCHEMA.title}.` : 'Session loaded.', 'ok');
    } catch {
      status('That file is not a TheRacingData report.', 'warn');
    }
  };
  reader.readAsText(file);
}

/* ---------- wiring ---------- */
document.getElementById('export-draft').addEventListener('click', () => exportDocx(true));
document.getElementById('export-release').addEventListener('click', () => exportDocx(false));
document.getElementById('export-json').addEventListener('click', exportJson);

const fileInput = document.getElementById('import-file');
document.getElementById('import-json').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) importJson(fileInput.files[0]);
  fileInput.value = '';
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm(`Clear this ${SCHEMA.refCode} and start again? The current one is not recoverable unless you exported it.`)) return;
  report = blank();
  form.report = report;
  save(report);
  form.render();
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => save(report));

form.render();
