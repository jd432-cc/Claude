#!/usr/bin/env node
/* =============================================================
   TheRacingData — event pack builder test.

   Plain Node, no browser, no framework. Every worked example in
   the build brief is an assertion here.

   The time zone assertion is run in a child process with TZ set,
   not asserted against the host: a naive implementation passes
   every time-zone test written on the machine it was authored on,
   which is exactly how a team ends up reading a French timetable
   off a UK laptop.

   Run from the repo root:  node tools/test-event-pack.mjs
   ============================================================= */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { documentXml } from './lib/zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, '_tools/event-pack');
const ENGINE = join(ROOT, '_tools/_shared/report-engine');

globalThis.fetch = async (url) => {
  const buf = await readFile(join(TOOL, String(url)));
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(
    buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const cell = new Map();
globalThis.localStorage = {
  getItem: k => (cell.has(k) ? cell.get(k) : null),
  setItem: (k, v) => cell.set(k, String(v)),
  removeItem: k => cell.delete(k),
};

const tt = await import(join(TOOL, 'js/calc/timetable.js'));
const state = await import(join(TOOL, 'js/state.js'));
const { renderDocx, buildPayload } = await import(join(ENGINE, 'docx.js'));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

/* ---------- parsing ---------- */
const start = tt.parseIso('2026-05-16T09:30:00+01:00');
ok('parse: an ISO time with an offset is understood', start !== null);
ok('parse: the offset is kept, not folded into the instant', start.offsetMin === 60);
ok('parse: the instant is the instant',
   start.epochMs === Date.UTC(2026, 4, 16, 8, 30, 0));
ok('parse: a naive local time is refused', tt.parseIso('2026-05-16T09:30:00') === null);
ok('parse: so is a date on its own', tt.parseIso('2026-05-16') === null);
ok('parse: Z is an offset of zero', tt.parseIso('2026-05-16T09:30:00Z').offsetMin === 0);
ok('parse: a negative offset is negative',
   tt.parseIso('2026-05-16T09:30:00-05:00').offsetMin === -300);

/* ---------- call times ----------
   A session at 2026-05-16T09:30:00+01:00 with a −90 task gives
   08:00+01:00. */
const session = { id: 'fp2', label: 'FP2', start: '2026-05-16T09:30:00+01:00', duration_min: 45 };
const at90 = tt.callTime(session, { offset_min: -90 });
ok('call time: −90 from 09:30 is 08:00', tt.formatTime(at90) === '08:00', tt.formatTime(at90));
ok('call time: and it is still +01:00',
   tt.formatIso(at90) === '2026-05-16T08:00:00+01:00', tt.formatIso(at90));
ok('call time: a positive offset is after the start',
   tt.formatTime(tt.callTime(session, { offset_min: 5 })) === '09:35');
ok('call time: crossing midnight backwards moves the date',
   tt.formatIso(tt.callTime({ start: '2026-05-16T00:30:00+01:00' }, { offset_min: -60 }))
     === '2026-05-15T23:30:00+01:00');

/* ---------- the same calculation in a hostile time zone ----------
   Run in a child process with TZ set, so the handling is exercised
   rather than assumed. A naive implementation passes on the author's
   machine and fails in the paddock. */
const probe = `
  const tt = await import(${JSON.stringify(join(TOOL, 'js/calc/timetable.js'))});
  const s = { start: '2026-05-16T09:30:00+01:00' };
  const at = tt.callTime(s, { offset_min: -90 });
  process.stdout.write(JSON.stringify({
    tz: process.env.TZ,
    hostOffset: new Date().getTimezoneOffset(),
    time: tt.formatTime(at),
    iso: tt.formatIso(at),
    date: tt.formatDate(at),
    utc: tt.formatUtcStamp(at),
  }));
`;

function inZone(tz) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    env: { ...process.env, TZ: tz }, encoding: 'utf8',
  });
  return JSON.parse(out);
}

