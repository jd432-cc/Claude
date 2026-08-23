/* =============================================================
   TheRacingData — Event Pack Builder
   Call times, collisions and the calendar. Pure functions, no
   DOM, importable by Node.

   The engineering content of this tool is one line of arithmetic:

       callTime(session, task) = session.start + task.offset_min

   and two things it would be easy to get approximately right.

   THE FIRST IS TIME ZONES. A session start is stored as ISO 8601
   with an explicit offset, and every function here does its
   arithmetic on the instant and its formatting against the
   *stored* offset. Nothing below calls a Date method that reads
   the host's zone — no getHours, no toLocaleString, no
   toISOString for display. A team crossing a border and reading a
   local timetable off a UK-tz laptop is a real failure and it
   costs a session, and it happens precisely because the naive
   implementation works perfectly on the machine it was written
   on.

   THE SECOND IS COLLISIONS. Two sessions whose build-up windows
   overlap for the same crew member or the same car is the actual
   planning failure a paper timetable hides. It is trivial to
   detect once the call times are computed, and impossible to see
   on paper, which is the whole argument for computing them.
   ============================================================= */

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})$/;

/* ---------- the instant, and the offset it was written in ----------

   Two numbers. `epochMs` is when it happened, which is the same
   everywhere; `offsetMin` is the zone the event is run in, which is
   the only zone the timetable may be printed in. Keeping both means
   the arithmetic never has to know about the host, and the display
   never has to guess. */
export function parseIso(value) {
  const m = ISO.exec(String(value ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, zone] = m;

  const offsetMin = zone === 'Z' ? 0 : offsetToMinutes(zone);
  if (offsetMin === null) return null;

  // Date.UTC on the wall-clock fields, then the offset taken back off:
  // the result is the instant, computed without touching the host zone.
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  return { epochMs: wall - offsetMin * 60000, offsetMin };
}

function offsetToMinutes(zone) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -mins : mins;
}

