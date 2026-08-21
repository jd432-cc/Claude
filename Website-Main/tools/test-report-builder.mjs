#!/usr/bin/env node
/* =============================================================
   TheRacingData — report builder integration test.

   Exercises the real export path: schema -> store -> payload ->
   tagged template -> .docx, and asserts against the produced XML
   rather than against the payload, so a template that stops
   accepting a value is caught here and not in the paddock.

   Run from the repo root:  node tools/test-report-builder.mjs
   ============================================================= */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/report-builder');

/* The exporter fetches its template relatively; in Node we serve it
   straight off disk. */
globalThis.fetch = async (url) => {
  const buf = await readFile(join(TOOL, String(url)));
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(
    buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

const { blank, derive, validate, set } = await import(join(TOOL, 'js/store.js'));
const { renderDocx, buildPayload } = await import(join(TOOL, 'js/docx.js'));
const { evaluate, UnsupportedExpression } = await import(join(TOOL, 'js/resolve.js'));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

/* ---------- resolver ---------- */
ok('resolver: dotted path',
   evaluate('a.b.c', { a: { b: { c: 42 } } }) === 42);
ok('resolver: loop index arithmetic',
   evaluate('$idx+1', { $idx: 0 }) === 1);
ok('resolver: missing path is undefined, not a throw',
   evaluate('nope.deep', {}) === undefined);
let threw = false;
try { evaluate('fetch("/x")', {}); } catch (e) { threw = e instanceof UnsupportedExpression; }
ok('resolver: rejects anything that is not a path', threw);

/* ---------- derived values ---------- */
const r = blank();
Object.assign(r, {
  bestLap: '2:14.82', theoreticalBest: '2:13.41',
  round: 'r04', venueCode: 'sil', carCode: '11',
  opportunities: [
    { corner: 'Brooklands', evidence: 'Steer +14 deg', rootCause: 'Understeer', gain: '0.62', owner: 'JD' },
    { corner: 'Luffield',   evidence: 'Throttle late', rootCause: 'Rotation',   gain: '0.41', owner: 'JD' },
  ],
});
set(r, 'stint.window', '0.71');

ok('derive: gap to theoretical', derive(r, 'gapToTheoretical') === '+1.41 s',
   derive(r, 'gapToTheoretical'));
ok('derive: total recoverable sums the rows', derive(r, 'totalRecoverable') === '1.03 s',
   derive(r, 'totalRecoverable'));
ok('derive: biggest opportunity is the highest gain',
   derive(r, 'biggestOpportunity') === 'Brooklands');
ok('derive: projected best subtracts recoverable',
   derive(r, 'projectedBest') === '2:13.79', derive(r, 'projectedBest'));
ok('derive: report reference is upper-cased and joined',
   derive(r, 'reportRef') === 'R04-SIL-PSDR-11', derive(r, 'reportRef'));
// 0.71 s on a 134.82 s lap is 0.527 %, which clears the 0.5 % front-runner
// band. The tightest band it actually fits inside is Experienced.
ok('derive: consistency band is the tightest the window fits',
   derive(r, 'band') === 'Experienced', derive(r, 'band'));

/* ---------- doctrine ---------- */
const noEvidence = blank();
noEvidence.opportunities = [{ corner: 'Copse', evidence: '', rootCause: 'x', gain: '0.2', owner: 'JD' }];
set(noEvidence, 'src.referenceLapChecked', true);
ok('validate: a finding without evidence is rejected',
   validate(noEvidence).some(i => /Evidence is required/.test(i.message)));

const gated = blank();
ok('validate: unconfirmed reference lap gates the report',
   validate(gated).some(i => i.gate));

/* ---------- payload ---------- */
const payload = buildPayload(r, { showGuidance: false });
ok('payload: opportunities sorted by gain, descending',
   payload.opportunities[0].corner === 'Brooklands');
ok('payload: blank rows dropped', payload.correlation.length === 0);
ok('payload: whole consistency scale present, one marked',
   Object.keys(payload.band).length === 4 &&
   Object.values(payload.band).filter(Boolean).length === 1);
ok('payload: unticked systems render an empty box',
   payload.check.c1 === '\u2610');

const prov = buildPayload(r, { provisional: true });
ok('payload: provisional figures marked (P)',
   prov.bestLap === '2:14.82 (P)', prov.bestLap);
ok('payload: report reference never marked provisional',
   prov.reportRef === 'R04-SIL-PSDR-11');

/* ---------- real render ---------- */
function docText(bytes) {
  // Minimal zip reader: find word/document.xml and inflate it.
  const buf = Buffer.from(bytes);
  const name = Buffer.from('word/document.xml');
  let at = buf.indexOf(name);
  while (at !== -1) {
    const hdr = at - 30;
    if (buf.readUInt32LE(hdr) === 0x04034b50) {
      const method = buf.readUInt16LE(hdr + 8);
      const comp = buf.readUInt32LE(hdr + 18);
      const nameLen = buf.readUInt16LE(hdr + 26);
      const extraLen = buf.readUInt16LE(hdr + 28);
      const start = hdr + 30 + nameLen + extraLen;
      const raw = buf.subarray(start, start + comp);
      // Zip entries are raw DEFLATE, not zlib-wrapped.
      const xml = method === 8 ? inflateRawSync(raw) : raw;
      return xml.toString('utf8');
    }
    at = buf.indexOf(name, at + 1);
  }
  throw new Error('document.xml not found');
}

const release = docText(await renderDocx(r, { showGuidance: false }));
const draft   = docText(await renderDocx(r, { showGuidance: true }));

const texts = [...release.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]);
const flat = texts.join('|');

ok('render: no unresolved tags left in the document', !flat.includes('{'),
   flat.match(/\{[^}]*\}/)?.[0]);
ok('render: header values land', flat.includes('R04-SIL-PSDR-11'));
// One row per finding. Counted on the root-cause strings, which are unique
// per row: the corner name is not, because section 2 echoes the top corner.
ok('render: loop expanded to one row per finding',
   texts.filter(t => t === 'Understeer').length === 1 &&
   texts.filter(t => t === 'Rotation').length === 1);
// Section 2's "single biggest opportunity" restates the highest-gain corner,
// so Brooklands is expected twice: once in the summary, once in the table.
ok('render: summary echoes the highest-gain corner',
   texts.filter(t => t === 'Brooklands').length === 2 &&
   texts.filter(t => t === 'Luffield').length === 1);
ok('render: row numbering runs 1..n', texts.includes('1') && texts.includes('2'));
ok('render: RELEASE strips the guidance lines',
   !release.includes('Ranked by time available'));
ok('render: DRAFT keeps the guidance lines',
   draft.includes('Ranked by time available'));
ok('render: consistency scale still prints every band',
   ['Novice', 'Experienced', 'Front runner', 'Pro'].every(b => flat.includes(b)));
ok('render: achieved band marked in place',
   flat.includes('\u25c2 this session'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
