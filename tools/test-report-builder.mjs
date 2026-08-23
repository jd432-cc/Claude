#!/usr/bin/env node
/* =============================================================
   TheRacingData — report builder integration test.

   Exercises the real export path: schema -> store -> payload ->
   tagged template -> .docx, and asserts against the produced XML
   rather than against the payload, so a template that stops
   accepting a value is caught here and not in the paddock.

   All three report types are built, and the swap between them is
   exercised in both directions: each keeps its own work, and a
   session file carries its own type back with it.

   Run from the repo root:  node tools/test-report-builder.mjs
   ============================================================= */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/report-builder');
const ENGINE = join(ROOT, '_tools/_shared/report-engine');

/* The exporter fetches its template relatively; in Node we serve it
   straight off disk. */
globalThis.fetch = async (url) => {
  const buf = await readFile(join(TOOL, String(url)));
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(
    buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

/* Autosave is localStorage. Node has none, and save() answers false
   rather than throwing, so the swap needs a stand-in to have anything
   to keep. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

/* Kept as a namespace, not destructured: SCHEMA is a live binding and
   pulling it out of the module object would freeze it at whichever
   report happened to be loaded first. */
const register = await import(join(TOOL, 'js/schema.js'));
const { REPORTS, setReport } = register;
const { blank, derive, validate, set, save, load, migrate, filename } =
  await import(join(ENGINE, 'store.js'));
const { renderDocx, buildPayload } = await import(join(ENGINE, 'docx.js'));
const { evaluate, UnsupportedExpression } = await import(join(ENGINE, 'resolve.js'));

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

/* ---------- the swap ---------- */
ok('register: all three report types are on the menu',
   REPORTS.map(x => x.id).join() === 'psdr-circuit,peer,psdb',
   REPORTS.map(x => x.id).join());
ok('register: every report names a template and a reference code',
   REPORTS.every(x => x.templateFile && x.refCode && x.menuLabel));

// The PSDR filled above is the outgoing report.
save(r);
const psdrRef = derive(r, 'reportRef');

setReport('psdb');
ok('swap: the active schema follows the picker', register.SCHEMA.id === 'psdb');
const debrief = blank();
debrief.circuit = 'Silverstone GP';
debrief.corners = [{ corner: '6', name: 'Brooklands', gear: '3',
                     confidence: '4', phase: 'braking', balance: 'U3',
                     notes: 'Locks the right front' }];
save(debrief);
ok('swap: a blank follows the schema, not the last report',
   Array.isArray(debrief.corners) && debrief.opportunities === undefined);

setReport('peer');
ok('swap: each type starts empty rather than inheriting',
   load() === null);
const peer = blank();
Object.assign(peer, { round: 'r04', venueCode: 'sil', carCode: '11' });
for (const [k, pct] of [['aero', '40'], ['power', '20'], ['driver', '25'],
                        ['strategy', '10'], ['circumstance', '5']]) {
  set(peer, `gap.${k}.pct`, pct);
}
ok('peer: the gap split totals what the rows say',
   derive(peer, 'gapTotals').pct === '100', derive(peer, 'gapTotals').pct);
ok('peer: a split that misses 100% is raised as an issue',
   (() => { const bad = { ...peer, gap: { ...peer.gap, aero: { pct: '30' } } };
            return validate(bad).some(i => /not 100%/.test(i.message)); })());
set(peer, 'cost.consumables.planned', '4000');
set(peer, 'cost.consumables.actual', '4600');
ok('peer: the cost total carries its variance',
   derive(peer, 'costTotals').variance === '600.00',
   derive(peer, 'costTotals').variance);
ok('peer: the reference names the document type',
   derive(peer, 'reportRef') === 'R04-SIL-PEER-11');

setReport('psdr-circuit');
const back = load();
ok('swap: coming back finds the report where it was left',
   back && derive(back, 'reportRef') === psdrRef, psdrRef);

// A session file names its own type, and opening one follows it.
const swapped = migrate(JSON.parse(JSON.stringify(debrief)));
ok('swap: loading a session file follows the file\'s report type',
   register.SCHEMA.id === 'psdb' && swapped.corners.length === 1,
   register.SCHEMA.id);
ok('swap: the filename follows the report type',
   filename(swapped, 'docx') === 'PSDB.docx', filename(swapped, 'docx'));

/* ---------- the other two documents render ---------- */
const psdb = docText(await renderDocx(swapped, { showGuidance: false }));
const psdbText = [...psdb.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
ok('psdb: no unresolved tags left in the document', !psdbText.includes('{'),
   psdbText.match(/\{[^}]*\}/)?.[0]);
ok('psdb: the corner block is filled from the phase rows',
   psdbText.includes('Brooklands') && psdbText.includes('Locks the right front'));
// The scale prints whole and the circled token is a run of its own, bolded.
ok('psdb: the balance scale prints whole, split around the selection',
   psdbText.includes('U5  U4  ') && psdbText.includes('U3') &&
   psdbText.includes('  U2  U1    N    O1  O2  O3  O4  O5'));
const bold = [...psdb.matchAll(/<w:r>(?:(?!<\/w:r>).)*?<w:b\/>(?:(?!<\/w:r>).)*?<w:t[^>]*>([^<]*)<\/w:t>/gs)]
  .map(m => m[1]);
ok('psdb: the circled token is the bold one', bold.includes('U3') && bold.includes('4'),
   JSON.stringify(bold.slice(-4)));

const empty = blank();
ok('psdb: an unfilled sheet still prints the seventeen blank blocks',
   buildPayload(empty, {}).cornerBlocks.length === 17);

setReport('peer');
const peerXml = docText(await renderDocx(peer, { showGuidance: false }));
const peerDraft = docText(await renderDocx(peer, { showGuidance: true }));
const peerText = [...peerXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
ok('peer: no unresolved tags left in the document', !peerText.includes('{'),
   peerText.match(/\{[^}]*\}/)?.[0]);
ok('peer: the derived totals land in the document',
   peerText.includes('100') && peerText.includes('4600.00'));
ok('peer: RELEASE strips the guidance lines',
   !peerXml.includes('Written last, read first'));
ok('peer: DRAFT keeps the guidance lines',
   peerDraft.includes('Written last, read first'));
ok('peer: the reference lands in the header and again at sign off',
   [...peerText.matchAll(/R04-SIL-PEER-11/g)].length === 2,
   String([...peerText.matchAll(/R04-SIL-PEER-11/g)].length));

setReport('psdr-circuit');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