export function offsetLabel(offsetMin) {
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function addMinutes(instant, minutes) {
  return { epochMs: instant.epochMs + minutes * 60000, offsetMin: instant.offsetMin };
}

/* The wall-clock fields in the event's own zone. Built from the UTC
   accessors on a shifted instant, so the host's zone never enters. */
function fields(instant) {
  const shifted = new Date(instant.epochMs + instant.offsetMin * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatIso(instant) {
  const f = fields(instant);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T${pad(f.hour)}:${pad(f.minute)}:` +
         `${pad(f.second)}${offsetLabel(instant.offsetMin)}`;
}

export function formatTime(instant) {
  const f = fields(instant);
  return `${pad(f.hour)}:${pad(f.minute)}`;
}

export function formatDate(instant) {
  const f = fields(instant);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[f.weekday]} ${f.day} ${months[f.month - 1]}`;
}

/* The UTC stamp a calendar entry carries. This one is deliberately
   Z-form: a calendar reads an instant and shows it in the reader's own
   zone, which is right for a phone and wrong for a pit board. */
export function formatUtcStamp(instant) {
  const d = new Date(instant.epochMs);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ---------- the default build-up profile ----------

   Editable and stored per team. Negative offsets are before the
   session start, which is how a build-up is actually written down. */
export const DEFAULT_PROFILE = [
  { offset_min: -120, task: 'Car released from overnight, covers off', owner: 'Mechanics', mandatory: true },
  { offset_min: -90,  task: 'Tyres selected and pressures set cold', owner: 'Tyre technician', mandatory: true },
  { offset_min: -60,  task: 'Fuel to session load, weight recorded', owner: 'Mechanics', mandatory: true },
  { offset_min: -45,  task: 'Driver briefed, run plan issued', owner: 'Race engineer', mandatory: true },
  { offset_min: -30,  task: 'Systems check, logger armed, datalogger clock synced', owner: 'Data engineer', mandatory: true },
  { offset_min: -15,  task: 'Engine start and warm-up', owner: 'Mechanics', mandatory: true },
  { offset_min: -10,  task: 'Crew to grid or assembly', owner: 'Team manager', mandatory: true },
  { offset_min: -5,   task: 'Car in assembly', owner: 'Team manager', mandatory: true },
  { offset_min: 0,    task: 'Session start', owner: 'Driver', mandatory: true },
  { offset_min: 5,    task: 'First data check', owner: 'Data engineer', mandatory: false },
];

/* ---------- call times ---------- */

export function callTime(session, task) {
  const start = parseIso(session.start);
  if (!start) return null;
  return addMinutes(start, Number(task.offset_min) || 0);
}

/* One session's build-up, in the order it happens. */
export function timetable(session, profile = DEFAULT_PROFILE) {
  const start = parseIso(session.start);
  if (!start) return { session, start: null, tasks: [], window: null };

  const tasks = [...profile]
    .sort((a, b) => Number(a.offset_min) - Number(b.offset_min))
    .map(task => {
      const at = addMinutes(start, Number(task.offset_min) || 0);
      return {
        ...task,
        at,
        iso: formatIso(at),
        time: formatTime(at),
        date: formatDate(at),
      };
    });

  const from = tasks.length ? tasks[0].at.epochMs : start.epochMs;
  const to = start.epochMs + (Number(session.duration_min) || 0) * 60000;

  return {
    session,
    start,
    startTime: formatTime(start),
    startDate: formatDate(start),
    startIso: formatIso(start),
    offset: offsetLabel(start.offsetMin),
    tasks,
    window: { from, to },
  };
}

export function timetables(sessions, profile = DEFAULT_PROFILE) {
  return (sessions || []).map(s => timetable(s, s.profile || profile));
}

/* ---------- collisions ----------

   Two sessions' build-up windows overlapping matters only if they
   want the same person or the same car at the same time. Two cars
   with two crews preparing in parallel is a team doing its job. */
export function collisions(sessions, profile = DEFAULT_PROFILE) {
  const plans = timetables(sessions, profile).filter(p => p.start);
  const out = [];

  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i], b = plans[j];
      const from = Math.max(a.window.from, b.window.from);
      const to = Math.min(a.window.to, b.window.to);
      if (from >= to) continue;

      const shared = sharedResources(a.session, b.session);
      if (!shared.length) continue;

      const inWindow = plan => plan.tasks
        .filter(t => t.at.epochMs >= from && t.at.epochMs < to);

      const aTasks = inWindow(a);
      const bTasks = inWindow(b);

      out.push({
        a: a.session.id ?? a.session.label,
        b: b.session.id ?? b.session.label,
        shared,
        overlap_min: Math.round((to - from) / 60000),
        from: formatTime({ epochMs: from, offsetMin: a.start.offsetMin }),
        to: formatTime({ epochMs: to, offsetMin: a.start.offsetMin }),
        tasks: [
          ...aTasks.map(t => ({ session: a.session.label, task: t.task, time: t.time, owner: t.owner })),
          ...bTasks.map(t => ({ session: b.session.label, task: t.task, time: t.time, owner: t.owner })),
        ],
        message:
          `${a.session.label} and ${b.session.label} overlap by ` +
          `${Math.round((to - from) / 60000)} minutes ` +
          `(${formatTime({ epochMs: from, offsetMin: a.start.offsetMin })}–` +
          `${formatTime({ epochMs: to, offsetMin: a.start.offsetMin })}), ` +
          `sharing ${shared.join(', ')}. ` +
          `Overlapping tasks: ${[...aTasks, ...bTasks].map(t => t.task).join('; ')}.`,
      });
    }
  }
  return out;
}

function sharedResources(a, b) {
  const shared = [];
  const carsA = list(a.cars ?? a.carNo);
  const carsB = list(b.cars ?? b.carNo);
  for (const car of carsA) if (carsB.includes(car)) shared.push(`car ${car}`);

  const crewA = list(a.crew);
  const crewB = list(b.crew);
  for (const person of crewA) if (crewB.includes(person)) shared.push(person);

  // Two sessions naming neither a car nor a crew are the same one car
  // and the same one crew until somebody says otherwise. Assuming they
  // are independent would hide the collision the tool exists to find.
  if (!carsA.length && !carsB.length && !crewA.length && !crewB.length) {
    shared.push('the car and the crew');
  }
  return shared;
}

function list(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------- the calendar ----------

   A small function that puts the plan on every crew phone without an
   account, a login or a server, which is the only reason it is here. */
export function toIcs(event, sessions, profile = DEFAULT_PROFILE) {
  const plans = timetables(sessions, profile).filter(p => p.start);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TheRacingData//Event Pack Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(event?.name || 'Event')}`,
  ];

  for (const plan of plans) {
    const s = plan.session;
    lines.push(...vevent({
      uid: `${slug(event?.name)}-${slug(s.id || s.label)}@theracingdata`,
      start: plan.start,
      minutes: Number(s.duration_min) || 30,
      summary: `${s.label}${s.type ? ` (${s.type})` : ''}`,
      description: [s.objective, s.tyres && `Tyres: ${s.tyres}`,
                    s.fuel_l && `Fuel: ${s.fuel_l} l`].filter(Boolean).join('\\n'),
      location: event?.venue || '',
    }));

    // Only the mandatory tasks. A calendar with every optional check in
    // it is a calendar nobody keeps subscribed.
    for (const task of plan.tasks.filter(t => t.mandatory)) {
      lines.push(...vevent({
        uid: `${slug(event?.name)}-${slug(s.id || s.label)}-${task.offset_min}@theracingdata`,
        start: task.at,
        minutes: 5,
        summary: `${task.task} — ${s.label}`,
        description: task.owner ? `Owner: ${task.owner}` : '',
        location: event?.venue || '',
      }));
    }
  }

  lines.push('END:VCALENDAR');
  // RFC 5545 wants CRLF, and a calendar that uses bare LF is rejected
  // by some clients and silently mangled by others.
  return lines.join('\r\n') + '\r\n';
}

function vevent({ uid, start, minutes, summary, description, location }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(start)}`,
    `DTSTART:${formatUtcStamp(start)}`,
    `DTEND:${formatUtcStamp(addMinutes(start, minutes))}`,
    `SUMMARY:${escapeIcs(summary)}`,
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    'END:VEVENT',
  ];
}

function escapeIcs(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function slug(text) {
  return String(text ?? 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    || 'x';
}

/* ---------- checklists ---------- */

export function checklistProgress(list) {
  const items = list?.items || [];
  const packed = items.filter(i => i.packed).length;
  return { packed, total: items.length, pct: items.length ? packed / items.length : 0 };
}