const utcMinus5 = inZone('America/Bogota');       // UTC-5 all year, no DST
ok('time zone: the host really is UTC-5 for the child',
   utcMinus5.hostOffset === 300, String(utcMinus5.hostOffset));
ok('time zone: read in UTC-5, the call is still 08:00',
   utcMinus5.time === '08:00', utcMinus5.time);
ok('time zone: and still carries +01:00',
   utcMinus5.iso === '2026-05-16T08:00:00+01:00', utcMinus5.iso);
ok('time zone: and still the same date',
   utcMinus5.date === 'Sat 16 May', utcMinus5.date);

const tokyo = inZone('Asia/Tokyo');                // UTC+9
ok('time zone: read in UTC+9, the call is still 08:00',
   tokyo.time === '08:00' && tokyo.iso === utcMinus5.iso, tokyo.iso);
const kiritimati = inZone('Pacific/Kiritimati');   // UTC+14, the far edge
ok('time zone: and at UTC+14', kiritimati.iso === utcMinus5.iso, kiritimati.iso);
ok('time zone: the calendar stamp is the same instant everywhere',
   utcMinus5.utc === tokyo.utc && tokyo.utc === kiritimati.utc &&
   utcMinus5.utc === '20260516T070000Z', utcMinus5.utc);

/* ---------- the default profile ---------- */
ok('profile: the ten default tasks the brief fixes', tt.DEFAULT_PROFILE.length === 10);
ok('profile: it runs from −120 to +5',
   tt.DEFAULT_PROFILE[0].offset_min === -120 && tt.DEFAULT_PROFILE.at(-1).offset_min === 5);
const plan = tt.timetable(session);
ok('timetable: one row per task, in the order they happen',
   plan.tasks.length === 10 &&
   plan.tasks.every((t, i, a) => i === 0 || a[i - 1].at.epochMs <= t.at.epochMs));
ok('timetable: the first call is two hours before the session',
   plan.tasks[0].time === '07:30', plan.tasks[0].time);
ok('timetable: the offset is printed beside the start', plan.offset === '+01:00');

/* ---------- collisions ----------
   Two sessions 45 minutes apart with a 120-minute build-up profile
   raise a collision flag naming the overlapping tasks. */
const pair = [
  { id: 'a', label: 'Car 11 qualifying', start: '2026-05-16T09:30:00+01:00', duration_min: 20 },
  { id: 'b', label: 'Car 11 race 1', start: '2026-05-16T10:15:00+01:00', duration_min: 30 },
];
const clashes = tt.collisions(pair);
ok('collision: two sessions 45 minutes apart are flagged', clashes.length === 1,
   String(clashes.length));
/* A window runs from the first call to the end of the session, not to
   its start: a car on track is not available for the next session's
   build-up either. A [07:30, 09:50] against a [08:15, 10:45] overlaps
   by 95 minutes. */
ok('collision: the overlap is measured, not asserted',
   clashes[0].overlap_min === 95, String(clashes[0].overlap_min));
ok('collision: a window runs to the end of the session, not to its start',
   tt.timetable(pair[0]).window.to ===
   tt.parseIso(pair[0].start).epochMs + 20 * 60000);
ok('collision: the overlapping tasks are named',
   clashes[0].tasks.length > 0 &&
   clashes[0].message.includes('Overlapping tasks:'),
   clashes[0].message);
ok('collision: and both sessions are named',
   clashes[0].message.includes('Car 11 qualifying') &&
   clashes[0].message.includes('Car 11 race 1'));

// Two cars with two crews preparing in parallel is a team doing its job.
const parallel = [
  { id: 'a', label: 'Car 11 qualifying', start: '2026-05-16T09:30:00+01:00',
    duration_min: 20, cars: '11', crew: 'A. Rowe' },
  { id: 'b', label: 'Car 12 qualifying', start: '2026-05-16T10:15:00+01:00',
    duration_min: 20, cars: '12', crew: 'B. Shaw' },
];
ok('collision: two cars with two crews in parallel is not a collision',
   tt.collisions(parallel).length === 0);
