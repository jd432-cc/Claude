/* =============================================================
   TheRacingData — Event Pack Builder
   The schema.

   One event object produces every piece of paper the team takes
   to a circuit or a stage rally. Mostly a schema and four
   templates: the shared engine does the store, the validation and
   the export, and the only real engineering here is the
   backward-derived call times, which live in js/calc/timetable.js.
   ============================================================= */

import { reference } from '../../../_shared/report-engine/values.js';
import {
  timetables, collisions, DEFAULT_PROFILE, formatTime, formatDate, parseIso,
  offsetLabel, checklistProgress,
} from '../calc/timetable.js';

const sessions = r => (r.sessions || []).filter(s => s.label || s.start);
const crew = r => (r.crew || []).filter(c => c.name);
const contacts = r => (r.contacts || []).filter(c => c.name || c.phone);
const vehicles = r => (r.vehicles || []).filter(v => v.carNo || v.driver);

const DERIVED = {
  reportRef: r => reference(r, 'EVPK'),
  sessionCount: r => String(sessions(r).length),
  crewCount: r => String(crew(r).length),
  vehicleCount: r => String(vehicles(r).length),

  /* The first call of the event is the number the crew actually plans
     around: it decides what time the hotel breakfast has to be. */
  firstCall(r) {
    const plans = timetables(sessions(r), profileOf(r)).filter(p => p.start);
    if (!plans.length) return '';
    const earliest = plans.reduce((a, p) =>
      p.window.from < a.window.from ? p : a);
    const task = earliest.tasks[0];
    return task ? `${task.date} ${task.time}` : '';
  },

  collisionCount: r => String(collisions(sessions(r), profileOf(r)).length),

  timezone(r) {
    const first = sessions(r).map(s => parseIso(s.start)).find(Boolean);
    return first ? `UTC${offsetLabel(first.offsetMin)}` : '';
  },

  packedTotal(r) {
    const lists = r.checklists || [];
    const packed = lists.reduce((a, l) => a + checklistProgress(l).packed, 0);
    const total = lists.reduce((a, l) => a + checklistProgress(l).total, 0);
    return total ? `${packed} of ${total}` : '';
  },
};

export function profileOf(report) {
  const rows = (report.buildUp || []).filter(t => t.task);
  return rows.length ? rows : DEFAULT_PROFILE;
}

