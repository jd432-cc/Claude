#!/usr/bin/env node
/* =============================================================
   TheRacingData — DOCX fixture gate.

   Guards a refactor of the report engine: a fixture session of
   each report type is rendered and compared against a manifest
   recorded before the change. Any difference in any part of the
   document — a dropped value, a reordered loop, a lost style —
   moves a hash and fails here.

   Not a byte comparison of the file. A .docx is a zip and its
   local file headers carry a modification time stamped at render
   time, so two renders of the same report a second apart are
   never byte-identical and never can be. What is compared is
   every zip entry's *content*, by name and by SHA-256, which is
   the whole of the document and none of the clock.

   Run from the repo root:

       node tools/test-docx-fixtures.mjs           # assert
       node tools/test-docx-fixtures.mjs --write   # record

   Record on the tree before a refactor, assert on the tree after.
   ============================================================= */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { entries } from './lib/zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/report-builder');
const FIXTURES = join(ROOT, 'tools/fixtures');

/* The exporter fetches its template relatively; in Node we serve it
   straight off disk. */
globalThis.fetch = async (url) => {
  const buf = await readFile(join(TOOL, String(url)));
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(
    buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

/* The engine moved to _tools/_shared/ in the extraction this file
   exists to gate, so both locations are tried: recording runs on the
   old tree and asserting runs on the new one. */
async function engine() {
  const shared = join(ROOT, '_tools/_shared/report-engine');
  try {
    await readFile(join(shared, 'store.js'));
    await import(join(TOOL, 'js/schema.js'));      // installs the register
    return {
      register: await import(join(TOOL, 'js/schema.js')),
      store: await import(join(shared, 'store.js')),
      docx: await import(join(shared, 'docx.js')),
    };
  } catch {
    return {
      register: await import(join(TOOL, 'js/schema.js')),
      store: await import(join(TOOL, 'js/store.js')),
      docx: await import(join(TOOL, 'js/docx.js')),
    };
  }
}

const { register, store, docx } = await engine();

const REPORTS = ['psdr-circuit', 'peer', 'psdb'];

/* Both DRAFT and RELEASE: the guidance lines are the half of the
   template most likely to move under a refactor of the payload. */
const MODES = [
  ['release', { showGuidance: false }],
  ['draft',   { showGuidance: true }],
];

const sha = buf => createHash('sha256').update(buf).digest('hex');

async function manifest(id) {
  register.setReport(id);
  const raw = JSON.parse(await readFile(join(FIXTURES, `${id}.trd.json`), 'utf8'));
  // migrate() follows the file's own type, which is the type we just set.
  const report = store.migrate(raw);
  const out = {};
  for (const [mode, options] of MODES) {
    const bytes = await docx.renderDocx(report, options);
    const parts = {};
    for (const [name, content] of [...entries(bytes)].sort()) {
      parts[name] = sha(content);
    }
    out[mode] = parts;
  }
  return out;
}

const write = process.argv.includes('--write');
let pass = 0, fail = 0;

for (const id of REPORTS) {
  const path = join(FIXTURES, `${id}.docx.manifest.json`);
  const built = await manifest(id);

  if (write) {
    await writeFile(path, JSON.stringify(built, null, 2) + '\n', 'utf8');
    const n = Object.values(built).reduce((a, m) => a + Object.keys(m).length, 0);
    console.log(`  recorded  ${id}  (${n} entries across ${MODES.length} modes)`);
    continue;
  }

  const expected = JSON.parse(await readFile(path, 'utf8'));
  for (const [mode] of MODES) {
    const want = expected[mode] || {};
    const got = built[mode] || {};
    const names = [...new Set([...Object.keys(want), ...Object.keys(got)])].sort();
    const moved = names.filter(n => want[n] !== got[n]);
    if (moved.length) {
      fail++;
      console.log(`  FAIL  ${id} ${mode}: ${moved.length} entr${moved.length > 1 ? 'ies' : 'y'} changed`);
      for (const n of moved.slice(0, 5)) {
        console.log(`          ${n}: ${want[n] ? want[n].slice(0, 12) : 'absent'} -> ${got[n] ? got[n].slice(0, 12) : 'absent'}`);
      }
    } else {
      pass++;
      console.log(`  ok    ${id} ${mode}: ${names.length} entries identical`);
    }
  }
}

if (write) {
  console.log('\nmanifests recorded. Re-run without --write to assert against them.');
  process.exit(0);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
