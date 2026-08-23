/* =============================================================
   TheRacingData — shared report engine
   DOCX export.

   The tagged template is the layout; this file only supplies values.
   Nothing here knows what the document looks like, which is the point:
   re-tag the .docx and the output changes without touching any code.

   Nor does it know which report is being built. Every rule below is
   read off the active schema, so a new report type is a schema and a
   tagged template, not another exporter.
   ============================================================= */

import { createReport } from '../assets/vendor/docx-templates.browser.js';
import { runJs } from './resolve.js';
import { SCHEMA } from './registry.js';
import { derive, get, resolveField } from './store.js';

const TICK = '☑';   // ballot box with check
const BOX  = '☐';   // ballot box
const MARK = '   ◂ this session';

/* Values are strings by the time they reach the template: the resolver
   returns them verbatim and Word renders them verbatim. Formatting
   decisions belong here, not in the document. */
function str(v) {
  return v == null ? '' : String(v);
}

/* Provisional figures carry (P), per the form's own convention. Prose
   is not a figure, and the report reference is an identifier, so
   neither takes the mark. */
function marks(field) {
  return field.type !== 'textarea' && field.computed !== 'reportRef';
}

function prov(value, isProvisional) {
  const v = str(value);
  return v && isProvisional ? `${v} (P)` : v;
}

export function buildPayload(report, options = {}) {
  const { showGuidance = false, provisional = false } = options;
  const p = {};

  /* Dotted field keys are rebuilt as nested objects: the template
     writes {stint.bestLap} and the resolver walks the path. */
  const put = (path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    let node = p;
    for (const k of keys) {
      if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
      node = node[k];
    }
    node[last] = value;
  };

  for (const section of SCHEMA.sections) {
    for (const f of section.fields || []) {
      put(f.k, prov(resolveField(report, f), provisional && marks(f)));
      // A field with a tick column beside it renders Y or nothing.
      if (f.check) put(f.check, get(report, f.check) ? 'Y' : '');
    }
  }

  put('showGuidance', !!showGuidance);

  /* Row loops. Blank rows are dropped so the document has exactly as
     many rows as there is content. */
  for (const section of SCHEMA.sections) {
    const t = section.table;
    if (!t) continue;
    const cols = t.columns.map(c => c.k);
    const rows = (report[t.key] || [])
      .filter(r => cols.some(c => String(r[c] ?? '').trim() !== ''))
      .map(r => Object.fromEntries(cols.map(c => [c, str(r[c])])));
    if (t.sortBy) {
      rows.sort((a, b) => (Number(b[t.sortBy]) || 0) - (Number(a[t.sortBy]) || 0));
    }
    p[t.key] = rows;
  }

  /* Fixed grids: the rows are the document's own, so each cell lands at
     a path the template names outright. */
  for (const section of SCHEMA.sections) {
    const g = section.fixed;
    if (!g) continue;
    for (const row of g.rows) {
      // A totals row is derived from the rows above it, so the arithmetic
      // in the document cannot disagree with the arithmetic in the form.
      const totals = row.derive ? derive(report, row.derive) : null;
      for (const col of g.columns) {
        const at = `${g.key}.${row.k}.${col.k}`;
        if (totals) put(at, str(totals[col.k] ?? ''));
        else put(at, prov(get(report, at), provisional));
      }
    }
  }

  /* Banding: the whole scale prints, the achieved band is marked.
     Showing only the achieved band would lose the comparison that
     makes the scale worth printing. */
  if (SCHEMA.bands) {
    const band = derive(report, 'band');
    p.band = {};
    for (const b of SCHEMA.bands) p.band[b.key] = (b.label === band) ? MARK : '';
  }

  /* Check grids. An unticked item still prints, as an empty box. */
  for (const section of SCHEMA.sections) {
    const cg = section.checkgrid;
    if (!cg) continue;
    p[cg.key] = {};
    cg.items.forEach((_, i) => {
      p[cg.key][`c${i + 1}`] = get(report, `${cg.key}.c${i + 1}`) ? TICK : BOX;
    });
  }

  /* Anything the template needs that is neither a field nor a plain row
     loop — a nested block, a scale split around its selection — is the
     schema's own business, and it gets the last word on the payload. A
     schema with more than one document is handed the options too, so it
     can put a different block in front of each template. */
  SCHEMA.payload?.(report, p, options);

  return p;
}

/* One cache entry per template: switching report type and switching
   back must not re-fetch, and must not serve the wrong document. */
const templateCache = new Map();

async function fetchTemplate(file) {
  if (templateCache.has(file)) return templateCache.get(file);
  const res = await fetch(file);
  if (!res.ok) {
    throw new Error(
      `Could not load ${file} (${res.status}). ` +
      `The template ships with the page; if this persists the deploy is incomplete.`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  templateCache.set(file, bytes);
  return bytes;
}

/* A schema names one template, and may offer more: three views of one
   run plan are three tagged documents over the same report, not three
   reports. `document` picks one from SCHEMA.documents; anything not
   named there falls back to the schema's own template. */
export function documentFile(id) {
  if (!id) return SCHEMA.templateFile;
  const doc = SCHEMA.documents?.find(d => d.id === id);
  if (!doc) throw new Error(`unknown document: ${id}`);
  return doc.templateFile;
}

export async function renderDocx(report, options = {}) {
  const template = await fetchTemplate(documentFile(options.document));
  const data = buildPayload(report, options);
  return createReport({
    template,
    data,
    cmdDelimiter: ['{', '}'],
    runJs,                 // safe resolver; no eval, no iframe, CSP-clean
    rejectNullish: false,  // an unfilled field renders blank, not an error
    failFast: false,
    indentXml: false,      // keeps the output compact and stray whitespace out
  });
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
  // Revoke on the next frame; revoking immediately races the download
  // in Safari and cancels it.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
