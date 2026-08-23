#!/usr/bin/env node
/* =============================================================
   TheRacingData — tools/build-tools.mjs

   The tools step of build.ps1, and only the tools step:
   _tools/ -> public/tools/, recursively and verbatim.

   build.ps1 is the build. It throws before it reaches the tools
   step, because it requires _source/Homepage.dc.html,
   _source/Services.dc.html, _source/support.js,
   _source/image-slot.js and data/stats.json, none of which are in
   this tree — and it wants pwsh, which is not on every machine a
   tool is worked on. Neither is a reason to weaken the build, so
   this reproduces the one step needed to see a tool page through
   dev-server.js and nothing else. It writes only under
   public/tools/ and touches no other part of the deploy directory.

   Usage:  node tools/build-tools.mjs [--check]
           --check exits non-zero if public/tools/ is out of date.
   ============================================================= */

import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '_tools');
const OUT = join(ROOT, 'public/tools');

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(path, base));
    else out.push(relative(base, path));
  }
  return out;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

const check = process.argv.includes('--check');
const files = (await walk(SRC)).sort();
let copied = 0, stale = 0;

for (const rel of files) {
  const from = join(SRC, rel);
  const to = join(OUT, rel);
  const src = await readFile(from);
  const dst = (await exists(to)) ? await readFile(to) : null;
  if (dst && dst.equals(src)) continue;
  if (check) { console.error(`  STALE   tools/${rel}`); stale++; continue; }
  await mkdir(dirname(to), { recursive: true });
  await writeFile(to, src);
  copied++;
}

/* A file deleted from _tools/ has to go from the deploy directory too:
   build.ps1 gets that for free by deleting public/ first. */
const built = (await exists(OUT)) ? await walk(OUT) : [];
const orphans = built.filter(f => !files.includes(f)).sort();
for (const rel of orphans) {
  if (check) { console.error(`  ORPHAN  tools/${rel}`); stale++; continue; }
  await rm(join(OUT, rel));
  console.log(`  removed tools/${rel}`);
}

if (check) {
  if (stale) {
    console.error(`\n${stale} file(s) out of date. Run: node tools/build-tools.mjs`);
    process.exit(1);
  }
  console.log('public/tools is up to date.');
  process.exit(0);
}
console.log(`build-tools: ${copied} file(s) copied, ${orphans.length} removed`);
