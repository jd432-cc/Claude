/* =============================================================
   TheRacingData — Report Builder
   PSDR (Circuit) schema, v1.

   One declarative description drives the form, the validation and
   the DOCX payload. The other report types are more of these, not
   more form code.

   `template` is pinned by filename. The version in the filename and
   the `version` here move together, so a template swap can never
   silently produce a document with the wrong fields in it.
   ============================================================= */

import { get, toSeconds, fromSeconds, reference } from '../../../_shared/report-engine/values.js';

const CONSISTENCY_BANDS = [
  { key: 'novice',       label: 'Novice',       pct: 2.5 },
  { key: 'experienced',  label: 'Experienced',  pct: 1.0 },
  { key: 'frontRunner',  label: 'Front runner', pct: 0.5 },
  { key: 'pro',          label: 'Pro',          pct: 0.25 },
];

const SYSTEMS_CHECK = [
  'Oil pressure and temperature', 'Water temperature', 'Fuel pressure',
  'RPM limiter events', 'Gear shift quality', 'Damper travel and bottoming',
  'Logger dropouts', 'GPS lock quality', 'CAN bus errors',
  'Channel calibration drift', 'Brake pressure zero offset',
  'Tyre pressures and temperatures',
];

/* Derived rather than typed, so the arithmetic in the document can
   never disagree with the arithmetic in the form. */
const DERIVED = {
  totalRecoverable(r) {
    const sum = (r.opportunities || [])
      .reduce((a, o) => a + (Number(o.gain) || 0), 0);
    return sum ? `${sum.toFixed(2)} s` : '';
  },

  gapToTheoretical(r) {
    const b = toSeconds(r.bestLap), t = toSeconds(r.theoreticalBest);
    if (b == null || t == null) return '';
    return `${b - t >= 0 ? '+' : ''}${(b - t).toFixed(2)} s`;
  },

  projectedBest(r) {
    const b = toSeconds(r.bestLap);
    const sum = (r.opportunities || [])
      .reduce((a, o) => a + (Number(o.gain) || 0), 0);
    if (b == null || !sum) return '';
    return fromSeconds(b - sum);
  },

  biggestOpportunity(r) {
    const rows = (r.opportunities || []).filter(o => o.corner || o.gain);
    if (!rows.length) return '';
    return rows.reduce((a, b) =>
      (Number(b.gain) || 0) > (Number(a.gain) || 0) ? b : a).corner || '';
  },

  windowPct(r) {
    const b = toSeconds(r.bestLap), w = Number(get(r, 'stint.window'));
    if (b == null || !Number.isFinite(w) || !b) return '';
    return `${(w / b * 100).toFixed(2)} %`;
  },

  band(r) {
    const b = toSeconds(r.bestLap), w = Number(get(r, 'stint.window'));
    if (b == null || !Number.isFinite(w) || !b) return '';
    const pct = w / b * 100;
    // Tightest band the window fits inside.
    const hit = [...CONSISTENCY_BANDS].reverse().find(x => pct <= x.pct);
    return hit ? hit.label : 'Outside the bands';
  },

  reportRef: r => reference(r, 'PSDR'),
};

