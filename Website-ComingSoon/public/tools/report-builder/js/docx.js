/* =============================================================
   TheRacingData — Report Builder
   DOCX export.

   The tagged template is the layout; this file only supplies values.
   Nothing here knows what the document looks like, which is the point:
   re-tag the .docx and the output changes without touching any code.
   ============================================================= */

import { createReport } from '../assets/vendor/docx-templates.browser.js';
import { runJs } from './resolve.js';
import { SCHEMA, CONSISTENCY_BANDS, SYSTEMS_CHECK } from './schema.js';
import { derive, get, resolveField, toSeconds } from './store.js';

const TICK = '\u2611';   // ballot box with check
const BOX  = '\u2610';   // ballot box
const MARK = '   \u25c2 this session';

/* Values are strings by the time they reach the template: the resolver
   returns them verbatim and Word renders them verbatim. Formatting
   decisions belong here, not in the document. */
function str(v) {
  return v == null ? '' : String(v);
}

/* Provisional figures carry (P), per the form's own convention. */
function prov(value, isProvisional) {
  const v = str(value);
  return v && isProvisional ? `${v} (P)` : v;
}

export function buildPayload(report, { showGuidance = false, provisional = false } = {}) {
  const p = {};

  // Scalar and mirrored fields straight off the schema.
  for (const section of SCHEMA.sections) {
    for (const f of section.fields || []) {
      p[f.k.replace(/\./g, '__')] = null;   // placeholder, replaced below
    }
  }

  // Flat scalars, dotted paths preserved for the template.
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
      put(f.k, prov(resolveField(report, f), provisional && f.k !== 'reportRef'));
    }
  }
  // Clear the flattening placeholders.
  for (const k of Object.keys(p)) if (k.includes('__')) delete p[k];

  put('showGuidance', !!showGuidance);

  // Section 1 tick column.
  for (const key of ['logger', 'sampleRate', 'channels',
                     'referenceLap', 'comparisonLap', 'noise']) {
    put(`src.${key}Checked`, get(report, `src.${key}Checked`) ? 'Y' : '');
  }

  // Row loops. Blank rows are dropped so the document has exactly as
  // many rows as there is content.
  const rows = (key, cols) =>
    (report[key] || [])
      .filter(r => cols.some(c => String(r[c] ?? '').trim() !== ''))
      .map(r => Object.fromEntries(cols.map(c => [c, str(r[c])])));

  p.opportunities = rows('opportunities',
    ['corner', 'evidence', 'rootCause', 'gain', 'owner'])
    .sort((a, b) => (Number(b.gain) || 0) - (Number(a.gain) || 0));
  p.correlation   = rows('correlation',
    ['corner', 'words', 'balance', 'evidence', 'verdict']);
  p.setupChanges  = rows('setupChanges',
    ['change', 'reason', 'expected', 'measured', 'keepRevert']);
  p.priorities    = rows('priorities', ['action', 'owner', 'measure']);

  // Consistency banding: the whole scale prints, the achieved band is
  // marked. Showing only the achieved band would lose the comparison
  // that makes the scale worth printing.
  const band = derive(report, 'band');
  p.band = {};
  for (const b of CONSISTENCY_BANDS) p.band[b.key] = (b.label === band) ? MARK : '';

  // Systems check.
  p.check = {};
  SYSTEMS_CHECK.forEach((_, i) => {
    p.check[`c${i + 1}`] = get(report, `check.c${i + 1}`) ? TICK : BOX;
  });

  p.faults = str(report.faults);
  p.verdict = str(report.verdict);

  return p;
}

let templateCache = null;

async function fetchTemplate() {
  if (templateCache) return templateCache;
  const res = await fetch(SCHEMA.templateFile);
  if (!res.ok) {
    throw new Error(
      `Could not load ${SCHEMA.templateFile} (${res.status}). ` +
      `The template ships with the page; if this persists the deploy is incomplete.`);
  }
  templateCache = new Uint8Array(await res.arrayBuffer());
  return templateCache;
}

export async function renderDocx(report, options) {
  const template = await fetchTemplate();
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
