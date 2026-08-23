/* =============================================================
   TheRacingData — Report Builder
   PSDB (Driver debrief) schema, v1.

   The debrief sheet is a printed form. Its balance and confidence
   scales are circled by hand, so both still print whole and the
   chosen token is emboldened in place — the payload splits each
   scale around the selection and the template carries the bold run.

   That also means an unfilled PSDB is not an empty document: it is
   the blank sheet, seventeen corner blocks and all, which is what
   gets taken to the halt.
   ============================================================= */

import { reference } from '../values.js';

/* Both scales are reproduced from the blank form, spacing included:
   after tagging, these strings are what print. */
const BALANCE_SCALE = 'U5  U4  U3  U2  U1    N    O1  O2  O3  O4  O5';
const CONFIDENCE_SCALE = '1   2   3   4   5';

const BALANCE = ['U5', 'U4', 'U3', 'U2', 'U1', 'N', 'O1', 'O2', 'O3', 'O4', 'O5'];
const CONFIDENCE = ['1', '2', '3', '4', '5'];

/* The four phase rows of a corner block, in the order the form prints
   them. The keys match the tags the template carries. */
const PHASES = [
  { k: 'braking', label: 'B — Braking (straight line)' },
  { k: 'entry',   label: 'E — Entry (turn-in, trail brake)' },
  { k: 'mid',     label: 'M — Mid (max steer, no B/T)' },
  { k: 'exit',    label: 'X — Exit (unwind + throttle)' },
];

const FOCUS = [
  'Gear selection', 'Braking points', 'Turn-in points', 'Racing line',
  'Confidence',
  'Gearing', 'Understeer', 'Oversteer', 'Tyre grip', 'Corner phases',
];

/* The number of corner blocks the printed form carries. An empty
   report renders that many blank ones rather than none. */
const BLANK_BLOCKS = 17;

/* Split a scale around the chosen token. The template renders the
   three parts as plain, bold, plain, so the selection comes out
   circled in the only way a Word template can circle anything. */
function mark(scale, token) {
  const pick = String(token ?? '').trim();
  if (!pick) return { pre: scale, pick: '', post: '' };
  const at = scale.search(new RegExp(`(?<![\\w])${pick}(?![\\w])`));
  if (at < 0) return { pre: scale, pick: '', post: '' };
  return {
    pre: scale.slice(0, at),
    pick,
    post: scale.slice(at + pick.length),
  };
}

function blankBlock() {
  const block = { number: '', name: '', gear: '', conf: mark(CONFIDENCE_SCALE, '') };
  for (const ph of PHASES) block[ph.k] = { ...mark(BALANCE_SCALE, ''), notes: '' };
  return block;
}

/* One row per corner phase in the form; one block per corner in the
   document. The corner's name, gear and confidence are taken from the
   first row that gives them, so they need typing once. */
function cornerBlocks(report) {
  const rows = (report.corners || []).filter(
    r => ['corner', 'name', 'gear', 'confidence', 'phase', 'balance', 'notes']
      .some(k => String(r[k] ?? '').trim() !== ''));

  const order = [];
  const byCorner = new Map();
  for (const r of rows) {
    const key = String(r.corner ?? '').trim();
    if (!byCorner.has(key)) {
      byCorner.set(key, { number: key, name: '', gear: '', confidence: '', phases: {} });
      order.push(key);
    }
    const b = byCorner.get(key);
    for (const k of ['name', 'gear', 'confidence']) {
      if (!b[k] && String(r[k] ?? '').trim()) b[k] = String(r[k]).trim();
    }
    if (r.phase) b.phases[r.phase] = r;
  }

  if (!order.length) {
    return Array.from({ length: BLANK_BLOCKS }, blankBlock);
  }

  return order.map(key => {
    const b = byCorner.get(key);
    const block = {
      number: b.number, name: b.name, gear: b.gear,
      conf: mark(CONFIDENCE_SCALE, b.confidence),
    };
    for (const ph of PHASES) {
      const row = b.phases[ph.k];
      block[ph.k] = {
        ...mark(BALANCE_SCALE, row?.balance),
        notes: String(row?.notes ?? ''),
      };
    }
    return block;
  });
}

