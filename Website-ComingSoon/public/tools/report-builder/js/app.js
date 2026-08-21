/* =============================================================
   TheRacingData — Report Builder
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import { SCHEMA } from './schema.js';
import { blank, load, save, migrate, validate, filename } from './store.js';
import { Form } from './form.js';
import { renderDocx, download } from './docx.js';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let report = load() || blank();
let saveTimer = null;

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 4000);
}

const form = new Form(document.body, report, () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!save(report)) {
      status('Autosave unavailable \u2014 export to a file before you close this tab.', 'warn');
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
  status('Building document\u2026');
  try {
    const bytes = await renderDocx(report, { showGuidance,
      provisional: document.getElementById('provisional').checked });
    download(bytes, filename(report, 'docx'), DOCX_MIME);
    status(showGuidance ? 'DRAFT exported \u2014 guidance retained.'
                        : 'RELEASE exported \u2014 guidance stripped.', 'ok');
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
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = migrate(JSON.parse(reader.result));
      if (!next) throw new Error('not a report file');
      report = next;
      form.report = report;
      save(report);
      form.render();
      status('Session loaded.', 'ok');
    } catch {
      status('That file is not a TheRacingData report.', 'warn');
    }
  };
  reader.readAsText(file);
}

/* ---------- wiring ---------- */
document.getElementById('doc-title').textContent = SCHEMA.title;
document.getElementById('doc-sub').textContent = SCHEMA.subtitle;

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
  if (!confirm('Clear this report and start again? The current one is not recoverable unless you exported it.')) return;
  report = blank();
  form.report = report;
  save(report);
  form.render();
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => save(report));

form.render();