export const EVENT_PACK = {
  id: 'event-pack',
  version: 1,
  templateFile: 'templates/event-brief-v1.0.docx',
  documents: [
    { id: 'event-brief', label: 'Event brief', templateFile: 'templates/event-brief-v1.0.docx', suffix: 'BRIEF' },
    { id: 'timetable-card', label: 'Timetable cards', templateFile: 'templates/timetable-card-v1.0.docx', suffix: 'TIMETABLE' },
    { id: 'checklist', label: 'Checklists', templateFile: 'templates/checklist-v1.0.docx', suffix: 'CHECKLIST' },
    { id: 'contact-sheet', label: 'Contact sheet', templateFile: 'templates/contact-sheet-v1.0.docx', suffix: 'CONTACTS' },
  ],
  title: 'Event Pack',
  subtitle: '',
  menuLabel: 'Event pack',
  refCode: 'EVPK',
  derived: DERIVED,

  provides: [
    'sessionCards', 'sessionCards.', 'crewRows', 'crewRows.',
    'contactRows', 'contactRows.', 'vehicleRows', 'vehicleRows.',
    'checklistBlocks', 'checklistBlocks.', 'spareRows', 'spareRows.',
    'collisionRows', 'collisionRows.', 'doc.',
    'tyreSets', 'fuelTotal',
  ],

  sections: [
    {
      id: 'event', n: '0', title: 'Event',
      blurb: 'One event object. Every document below is a view of it.',
      fields: [
        { k: 'event.name', label: 'Event' },
        { k: 'event.championship', label: 'Championship' },
        { k: 'event.round', label: 'Round' },
        { k: 'event.venue', label: 'Venue' },
        { k: 'event.country', label: 'Country' },
        { k: 'event.dateFrom', label: 'From', placeholder: 'dd.mm.yyyy' },
        { k: 'event.dateTo', label: 'To', placeholder: 'dd.mm.yyyy' },
        { k: 'event.timezone', label: 'Event time zone', computed: 'timezone',
          hint: 'Read off the session starts. Every session is stored with an explicit offset; a naive local time is never stored.' },
        { k: 'round', label: 'Round code', placeholder: 'R04' },
        { k: 'venueCode', label: 'Venue code', placeholder: 'SIL' },
        { k: 'carCode', label: 'Car code', placeholder: '11' },
        { k: 'reportRef', label: 'Reference', computed: 'reportRef' },
        { k: 'sessionCount', label: 'Sessions', computed: 'sessionCount' },
        { k: 'crewCount', label: 'Crew', computed: 'crewCount' },
        { k: 'vehicleCount', label: 'Vehicles', computed: 'vehicleCount' },
        { k: 'firstCall', label: 'First call of the event', computed: 'firstCall' },
        { k: 'collisionCount', label: 'Timetable collisions', computed: 'collisionCount' },
        { k: 'packedTotal', label: 'Packed', computed: 'packedTotal' },
        { k: 'allocation.tyreSets', label: 'Tyre sets allocated', numeric: true },
        { k: 'allocation.fuel_l', label: 'Fuel allocated, l', numeric: true },
        { k: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
  ],

  /* ---------- doctrine ----------

     Two failures a paper timetable hides, and one a naive
     implementation creates. */
  issues(report) {
    const out = [];
    const list = sessions(report);

    for (const s of list) {
      if (!s.start) {
        out.push({ section: 'event',
          message: `${s.label || 'A session'} has no start time. Nothing can be derived from it.` });
        continue;
      }
      if (!parseIso(s.start)) {
        out.push({ section: 'event',
          message: `${s.label || 'A session'}: "${s.start}" is not an ISO 8601 time with an ` +
                   `explicit offset. A naive local time read on a laptop in another ` +
                   `country is the wrong time, and it costs a session.` });
      }
    }

    for (const c of collisions(list, profileOf(report))) {
      out.push({ section: 'event', collision: true, message: c.message });
    }

    // A crew member with no arrival is a crew member somebody assumes
    // is already there.
    for (const person of crew(report)) {
      if (!String(person.arrival ?? '').trim()) {
        out.push({ section: 'event',
          message: `${person.name} has no arrival time. Somebody is assuming they are already there.` });
      }
    }

    if (!contacts(report).some(c => /clerk|medical|steward/i.test(c.role || ''))) {
      out.push({ section: 'event',
        message: 'No clerk of the course or medical contact recorded. The contact sheet ' +
                 'is the one page that is read when nothing else is.' });
    }

    return out;
  },

  /* ---------- payload ---------- */
  payload(report, p, options = {}) {
    const doc = options.document || 'event-brief';
    p.doc = { id: doc, label: this.documents.find(d => d.id === doc)?.label || '' };

    const plans = timetables(sessions(report), profileOf(report));

    if (doc === 'event-brief' || doc === 'timetable-card') {
      p.sessionCards = plans.map(plan => ({
        id: String(plan.session.id ?? ''),
        label: plan.session.label || '',
        type: plan.session.type || '',
        date: plan.startDate || '',
        start: plan.startTime || '',
        offset: plan.offset || '',
        duration: plan.session.duration_min == null ? '' : String(plan.session.duration_min),
        tyres: plan.session.tyres || '',
        fuel: plan.session.fuel_l == null ? '' : String(plan.session.fuel_l),
        objective: plan.session.objective || '',
        tasks: plan.tasks.map(t => ({
          offset: signedMinutes(t.offset_min),
          time: t.time,
          task: t.task,
          owner: t.owner || '',
          mandatory: t.mandatory ? 'M' : '',
        })),
      }));
    }

    if (doc === 'event-brief' || doc === 'contact-sheet') {
      p.contactRows = contacts(report).map(c => ({
        role: c.role || '', name: c.name || '',
        phone: c.phone || '', note: c.note || '',
      }));
    }

    if (doc === 'event-brief') {
      p.crewRows = crew(report).map(c => ({
        name: c.name || '', role: c.role || '', arrival: c.arrival || '',
        licence: c.licence || '', credential: c.credential || '',
      }));
      p.vehicleRows = vehicles(report).map(v => ({
        carNo: v.carNo || '', class: v.class || '', driver: v.driver || '',
        chassis: v.chassis || '', engineSeal: v.engineSeal || '',
      }));
      p.spareRows = (report.allocation?.spares || [])
        .filter(s => s.part)
        .map(s => ({ part: s.part, qty: s.qty == null ? '' : String(s.qty),
                     location: s.location || '' }));
      p.collisionRows = collisions(sessions(report), profileOf(report))
        .map(c => ({ a: c.a, b: c.b, shared: c.shared.join(', '),
                     overlap: `${c.overlap_min} min`, window: `${c.from}–${c.to}` }));
      p.tyreSets = report.allocation?.tyreSets == null ? '' : String(report.allocation.tyreSets);
      p.fuelTotal = report.allocation?.fuel_l == null ? '' : String(report.allocation.fuel_l);
    }

    if (doc === 'checklist') {
      p.checklistBlocks = (report.checklists || []).map(list => {
        const progress = checklistProgress(list);
        return {
          title: list.title || '',
          note: list.note || '',
          progress: `${progress.packed} of ${progress.total} packed`,
          items: (list.items || []).map(i => ({
            box: i.packed ? '☑' : '☐',
            text: i.text || '',
            category: i.category || '',
            qty: i.qty == null ? '' : String(i.qty),
          })),
        };
      });
    }
  },
};

function signedMinutes(n) {
  const v = Number(n) || 0;
  return `${v >= 0 ? '+' : ''}${v}`;
}