export const PSDB = {
  id: 'psdb',
  version: 1,
  templateFile: 'templates/psdb-v1.0.docx',
  title: 'Post-Session Driver Debrief',
  subtitle: 'Feedback sheet',
  menuLabel: 'PSDB — Post-Session Driver Debrief',
  refCode: 'PSDB',

  derived: {
    reportRef: r => reference(r, 'PSDB'),
  },
  // Built by the payload hook below out of the corner rows.
  provides: ['cornerBlocks'],

  /* Everything the template needs that is not a field or a plain row
     loop. Called with the payload once the generic pass has run. */
  payload(report, p) {
    p.cornerBlocks = cornerBlocks(report);
  },

  sections: [
    {
      id: 'session', n: '0', title: 'Session and car',
      blurb: 'Fill this in before the car comes back. Everything else is written at the halt.',
      fields: [
        { k: 'circuit',    label: 'Track',       placeholder: 'Silverstone GP', hint: 'Sets the title bar. Rendered in capitals.' },
        { k: 'date',       label: 'Date',        placeholder: 'dd.mm.yyyy' },
        { k: 'event',      label: 'Event' },
        { k: 'session',    label: 'Session',     placeholder: 'FP2' },
        { k: 'driver',     label: 'Driver' },
        { k: 'carNumber',  label: 'Car / no.' },
        { k: 'engineer',   label: 'Engineer' },
      ],
    },

    {
      id: 'run', n: '1', title: 'Conditions and run',
      fields: [
        { k: 'weather',    label: 'Weather / conditions' },
        { k: 'temps',      label: 'Air / track temp.', placeholder: '18 / 27 °C' },
        { k: 'tyres',      label: 'Tyres — comp. / set / laps' },
        { k: 'outTime',    label: 'Out time' },
        { k: 'inTimeBest', label: 'In time / best lap' },
        { k: 'fuel',       label: 'Fuel — start / laps' },
      ],
    },

    {
      id: 'debrief', n: '2', title: 'The one thing to improve',
      blurb: 'Debrief now. Get to the driver before anyone else, and take the first answer rather than the tidiest one.',
      fields: [
        { k: 'improve', label: "Driver's #1 thing to improve from this session", type: 'textarea', rows: 3 },
      ],
      checkgrid: {
        key: 'focus', items: FOCUS,
        groups: { 1: 'Race driving', 6: 'Engineering' },
      },
    },

    {
      id: 'notes', n: '3', title: 'Notes',
      fields: [
        { k: 'notes', label: 'Notes', type: 'textarea', rows: 6 },
      ],
    },

    {
      id: 'corners', n: '4', title: 'Corner by corner',
      blurb: 'One row per corner phase. Name, gear and confidence need typing once per corner; the rows are gathered back into a block for each.',
      table: {
        key: 'corners', addLabel: 'Add phase',
        columns: [
          { k: 'corner',     label: 'Corner', w: 8, required: true,
            requiredMsg: 'A corner number is required. Corner numbering follows the track map, and a rating with no corner cannot be read against it.' },
          { k: 'name',       label: 'Name', w: 16 },
          { k: 'gear',       label: 'Gear', w: 6 },
          { k: 'confidence', label: 'Confidence', w: 10, options: CONFIDENCE,
            optionLabels: { 1: '1 — low', 5: '5 — high' } },
          { k: 'phase',      label: 'Phase', w: 14,
            options: PHASES.map(p => p.k),
            optionLabels: Object.fromEntries(PHASES.map(p => [p.k, p.label])) },
          { k: 'balance',    label: 'Balance', w: 10, options: BALANCE,
            optionLabels: { U5: 'U5 — understeer', N: 'N — neutral', O5: 'O5 — oversteer' } },
          { k: 'notes',      label: "Notes / driver's words", w: 26 },
        ],
      },
    },

    {
      id: 'reference', n: '5', title: 'Reference',
      blurb: 'Names the exported file. The sheet itself carries no reference block.',
      fields: [
        { k: 'round',     label: 'Round code', placeholder: 'R04' },
        { k: 'venueCode', label: 'Venue code', placeholder: 'SIL' },
        { k: 'carCode',   label: 'Car code',   placeholder: '11' },
        { k: 'reportRef', label: 'Report reference', computed: 'reportRef',
          hint: 'RND-EVT-PSDB-CAR, built from the three codes above.' },
      ],
    },
  ],
};
