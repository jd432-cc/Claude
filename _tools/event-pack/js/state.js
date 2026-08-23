/* =============================================================
   TheRacingData — Event Pack Builder
   The report register, and the collections the engine does not
   know about.

   Same arrangement as the run plan: the shared engine holds the
   store, the validation and the DOCX export; the lists with
   nested objects inside them — sessions, crew, contacts,
   vehicles, checklists, spares — are added on top of the engine's
   blank and normalised on the way in.

   Checklist state is part of the session and therefore part of
   the autosave, so a half-packed list survives a browser close.
   ============================================================= */

import { createRegistry, useRegistry }
  from '../../_shared/report-engine/registry.js';
import * as store from '../../_shared/report-engine/store.js';
import { EVENT_PACK, profileOf } from './schemas/event-pack.js';
import { DEFAULT_PROFILE, toIcs, checklistProgress } from './calc/timetable.js';

export const REPORTS = [EVENT_PACK];

useRegistry(createRegistry(REPORTS));

export { SCHEMA, byId as reportById, setActive as setReport }
  from '../../_shared/report-engine/registry.js';
export { profileOf };

/* The collections, and what an empty row of each looks like. Held in
   one place so the form, the migration and the exports cannot disagree
   about what a crew member is. */
export const COLLECTIONS = {
  contacts: {
    label: 'Officials and contacts',
    blank: () => ({ role: '', name: '', phone: '', note: '' }),
    columns: [['role', 'Role'], ['name', 'Name'], ['phone', 'Phone'], ['note', 'Note']],
  },
  crew: {
    label: 'Crew',
    blank: () => ({ name: '', role: '', arrival: '', licence: '', credential: '' }),
    columns: [['name', 'Name'], ['role', 'Role'], ['arrival', 'Arrival'],
              ['licence', 'Licence'], ['credential', 'Credential']],
  },
  vehicles: {
    label: 'Vehicles',
    blank: () => ({ carNo: '', class: '', driver: '', chassis: '', engineSeal: '' }),
    columns: [['carNo', 'Car'], ['class', 'Class'], ['driver', 'Driver'],
              ['chassis', 'Chassis'], ['engineSeal', 'Engine seal']],
  },
  sessions: {
    label: 'Sessions',
    blank: () => ({
      id: '', type: '', label: '', start: '', duration_min: '',
      tyres: '', fuel_l: '', objective: '', cars: '', crew: '',
    }),
    columns: [['label', 'Session'], ['type', 'Type'],
              ['start', 'Start, ISO 8601 with offset'],
              ['duration_min', 'Minutes'], ['tyres', 'Tyres'], ['fuel_l', 'Fuel, l'],
              ['cars', 'Cars'], ['crew', 'Crew'], ['objective', 'Objective']],
  },
  buildUp: {
    label: 'Build-up profile',
    blank: () => ({ offset_min: '', task: '', owner: '', mandatory: true }),
    columns: [['offset_min', 'Offset, min'], ['task', 'Task'], ['owner', 'Owner']],
  },
};

export function blank() {
  return {
    ...store.blank(),
    event: {
      name: '', championship: '', round: '', venue: '', country: '',
      dateFrom: '', dateTo: '', timezone: '',
    },
    contacts: [],
    crew: [],
    vehicles: [],
    sessions: [],
    // The default profile is copied in rather than referenced, because
    // the first thing a team does is edit it and the second thing is
    // save it.
    buildUp: DEFAULT_PROFILE.map(t => ({ ...t })),
    checklists: [],
    allocation: { tyreSets: '', fuel_l: '', spares: [] },
    notes: '',
  };
}

export function migrate(data) {
  const base = store.migrate(data);
  if (!base) return null;
  const empty = blank();

  base.event = { ...empty.event, ...(data?.event || {}) };
  for (const key of ['contacts', 'crew', 'vehicles', 'sessions']) {
    base[key] = Array.isArray(data?.[key])
      ? data[key].map(row => ({ ...COLLECTIONS[key].blank(), ...row }))
      : [];
  }
  base.buildUp = Array.isArray(data?.buildUp) && data.buildUp.length
    ? data.buildUp.map(row => ({ ...COLLECTIONS.buildUp.blank(), ...row }))
    : empty.buildUp;

  // Checklist state is part of the session: a half-packed list has to
  // survive a browser close, which is the only reason anybody trusts
  // the ticks.
  base.checklists = Array.isArray(data?.checklists)
    ? data.checklists.map(list => ({
        id: list?.id || '',
        title: list?.title || '',
        note: list?.note || '',
        items: Array.isArray(list?.items)
          ? list.items.map(i => ({
              text: i?.text || '', category: i?.category || '',
              qty: i?.qty ?? '', packed: !!i?.packed,
            }))
          : [],
      }))
    : [];

  base.allocation = {
    ...empty.allocation,
    ...(data?.allocation || {}),
    spares: Array.isArray(data?.allocation?.spares)
      ? data.allocation.spares.map(s => ({
          part: s?.part || '', qty: s?.qty ?? '', location: s?.location || '',
        }))
      : [],
  };
  base.notes = data?.notes ?? '';
  return base;
}

export function load() {
  const raw = store.load();
  return raw ? migrate(raw) : null;
}

export const save = store.save;
export const validate = store.validate;
export const derive = store.derive;
export const filename = store.filename;

export function icsFor(report) {
  return toIcs(report.event, report.sessions, profileOf(report));
}

export { checklistProgress };

export function download(bytes, name, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
