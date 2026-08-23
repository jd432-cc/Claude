/* =============================================================
   TheRacingData — Fuel & Stint Calculator
   Entry point: wiring, autosave, import and export.
   ============================================================= */

import { blank, load, save, migrate, toCsv, toPeerFragment, download, SCHEMA_ID }
  from './state.js';
import { compute } from './calc/strategy.js';
import { UI } from './ui.js';

let session = load() || blank();
let saveTimer = null;
let ui = null;

function status(msg, kind = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = `status ${kind}`;
  if (msg) setTimeout(() => {
    if (s.textContent === msg) { s.textContent = ''; s.className = 'status'; }
  }, 4000);
}

/* The fuel catalogue ships with the tool and is read once. Offline is
   the normal case, so a failure to read it falls back to the defaults
   already in the session rather than leaving the picker empty. */
async function fuels() {
  try {
    const res = await fetch('data/fuels.json');
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()).fuels;
  } catch {
    status('Fuel catalogue unavailable — the density in the form still applies.', 'warn');
    return [{
      id: 'petrol', label: 'Petrol, unleaded',
      density_kg_per_l: 0.745, beta_per_c: 0.00095,
      source: 'Default. data/fuels.json did not load.',
    }];
  }
}

function draw(structural = true) {
  const computed = compute(session);
  if (structural) ui.render(computed);
  else ui.update(computed);
  return computed;
}

function changed(_session, structural = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!save(session)) {
      status('Autosave unavailable — export to a file before you close this tab.', 'warn');
    }
  }, 400);
  draw(structural);
}

ui = new UI(session, await fuels(), changed);
if (session.pinned) ui.selected = session.pinned;
draw();

/* ---------- units ---------- */
const units = document.getElementById('units');
units.value = ui.units;
units.addEventListener('change', () => {
  // A display unit is a presentation choice. Nothing in the session
  // moves; the form re-renders in the new unit and the numbers behind
  // it stay in SI.
  ui.units = units.value;
  draw();
  status(`Displaying in ${units.options[units.selectedIndex].text.split('—')[0].trim()}. Stored values are unchanged.`, 'ok');
});

/* ---------- export ---------- */
document.getElementById('export-json').addEventListener('click', () => {
  download(JSON.stringify(session, null, 2), filename('trd.json'), 'application/json');
  status('Session exported.', 'ok');
});

document.getElementById('export-csv').addEventListener('click', () => {
  const computed = compute(session);
  const candidate = ui.candidate(computed);
  if (!candidate) { status('Nothing to export yet.', 'warn'); return; }
  download(toCsv(computed, candidate), filename('csv'), 'text/csv');
  status('Stint table exported for the pit wall.', 'ok');
});

document.getElementById('export-peer').addEventListener('click', () => {
  const computed = compute(session);
  const candidate = ui.candidate(computed);
  if (!candidate) { status('Nothing to export yet.', 'warn'); return; }
  download(JSON.stringify(toPeerFragment(computed, candidate), null, 2),
           filename('peer.json'), 'application/json');
  status('PEER strategy fragment exported. Load it in the Report Builder.', 'ok');
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
    const next = migrate(safeParse(reader.result));
    if (!next) { status('That file is not a fuel and stint session.', 'warn'); return; }
    session = next;
    ui.session = session;
    ui.selected = session.pinned;
    save(session);
    draw();
    status('Session loaded.', 'ok');
  };
  reader.readAsText(file);
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Clear this session and start again? It is not recoverable unless you exported it.')) return;
  session = blank();
  ui.session = session;
  ui.selected = null;
  save(session);
  draw();
  status('Cleared.', 'ok');
});

window.addEventListener('beforeunload', () => save(session));
window.addEventListener('resize', () => ui.renderChart(compute(session)));

function filename(ext) {
  const parts = [session.event.venue, session.event.sessionType]
    .map(p => String(p || '').trim().replace(/\s+/g, '-').toUpperCase())
    .filter(Boolean);
  return `${[SCHEMA_ID.toUpperCase(), ...parts].join('-')}.${ext}`;
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