ok('collision: the same car in both is',
   tt.collisions([parallel[0], { ...parallel[1], cars: '11' }]).length === 1);
ok('collision: so is the same person in both',
   tt.collisions([parallel[0], { ...parallel[1], crew: 'A. Rowe' }]).length === 1);
ok('collision: sessions far enough apart are not flagged',
   tt.collisions([pair[0], { ...pair[1], start: '2026-05-16T16:00:00+01:00' }]).length === 0);

/* ---------- the calendar ----------
   The .ics parses, and the event count is the sessions plus their
   mandatory tasks. */
const event = { name: 'Silverstone GP', venue: 'Silverstone' };
const ics = tt.toIcs(event, pair);

const mandatory = tt.DEFAULT_PROFILE.filter(t => t.mandatory).length;
const expected = pair.length + pair.length * mandatory;

ok('ics: it is a calendar', ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
ok('ics: RFC 5545 line endings', ics.includes('\r\n') && !/[^\r]\n/.test(ics));

const parsed = parseIcs(ics);
ok('ics: it parses', parsed.errors.length === 0, parsed.errors.join('; '));
ok('ics: one event per session plus one per mandatory task',
   parsed.events.length === expected, `${parsed.events.length} vs ${expected}`);
ok('ics: every event has a UID, a start and an end',
   parsed.events.every(e => e.UID && e.DTSTART && e.DTEND));
ok('ics: every UID is unique',
   new Set(parsed.events.map(e => e.UID)).size === parsed.events.length);
ok('ics: stamps are UTC, so a phone shows them in its own zone',
   parsed.events.every(e => /^\d{8}T\d{6}Z$/.test(e.DTSTART)));
ok('ics: the sessions themselves are in it',
   parsed.events.some(e => e.SUMMARY.includes('Car 11 qualifying')));
ok('ics: and the mandatory build-up tasks',
   parsed.events.some(e => e.SUMMARY.includes('Tyres selected and pressures set cold')));
ok('ics: the optional task is not',
   !parsed.events.some(e => e.SUMMARY.includes('First data check')));
ok('ics: a comma in a name is escaped',
   tt.toIcs({ name: 'Spa, Belgium' }, pair).includes('Spa\\, Belgium'));

/* A minimal parser, written here rather than depended on: the point of
   the assertion is that the file is well formed by somebody else's
   reading of it, not by the writer's. */
function parseIcs(text) {
  const lines = text.split('\r\n').filter(Boolean);
  const errors = [];
  const events = [];
  let current = null;
  let depth = 0;

  for (const line of lines) {
    if (line === 'BEGIN:VCALENDAR') { depth++; continue; }
    if (line === 'END:VCALENDAR') { depth--; continue; }
    if (line === 'BEGIN:VEVENT') {
      if (current) errors.push('nested VEVENT');
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (!current) errors.push('END:VEVENT with no BEGIN');
      else events.push(current);
      current = null;
      continue;
    }
    const at = line.indexOf(':');
    if (at < 1) { errors.push(`unparseable line: ${line}`); continue; }
    const key = line.slice(0, at).split(';')[0];
    const value = line.slice(at + 1);
    if (current) current[key] = value;
  }
  if (depth !== 0) errors.push('unbalanced VCALENDAR');
  if (current) errors.push('unterminated VEVENT');
  return { events, errors };
}

/* ---------- checklists ----------
   A checklist with 12 of 20 items packed round-trips through
   .trd.json intact. */
const garage = JSON.parse(
  await readFile(join(TOOL, 'data/checklists/garage-kit.json'), 'utf8'));
ok('checklists: the garage kit has 20 items', garage.items.length === 20);

const report = state.blank();
Object.assign(report, {
  event: {
    name: 'Silverstone GP', championship: 'HTCC', round: '4',
    venue: 'Silverstone', country: 'GB',
    dateFrom: '15.05.2026', dateTo: '17.05.2026', timezone: '',
  },
  round: 'r04', venueCode: 'sil', carCode: '11',
  contacts: [
    { role: 'Clerk of the course', name: 'R. Adams', phone: '+44 7700 900001', note: 'Race control' },
    { role: 'Medical', name: 'Circuit medical centre', phone: '+44 7700 900002', note: 'Behind the paddock' },
    { role: 'Team manager', name: 'A. Rowe', phone: '+44 7700 900003', note: '' },
  ],
  crew: [
    { name: 'A. Rowe', role: 'Team manager', arrival: 'Fri 07:00', licence: 'TM-2026', credential: 'P1' },
    { name: 'J. Dunn', role: 'Driver', arrival: 'Fri 08:00', licence: 'NatB-2026', credential: 'D1' },
    { name: 'K. Weiss', role: 'Data engineer', arrival: 'Fri 07:00', licence: '', credential: 'E1' },
  ],
  vehicles: [
    { carNo: '11', class: 'C', driver: 'J. Dunn', chassis: 'BFAT-1170', engineSeal: 'S-4471' },
  ],
  sessions: pair.map(s => ({ ...state.COLLECTIONS.sessions.blank(), ...s })),
  allocation: { tyreSets: 6, fuel_l: 180, spares: [
    { part: 'Front brake pads', qty: 2, location: 'Van, box 3' },
    { part: 'Driveshaft', qty: 1, location: 'Van, floor' },
  ] },
  checklists: [{
    id: garage.id, title: garage.title, note: garage.note,
    items: garage.items.map((item, i) => ({ ...item, packed: i < 12 })),
  }],
  notes: 'Overnight in the paddock, gates 06:30.',
});

const progress = state.checklistProgress(report.checklists[0]);
ok('checklists: 12 of 20 packed', progress.packed === 12 && progress.total === 20);

const roundTripped = state.migrate(JSON.parse(JSON.stringify(report)));
const after = state.checklistProgress(roundTripped.checklists[0]);
ok('checklists: 12 of 20 survives a round trip through .trd.json',
   after.packed === 12 && after.total === 20, `${after.packed} of ${after.total}`);
ok('checklists: the item text survives too',
   roundTripped.checklists[0].items[0].text === garage.items[0].text);
ok('checklists: and which twelve they were',
   roundTripped.checklists[0].items.map(i => (i.packed ? 1 : 0)).join('') ===
   report.checklists[0].items.map(i => (i.packed ? 1 : 0)).join(''));
ok('checklists: every default list is named in the index',
   await indexIsComplete());

async function indexIsComplete() {
  const index = JSON.parse(
    await readFile(join(TOOL, 'data/checklists/index.json'), 'utf8'));
  for (const entry of index.lists) {
    const list = JSON.parse(
      await readFile(join(TOOL, 'data/checklists', entry.file), 'utf8'));
    if (list.id !== entry.id || list.items.length !== entry.count) return false;
  }
  return index.lists.length === 7;
}

const scrut = JSON.parse(
  await readFile(join(TOOL, 'data/checklists/scrutineering.json'), 'utf8'));
ok('checklists: the scrutineering list says to confirm it against the current book',
   /current year/i.test(scrut.note), scrut.note);

/* ---------- migration ---------- */
const older = JSON.parse(JSON.stringify(report));
delete older.crew[0].credential;
delete older.allocation.spares;
delete older.notes;
older._version = 1;
const migrated = state.migrate(older);
ok('migrate: a missing key comes through blank', migrated.crew[0].credential === '');
ok('migrate: a missing collection comes through empty',
   Array.isArray(migrated.allocation.spares) && migrated.allocation.spares.length === 0);
ok('migrate: and what was there is kept', migrated.sessions.length === 2);
ok('migrate: the build-up profile falls back to the default when absent',
   state.migrate({ ...older, buildUp: [] }).buildUp.length === 10);

/* ---------- derived values ---------- */
ok('derive: the reference is built from the three codes',
   state.derive(report, 'reportRef') === 'R04-SIL-EVPK-11',
   state.derive(report, 'reportRef'));
ok('derive: the first call of the event',
   state.derive(report, 'firstCall') === 'Sat 16 May 07:30',
   state.derive(report, 'firstCall'));
ok('derive: the time zone is read off the sessions',
   state.derive(report, 'timezone') === 'UTC+01:00',
   state.derive(report, 'timezone'));
ok('derive: the collisions are counted',
   state.derive(report, 'collisionCount') === '1');
ok('derive: packed is counted across every list',
   state.derive(report, 'packedTotal') === '12 of 20',
   state.derive(report, 'packedTotal'));

/* ---------- doctrine ---------- */
const issues = state.validate(report);
ok('doctrine: the collision is raised as an issue',
   issues.some(i => i.collision));
ok('doctrine: a naive local session start is refused',
   state.validate({ ...report,
     sessions: [{ label: 'FP1', start: '2026-05-16T09:30:00' }] })
     .some(i => /not ISO 8601|not an ISO 8601/.test(i.message)));
ok('doctrine: a crew member with no arrival is raised',
   state.validate({ ...report,
     crew: [{ name: 'A. Rowe', role: 'Team manager', arrival: '' }] })
     .some(i => /no arrival time/.test(i.message)));
ok('doctrine: an event with no clerk or medical contact is raised',
   state.validate({ ...report, contacts: [] })
     .some(i => /clerk of the course or medical/.test(i.message)));

/* ---------- the four documents ---------- */
const brief = buildPayload(report, { document: 'event-brief' });
ok('payload: the brief carries the crew, the vehicles and the contacts',
   brief.crewRows.length === 3 && brief.vehicleRows.length === 1 &&
   brief.contactRows.length === 3);
ok('payload: and the collision table', brief.collisionRows.length === 1);
ok('payload: and the spares', brief.spareRows.length === 2);

const card = buildPayload(report, { document: 'timetable-card' });
ok('payload: one card per session', card.sessionCards.length === 2);
ok('payload: each carrying its own build-up', card.sessionCards[0].tasks.length === 10);
ok('payload: with times in event-local time',
   card.sessionCards[0].tasks[0].time === '07:30');
ok('payload: and the offset printed beside the start',
   card.sessionCards[0].offset === '+01:00');
ok('payload: the timetable card does not carry the crew list',
   card.crewRows === undefined);

const lists = buildPayload(report, { document: 'checklist' });
ok('payload: the checklist carries its blocks', lists.checklistBlocks.length === 1);
ok('payload: a packed item renders a ticked box',
   lists.checklistBlocks[0].items[0].box === '☑');
ok('payload: an unpacked one renders an empty box',
   lists.checklistBlocks[0].items[19].box === '☐');
ok('payload: and the progress is stated',
   lists.checklistBlocks[0].progress === '12 of 20 packed');

for (const [doc, expect] of [
  ['event-brief', ['Silverstone GP', 'A. Rowe', 'Car 11 qualifying', 'Driveshaft']],
  ['timetable-card', ['Car 11 qualifying', '07:30', 'Engine start and warm-up']],
  ['checklist', ['Garage kit', 'Trolley jacks', '12 of 20 packed']],
  ['contact-sheet', ['Clerk of the course', '+44 7700 900001', 'UTC+01:00']],
]) {
  const xml = documentXml(await renderDocx(report, { document: doc, showGuidance: false }));
  const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
  ok(`render: ${doc} leaves no unresolved tags`, !text.includes('{'),
     text.match(/\{[^}]*\}/)?.[0]);
  for (const needle of expect) ok(`render: ${doc} carries "${needle}"`, text.includes(needle));
}

const draftXml = documentXml(await renderDocx(report, { document: 'event-brief', showGuidance: true }));
const releaseXml = documentXml(await renderDocx(report, { document: 'event-brief', showGuidance: false }));
ok('render: DRAFT keeps the guidance lines',
   draftXml.includes('Every time on this document is derived'));
ok('render: RELEASE strips them',
   !releaseXml.includes('Every time on this document is derived'));

ok('render: all four documents the schema names exist',
   state.SCHEMA.documents.length === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