export const PSDR_CIRCUIT = {
  id: 'psdr-circuit',
  version: 1,
  templateFile: 'templates/psdr-circuit-v1.2.docx',
  title: 'Post-Session Data Report',
  subtitle: 'Circuit',
  menuLabel: 'PSDR \u2014 Post-Session Data Report',
  refCode: 'PSDR',
  bands: CONSISTENCY_BANDS,
  derived: DERIVED,
  // Supplied by the exporter on top of the fields: the banding scale,
  // marked at the band achieved.
  provides: ['band.'],

  sections: [
    {
      id: 'event', n: '0', title: 'Event and session',
      blurb: 'Identifies the report. Everything below inherits this.',
      fields: [
        { k: 'eventName',    label: 'Event name',        placeholder: 'Silverstone GP', hint: 'Sets the title bar. Rendered in capitals.' },
        { k: 'sessionType',  label: 'Session type',      placeholder: 'Qualifying' },
        { k: 'eventSession', label: 'Event / session',   placeholder: 'Round 4 / Q2' },
        { k: 'circuit',      label: 'Circuit',           placeholder: 'Silverstone GP' },
        { k: 'dates',        label: 'Date(s)',           placeholder: 'dd.mm.yyyy' },
        { k: 'seriesClass',  label: 'Series / class',    placeholder: 'HTCC / Class C' },
        { k: 'carNumber',    label: 'Car / number',      placeholder: 'Escort RS1600 / 11' },
        { k: 'drivers',      label: 'Driver(s)' },
        { k: 'weather',      label: 'Weather / conditions' },
        { k: 'temps',        label: 'Air / track temp.', placeholder: '18 / 27 \u00b0C' },
        { k: 'engineer',     label: 'Engineer' },
      ],
    },

    {
      id: 'sources', n: '1', title: 'Data sources',
      blurb: 'The form says not to proceed until the reference lap is confirmed clean. Until it is, the sections below stay locked.',
      gate: {
        field: 'src.referenceLapChecked',
        message: 'Confirm the reference lap is clean to unlock the rest of the report.',
        lockMessage: 'Section 1 has not confirmed a clean reference lap. A bad reference makes every number below it wrong, so this section stays closed until it is.',
      },
      fields: [
        { k: 'src.logger',        label: 'Logger / system',   check: 'src.loggerChecked' },
        { k: 'src.sampleRate',    label: 'Sample rate',        check: 'src.sampleRateChecked' },
        { k: 'src.channels',      label: 'Channels used',      check: 'src.channelsChecked' },
        { k: 'src.referenceLap',  label: 'Reference lap (no.)', check: 'src.referenceLapChecked' },
        { k: 'src.comparisonLap', label: 'Comparison lap (no.)', check: 'src.comparisonLapChecked' },
        { k: 'src.noise',         label: 'Known noise / calibration issues', type: 'textarea', check: 'src.noiseChecked' },
      ],
    },

    {
      id: 'summary', n: '2', title: 'Headline summary',
      blurb: 'Written last, read first. Three lines.',
      fields: [
        { k: 'verdict',            label: 'Session verdict', type: 'textarea', rows: 4 },
        { k: 'bestLap',            label: 'Best lap',         placeholder: '2:14.82' },
        { k: 'theoreticalBest',    label: 'Theoretical best', placeholder: '2:13.41' },
        { k: 'gapToTheoretical',   label: 'Gap to theoretical', computed: 'gapToTheoretical', hint: 'Best lap minus theoretical best.' },
        { k: 'totalRecoverable',   label: 'Total recoverable', computed: 'totalRecoverable', hint: 'Summed from section 3.' },
        { k: 'projectedBest',      label: 'Projected best lap', computed: 'projectedBest', hint: 'Best lap minus total recoverable.' },
        { k: 'biggestOpportunity', label: 'Single biggest opportunity', computed: 'biggestOpportunity', hint: 'Highest-gain row in section 3.' },
      ],
    },

    {
      id: 'opportunities', n: '3', title: 'Lap time opportunities',
      blurb: 'Ranked by time available. No cause without a trace \u2014 a row will not save without evidence.',
      table: {
        key: 'opportunities', addLabel: 'Add opportunity', sortBy: 'gain',
        columns: [
          { k: 'corner',    label: 'Corner / segment', w: 14 },
          { k: 'evidence',  label: 'Trace evidence',   w: 28, required: true,
            requiredMsg: 'Evidence is required. A number with no method behind it is an opinion in a table.' },
          { k: 'rootCause', label: 'Root cause',       w: 24 },
          { k: 'gain',      label: 'Est. gain, s',     w: 10, numeric: true },
          { k: 'owner',     label: 'Owner',            w: 10 },
        ],
      },
    },

    {
      id: 'correlation', n: '4', title: 'Driver feedback correlation',
      blurb: 'Conflicts are the most valuable rows here. Record them rather than resolving them silently.',
      table: {
        key: 'correlation', addLabel: 'Add corner',
        columns: [
          { k: 'corner',   label: 'Corner', w: 14 },
          { k: 'words',    label: "Driver's words", w: 26 },
          { k: 'balance',  label: 'Reported balance', w: 14, options:
            ['U5','U4','U3','U2','U1','N','O1','O2','O3','O4','O5'] },
          { k: 'evidence', label: 'Data evidence', w: 26 },
          { k: 'verdict',  label: 'A / C / U', w: 10, options: ['A','C','U'],
            optionLabels: { A: 'A \u2014 agrees', C: 'C \u2014 conflicts', U: 'U \u2014 unresolved' } },
        ],
      },
    },

    {
      id: 'stint', n: '5', title: 'Stint and consistency',
      fields: [
        { k: 'stint.bestLap',      label: 'Best lap',           mirror: 'bestLap' },
        { k: 'stint.theoretical',  label: 'Theoretical best',   mirror: 'theoreticalBest' },
        { k: 'stint.gap',          label: 'Gap to theoretical', mirror: 'gapToTheoretical' },
        { k: 'stint.within1pct',   label: 'Laps within 1% of best', numeric: true },
        { k: 'stint.window',       label: 'Consistency window (+/-), s', numeric: true },
        { k: 'stint.windowPct',    label: 'Window as % of best', computed: 'windowPct' },
        { k: 'stint.degradation',  label: 'Degradation over stint' },
        { k: 'stint.errorLaps',    label: 'Error laps (count)', numeric: true },
        { k: 'stint.band',         label: 'Consistency band',   computed: 'band',
          hint: 'Banded from the window %. Every band still prints; this one is marked.' },
      ],
    },

    {
      id: 'systems', n: '6', title: 'Vehicle and systems check',
      blurb: 'Tick what was checked and found good. Leave unchecked what was not looked at.',
      checkgrid: { key: 'check', items: SYSTEMS_CHECK },
      fields: [
        { k: 'faults', label: 'Faults raised for the mechanics', type: 'textarea', rows: 3,
          hint: 'With lap numbers.' },
      ],
    },

    {
      id: 'setup', n: '7', title: 'Setup changes and validation',
      blurb: 'One change at a time. A change with no measured effect is still a result.',
      table: {
        key: 'setupChanges', addLabel: 'Add change',
        columns: [
          { k: 'change',     label: 'Change made', w: 20 },
          { k: 'reason',     label: 'Reason', w: 22 },
          { k: 'expected',   label: 'Expected effect', w: 20 },
          { k: 'measured',   label: 'Measured effect', w: 20 },
          { k: 'keepRevert', label: 'Keep / revert', w: 12, options: ['Keep','Revert','Test'] },
        ],
      },
    },

    {
      id: 'priorities', n: '8', title: 'Next session priorities',
      table: {
        key: 'priorities', addLabel: 'Add priority', max: 3,
        columns: [
          { k: 'action',  label: 'Action', w: 40 },
          { k: 'owner',   label: 'Owner', w: 14 },
          { k: 'measure', label: 'Success measure', w: 32 },
        ],
      },
      fields: [
        { k: 'targetLapTime', label: 'Target lap time' },
        { k: 'targetWindow',  label: 'Target consistency window' },
      ],
    },

    {
      id: 'signoff', n: '9', title: 'Distribution and sign off',
      fields: [
        { k: 'preparedBy',     label: 'Prepared by' },
        { k: 'session',        label: 'Session', mirror: 'sessionType' },
        { k: 'dataArchivedTo', label: 'Data archived to', placeholder: '/2026/R04-Silverstone/car11' },
        { k: 'round',          label: 'Round code', placeholder: 'R04', hint: 'Used to build the report reference.' },
        { k: 'venueCode',      label: 'Venue code', placeholder: 'SIL' },
        { k: 'carCode',        label: 'Car code',   placeholder: '11' },
        { k: 'reportRef',      label: 'Report reference', computed: 'reportRef',
          hint: 'RND-EVT-PSDR-CAR, built from the three codes above.' },
      ],
    },
  ],
};
