# Event Pack Builder

One event object that produces every piece of paper the team takes to a circuit
or a stage rally. Built on the shared report engine. No server, no upload,
works offline once loaded.

Live at `/tools/event-pack/`.

---

## Why it is built this way

**The call times are generated, not typed.** Given a session start, every
preparation task has a fixed offset, and the timetable card is derived from the
two. Change a session start and every call time moves with it. A typed
timetable is a timetable that is wrong the first time the schedule slips, and
the schedule always slips.

**Time zones are the thing this tool has to get right rather than
approximately right.** A session start is stored as ISO 8601 with an explicit
offset — `2026-05-16T09:30:00+01:00` — and every function in
`js/calc/timetable.js` does its arithmetic on the instant and its formatting
against the *stored* offset. Nothing in it calls a `Date` method that reads the
host's zone: no `getHours`, no `toLocaleString`, no `toISOString` for display.

That matters because the naive implementation passes every test written on the
machine it was authored on. So the test does not run on that machine: it runs
the same calculation in a child process with `TZ` set to Bogotá (UTC−5), Tokyo
(UTC+9) and Kiritimati (UTC+14), and asserts the same `08:00+01:00` comes back
from all three. A team crossing a border and reading a local timetable off a
UK-tz laptop is a real failure and it costs a session.

A naive local start — one with no offset — is refused by the validator and
marked in the field, rather than being silently interpreted as the browser's
zone.

**Collisions are detected, not hoped about.** Two sessions whose build-up
windows overlap for the same crew member or the same car is the actual planning
failure a paper timetable hides. It is trivial to detect once the call times
are computed, which is most of the argument for computing them. The flag names
both sessions, what they share, the overlap in minutes and the tasks inside it.

A window runs from the first call to the *end* of the session, not to its
start: a car on track is not available for the next session's build-up either.
Two cars with two crews preparing in parallel is a team doing its job and is
not flagged — but two sessions that name neither a car nor a crew are treated
as the same one car and the same one crew until somebody says otherwise,
because assuming they are independent would hide the collision the check exists
to find.

**Checklist state is part of the session.** A half-packed list survives closing
the tab, because a list you cannot trust to still be ticked tomorrow is a list
somebody starts again from the top.

**Nothing leaves the machine.** Autosave is `localStorage`; sharing is an
explicit file export. The page makes no offsite request at all.

---

## The model

`js/calc/timetable.js` is pure — no DOM, importable by Node.

```js
parseIso('2026-05-16T09:30:00+01:00')  → { epochMs, offsetMin }   // or null
callTime(session, task)                → an instant
timetable(session, profile)            → the session with every task's call time
collisions(sessions, profile)          → [{ a, b, shared, overlap_min, tasks, message }]
toIcs(event, sessions, profile)        → an RFC 5545 calendar
```

Two numbers rather than a `Date`: `epochMs` is when it happened, which is the
same everywhere, and `offsetMin` is the zone the event is run in, which is the
only zone the timetable may be printed in. Keeping both means the arithmetic
never has to know about the host and the display never has to guess.

The default build-up profile is the one the brief fixes, −120 to +5, and it is
editable and stored per team. It is copied into a new session rather than
referenced, because the first thing a team does is edit it and the second thing
is save it.

---

## The documents

| Template | What it is |
| --- | --- |
| `event-brief-v1.0.docx` | the cover document: event, crew, vehicles, contacts, sessions, collisions, spares |
| `timetable-card-v1.0.docx` | one card per session with derived call times, A5, for a pit board clip |
| `checklist-v1.0.docx` | tick sheet, one block per list |
| `contact-sheet-v1.0.docx` | emergency and officials, single page, large type |

Built by `tools/make_event_pack_templates.py` and validated by
`tools/validate_template.py`, the same as the run plan's three.

Plus `.trd.json`, and an `.ics` of the sessions and their **mandatory** tasks —
a calendar with every optional check in it is a calendar nobody keeps
subscribed. It is a small function and it puts the plan on every crew phone
without an account, a login or a server, which is the only reason it is here.

---

## The checklists

Seven default lists under `data/checklists/`: garage kit, tool kit, spares,
scrutineering, electrical spares, wet weather, hospitality. Each is a starting
point the team edits and saves back into its own session; adding one copies it,
so the default stays the default.

A static host cannot list a directory, so `index.json` names the files. The
scrutineering list opens with a note to confirm it against the current year's
regulations, and that is not boilerplate: regulations change annually and a
list from last season is a list that fails an item.

---

## Running it

```
node tools/test-event-pack.mjs             # 95 assertions, including three hostile time zones
python3 tools/make_event_pack_templates.py # rebuild the templates
node tools/build-web.mjs                   # regenerate the scoped stylesheet
node tools/build-tools.mjs                 # copy to public/tools/ for local preview
node dev-server.js                         # http://localhost:8788/tools/event-pack/
```

---

## Not built yet

- **Daylight saving across an event.** A start is stored with the offset in
  effect at that moment, which is correct, but the tool will not warn you that
  a Sunday session is an hour out from a Saturday one because the clocks went
  back overnight. That needs a zone name as well as an offset, and it is the
  next thing worth adding here.
- **Crew hours.** Collisions catch two things wanting the same person at once;
  nothing here catches a crew that has been at the circuit for sixteen hours,
  which is a different and more common failure.
- **Rally-specific service park timing.** The build-up profile is a circuit
  profile. A stage rally's service windows are fixed by the road book and the
  model has no concept of one.
- **Importing an official timetable.** Session starts are typed. A championship
  that publishes a machine-readable timetable would remove the one place a
  typo here is expensive.
