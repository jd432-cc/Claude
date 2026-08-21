/* =============================================================
   TheRacingData — Report Builder
   PEER (Post Event Engineering Report) schema, v1.

   The long one: seventeen sections and four appendices. Three
   shapes cover it — plain fields, fixed grids whose rows are the
   document's own, and row loops that print as many rows as there
   is content.

   Two of the grids carry a TOTAL row. It is derived, not typed,
   for the same reason every other figure here is: the arithmetic
   in the document cannot be allowed to disagree with the
   arithmetic in the form. The gap split is the one the form
   itself insists on — attribute the whole deficit or the split is
   not credible — so a split that does not reach 100% is raised as
   an issue rather than left to the reader to notice.
   ============================================================= */

import { get, reference } from '../values.js';

const CONFIDENCE = ['H', 'M', 'L'];
const CONFIDENCE_LABELS = { H: 'H — high', M: 'M — medium', L: 'L — low' };
const YES_NO = ['Y', 'N'];

const SYSTEMS_CHECK = [
  'Oil pressure and temperature', 'Water temperature',
  'Fuel pressure and consumption', 'RPM limiter events',
  'Gear shift quality', 'Damper travel and bottoming',
  'Brake wear and temperatures', 'Tyre pressures and temperatures',
  'Logger uptime', 'GPS lock quality and satellite count',
  'CAN bus errors', 'Channel calibration drift',
  'Brake pressure zero offset', 'Video sync and coverage',
  'Files downloaded and archived', 'Backup taken before leaving circuit',
];

/* The five attributions the form fixes. Between them they have to
   account for the whole deficit. */
const GAP_ROWS = [
  { k: 'aero',         label: 'Car, aero and mechanical' },
  { k: 'power',        label: 'Car, powertrain' },
  { k: 'driver',       label: 'Driver' },
  { k: 'strategy',     label: 'Strategy and execution' },
  { k: 'circumstance', label: 'Circumstance, traffic, weather' },
];

const COST_ROWS = [
  { k: 'consumables', label: 'Consumables, tyres and fuel' },
  { k: 'damage',      label: 'Damage and repair' },
  { k: 'freight',     label: 'Freight, travel and accommodation' },
  { k: 'personnel',   label: 'Personnel and contractors' },
  { k: 'unplanned',   label: 'Unplanned spend' },
];

const sum = (report, key, rows, col) =>
  rows.reduce((a, r) => a + (Number(get(report, `${key}.${r.k}.${col}`)) || 0), 0);

const money = n => (n ? n.toFixed(2) : '');

export const PEER = {
  id: 'peer',
  version: 1,
  templateFile: 'templates/peer-v1.4.docx',
  title: 'Post Event Engineering Report',
  subtitle: 'Performance engineering',
  menuLabel: 'PEER — Post Event Engineering Report',
  refCode: 'PEER',

  derived: {
    reportRef: r => reference(r, 'PEER'),

    gapTotals(r) {
      const pct = sum(r, 'gap', GAP_ROWS, 'pct');
      const s = sum(r, 'gap', GAP_ROWS, 's');
      return { pct: pct ? String(Math.round(pct * 100) / 100) : '', s: money(s) };
    },

    costTotals(r) {
      const planned = sum(r, 'cost', COST_ROWS, 'planned');
      const actual = sum(r, 'cost', COST_ROWS, 'actual');
      return {
        planned: money(planned),
        actual: money(actual),
        variance: money(actual - planned),
        comment: '',
      };
    },
  },

  /* The form's own rule, enforced rather than printed: the split has
     to account for the whole deficit. */
  issues(report) {
    const pct = sum(report, 'gap', GAP_ROWS, 'pct');
    if (!pct) return [];
    if (Math.abs(pct - 100) < 0.5) return [];
    return [{
      section: 'gap',
      message: `Where the gap sits: the split totals ${Math.round(pct * 100) / 100}%, not 100%. ` +
               `Attribute the whole deficit or the split is not credible.`,
    }];
  },

  sections: [
    {
      id: 'header', n: '0', title: 'Header block',
      blurb: 'Identifies the report and who may rely on it. Issue within 48 hours of the chequered flag.',
      fields: [
        { k: 'team',           label: 'Team', placeholder: 'TheRacingData', hint: 'Sets the title bar. Rendered in capitals.' },
        { k: 'eventRounds',    label: 'Event / round(s)' },
        { k: 'circuit',        label: 'Circuit' },
        { k: 'dates',          label: 'Date(s)', placeholder: 'dd.mm.yyyy - dd.mm.yyyy' },
        { k: 'seriesClass',    label: 'Series / class' },
        { k: 'carNumber',      label: 'Car / number' },
        { k: 'drivers',        label: 'Driver(s)' },
        { k: 'preparedBy',     label: 'Prepared by' },
        { k: 'reviewedBy',     label: 'Reviewed by' },
        { k: 'issued',         label: 'Issued by' },
        { k: 'distribution',   label: 'Distribution' },
        { k: 'statusRevision', label: 'Status / revision', placeholder: 'DRAFT / a' },
        { k: 'round',          label: 'Round code', placeholder: 'R04' },
        { k: 'venueCode',      label: 'Venue code', placeholder: 'SIL' },
        { k: 'carCode',        label: 'Car code', placeholder: '11' },
        { k: 'reportRef',      label: 'Report reference', computed: 'reportRef',
          hint: 'RND-EVT-PEER-CAR, built from the three codes above. Prints in the header and again at sign off.' },
      ],
    },

    {
      id: 'summary', n: 'ES', title: 'Executive summary',
      blurb: 'Written last, read first. Three findings, no more — a fourth deletes the first.',
      fields: [
        { k: 'qualified',       label: 'Qualified' },
        { k: 'finished',        label: 'Finished' },
        { k: 'points',          label: 'Points scored' },
        { k: 'champChange',     label: 'Championship change' },
        { k: 'ourBestLap',      label: 'Our best lap' },
        { k: 'classBestLap',    label: 'Class best lap' },
        { k: 'gapToClassBest',  label: 'Gap to class best, s', numeric: true },
        { k: 'gapPct',          label: 'Gap to class best, %', numeric: true },
        { k: 'gapTrend',        label: 'Gap trend vs last round' },
        { k: 'why',             label: 'Why, in three sentences', type: 'textarea', rows: 4,
          hint: 'The pace deficit was mostly X, we lost Y positions to Z, the underlying cause is A, fixable by B.' },
      ],
      table: {
        key: 'findings', addLabel: 'Add finding', max: 3,
        columns: [
          { k: 'finding',  label: 'Finding', w: 26 },
          { k: 'evidence', label: 'Evidence', w: 26, required: true,
            requiredMsg: 'Evidence is required. No cause without a trace.' },
          { k: 'conf',     label: 'Conf.', w: 10, options: CONFIDENCE, optionLabels: CONFIDENCE_LABELS },
          { k: 'section',  label: 'Section', w: 10 },
        ],
      },
    },

    {
      id: 'scope', n: '1', title: 'Scope and data provenance',
      blurb: 'Written first, so that every later number inherits what the reader may rely on.',
      fields: [
        { k: 'eventCovered',        label: 'Event covered', placeholder: 'sessions, days and races included' },
        { k: 'writtenFor',          label: 'Written for', placeholder: 'audience and assumed familiarity' },
        { k: 'primarySources',      label: 'Primary sources', type: 'textarea' },
        { k: 'secondarySources',    label: 'Secondary sources', type: 'textarea' },
        { k: 'dataConfidence',      label: 'Overall data confidence' },
        { k: 'dataConfidenceBasis', label: 'Basis', type: 'textarea',
          hint: 'Sample size, data quality, what remains unverified.' },
      ],
      table: {
        key: 'caveats', addLabel: 'Add caveat',
        columns: [
          { k: 'caveat',   label: 'Caveat', w: 24 },
          { k: 'sessions', label: 'Sessions affected', w: 18 },
          { k: 'effect',   label: 'Effect on the analysis', w: 34, required: true,
            requiredMsg: 'A caveat with no stated effect changes nothing about how the report is read.' },
        ],
      },
    },

    {
      id: 'gap', n: '2', title: 'Where the gap sits',
      blurb: 'Attribute the whole deficit or the split is not credible. The total is summed here, not typed.',
      fixed: {
        key: 'gap', label: 'Attribution', labelWidth: 24,
        rows: [...GAP_ROWS, { k: 'total', label: 'TOTAL', derive: 'gapTotals' }],
        columns: [
          { k: 'pct',      label: 'Share of gap, %', w: 12, numeric: true },
          { k: 's',        label: 'Seconds', w: 10, numeric: true },
          { k: 'evidence', label: 'Evidence', w: 26 },
          { k: 'by',       label: 'Fixable by', w: 16 },
        ],
      },
      fields: [
        { k: 'gapMethod', label: 'Method used for the split', type: 'textarea', rows: 3,
          hint: 'State it so it can be challenged in the room.' },
      ],
    },

    {
      id: 'conditions', n: '3', title: 'Conditions and track evolution',
      fields: [
        { k: 'evo.total',       label: 'Total evolution, s', numeric: true },
        { k: 'evo.between',     label: 'Between which two reference runs' },
        { k: 'evo.rubber',      label: 'Rubber laid by support package, s', numeric: true },
        { k: 'evo.setup',       label: 'Our own setup progression, s', numeric: true },
        { k: 'evo.fieldMedian', label: 'Field median gained' },
        { k: 'evo.weGained',    label: 'We gained' },
        { k: 'conditionsNote',  label: 'Circuit specific note for the archive', type: 'textarea', rows: 3,
          hint: 'Wind direction, sun angle, surface changes — anything still true next year.' },
      ],
      table: {
        key: 'conditions', addLabel: 'Add session',
        columns: [
          { k: 'session', label: 'Session', w: 14 },
          { k: 'time',    label: 'Time', w: 10 },
          { k: 'air',     label: 'Air (C)', w: 10, numeric: true },
          { k: 'track',   label: 'Track (C)', w: 10, numeric: true },
          { k: 'wind',    label: 'Wind', w: 12 },
          { k: 'notes',   label: 'Notes', w: 26 },
        ],
      },
    },

    {
      id: 'sessionReview', n: '4', title: 'Session by session review',
      blurb: 'Keep each to what changed our understanding. A session that taught us nothing is a finding in itself.',
      fields: [
        { k: 'sess.name',        label: 'Session' },
        { k: 'sess.laps',        label: 'Laps completed', numeric: true },
        { k: 'sess.againstPlan', label: 'Against plan' },
        { k: 'sess.shortfall',   label: 'Reason for any shortfall', type: 'textarea' },
        { k: 'sess.purpose',     label: 'What the session was for', type: 'textarea' },
        { k: 'sess.produced',    label: 'What it produced', type: 'textarea' },
      ],
      table: {
        key: 'runs', addLabel: 'Add run',
        columns: [
          { k: 'run',    label: 'Run', w: 8 },
          { k: 'driver', label: 'Driver', w: 14 },
          { k: 'tyre',   label: 'Tyre state', w: 14 },
          { k: 'laps',   label: 'Laps', w: 8, numeric: true },
          { k: 'config', label: 'Configuration under test', w: 26 },
          { k: 'result', label: 'Result', w: 20 },
        ],
      },
    },

    {
      id: 'stints', n: '4b', title: 'Stint data',
      table: {
        key: 'stints', addLabel: 'Add stint',
        columns: [
          { k: 'driver',  label: 'Driver', w: 14 },
          { k: 'opening', label: 'Opening rep. lap', w: 14 },
          { k: 'closing', label: 'Closing rep. lap', w: 14 },
          { k: 'deg',     label: 'Fuel corrected deg., s/lap', w: 18, numeric: true },
          { k: 'knee',    label: 'Knee at lap', w: 12, numeric: true },
          { k: 'rate',    label: 'Rate before / after', w: 16 },
        ],
      },
    },

    {
      id: 'qualifying', n: '4c', title: 'Qualifying',
      fields: [
        { k: 'qual.combined.time',        label: 'Combined — time' },
        { k: 'qual.combined.position',    label: 'Combined — position' },
        { k: 'qual.combined.gap',         label: 'Combined — gap to session best' },
        { k: 'qual.combined.theoretical', label: 'Combined — theoretical best' },
        { k: 'qual.combined.unrealised',  label: 'Combined — unrealised' },
      ],
      table: {
        key: 'qualifying', addLabel: 'Add driver',
        columns: [
          { k: 'driver',      label: 'Driver', w: 14 },
          { k: 'time',        label: 'Time', w: 12 },
          { k: 'position',    label: 'Position', w: 10, numeric: true },
          { k: 'gap',         label: 'Gap to session best', w: 16 },
          { k: 'theoretical', label: 'Theoretical best', w: 14 },
          { k: 'unrealised',  label: 'Unrealised', w: 12 },
        ],
      },
    },

    {
      id: 'race', n: '4d', title: 'Race',
      fields: [
        { k: 'race.startFinish',  label: 'Started / finished' },
        { k: 'race.lapsStops',    label: 'Laps and stops' },
        { k: 'race.penalties',    label: 'Penalties carried' },
        { k: 'race.refSequence',  label: 'Reference sequence used' },
        { k: 'race.stationary',   label: 'Stationary time' },
        { k: 'race.rank',         label: 'Rank in class' },
        { k: 'race.driverChange', label: 'Driver change' },
        { k: 'race.release',      label: 'Release' },
        { k: 'race.inLap',        label: 'In lap loss' },
        { k: 'race.outLap',       label: 'Out lap loss' },
        { k: 'race.traffic',      label: 'Traffic loss' },
        { k: 'race.trackLimits',  label: 'Track limit losses' },
        { k: 'attributionNote',   label: 'Attribution note', type: 'textarea', rows: 3,
          hint: 'What was car, what was driver, what was circumstance, and how we know.' },
      ],
    },

    {
      id: 'finding', n: '5', title: 'Primary technical finding',
      blurb: 'The central finding of the event gets its own section and its own evidence.',
      fields: [
        { k: 'findingName',    label: 'Name it' },
        { k: 'findingCircuit', label: 'How much is the circuit', type: 'textarea',
          hint: 'Establish the baseline the field is living with before claiming the problem is ours.' },
        { k: 'findingUs',      label: 'How much is us', type: 'textarea' },
      ],
      table: {
        key: 'observations', addLabel: 'Add observation',
        columns: [
          { k: 'session',   label: 'Session', w: 14 },
          { k: 'condition', label: 'Driving condition', w: 20 },
          { k: 'measureA',  label: 'Measure A', w: 14 },
          { k: 'measureB',  label: 'Measure B', w: 14 },
          { k: 'delta',     label: 'Delta', w: 12 },
        ],
      },
    },

    {
      id: 'candidates', n: '5b', title: 'Candidate causes',
      blurb: 'In order of confidence. One variable per session: two changes on a Friday buys a Saturday unable to attribute the result.',
      fields: [
        { k: 'testPlan', label: 'Recommended test plan', type: 'textarea', rows: 3,
          hint: 'Back to back parameters, matched conditions required, measurement protocol.' },
      ],
      table: {
        key: 'candidates', addLabel: 'Add candidate', max: 3,
        columns: [
          { k: 'cause',     label: 'Candidate cause', w: 22 },
          { k: 'evidence',  label: 'Supporting evidence', w: 24, required: true,
            requiredMsg: 'Evidence is required. A candidate with no trace behind it is a hunch in a table.' },
          { k: 'conf',      label: 'Conf.', w: 8, options: CONFIDENCE, optionLabels: CONFIDENCE_LABELS },
          { k: 'eliminate', label: 'How to eliminate', w: 20 },
          { k: 'cost',      label: 'Cost to test', w: 12 },
        ],
      },
    },

    {
      id: 'fuel', n: '6', title: 'Fuel and consumption',
      fixed: {
        key: 'fuel', label: 'Metric', labelWidth: 24,
        rows: [
          { k: 'consumption', label: 'Consumption, l per lap' },
          { k: 'reserve',     label: 'Reserve at flag, l' },
          { k: 'correction',  label: 'Correction factor, s per litre' },
        ],
        columns: [
          { k: 'modelled', label: 'Modelled', w: 14, numeric: true },
          { k: 'actual1',  label: 'Actual, driver 1', w: 14, numeric: true },
          { k: 'actual2',  label: 'Actual, driver 2', w: 14, numeric: true },
          { k: 'variance', label: 'Variance', w: 14 },
        ],
      },
      fields: [
        { k: 'fuelDelta',           label: 'Cause of any driver delta', type: 'textarea',
          hint: 'State whether it is a fault in its own right or a symptom.' },
        { k: 'fuelCarried.litres',  label: 'Carried fuel — l over target', numeric: true },
        { k: 'fuelCarried.perLap',  label: 'Carried fuel — s per lap', numeric: true },
        { k: 'fuelCarried.stint',   label: 'Carried fuel — s over the stint', numeric: true },
        { k: 'fuelRecommendation',  label: 'Recommendation', type: 'textarea',
          hint: 'Reserve target, and the conditions under which it applies.' },
      ],
    },

    {
      id: 'health', n: '7', title: 'Brakes, cooling and mechanical health',
      blurb: 'Margins used, margins spare, and what spare margin unlocks.',
      fixed: {
        key: 'brakes', label: 'Metric', labelWidth: 26,
        rows: [
          { k: 'brakeTemp', label: 'Peak brake temperature, front / rear' },
          { k: 'padWear',   label: 'Pad wear, front / rear' },
          { k: 'waterTemp', label: 'Peak water temperature' },
          { k: 'oilTemp',   label: 'Peak oil temperature / pressure' },
          { k: 'bottoming', label: 'Bottoming events' },
        ],
        columns: [
          { k: 'value',     label: 'Value', w: 14 },
          { k: 'threshold', label: 'Threshold', w: 14 },
          { k: 'margin',    label: 'Margin', w: 14 },
        ],
      },
      checkgrid: {
        key: 'check', items: SYSTEMS_CHECK,
        groups: { 1: 'Car and running gear (section 7)', 9: 'Data capture and systems (section 12)' },
      },
      fields: [
        { k: 'notConstraint', label: 'Where a system is not a constraint', type: 'textarea', rows: 3,
          hint: 'State so, and state what that unlocks.' },
      ],
    },

    {
      id: 'setup', n: '8', title: 'Setup and aerodynamic notes',
      blurb: 'The question is not whether the car got faster. It is whether it got faster at the thing we chose to optimise.',
      fields: [
        { k: 'setup.gain',        label: 'Genuine setup gain across the event, s', numeric: true },
        { k: 'setup.expectation', label: 'Against an expectation of' },
        { k: 'setup.changeCount', label: 'Number of changes made', numeric: true },
      ],
      table: {
        key: 'setupChanges', addLabel: 'Add change',
        columns: [
          { k: 'change',   label: 'Change', w: 18 },
          { k: 'session',  label: 'Session', w: 12 },
          { k: 'reason',   label: 'Reason', w: 18 },
          { k: 'effect1',  label: 'Effect, driver 1', w: 16 },
          { k: 'effect2',  label: 'Effect, driver 2', w: 16 },
          { k: 'retained', label: 'Retained', w: 10, options: YES_NO },
        ],
      },
    },

    {
      id: 'aero', n: '8b', title: 'Aerodynamic configuration',
      fields: [
        { k: 'aero.config',         label: 'Configuration adopted' },
        { k: 'aero.topSpeed',       label: 'Top speed at trap' },
        { k: 'aero.alternative',    label: 'Alternative configuration' },
        { k: 'aero.gain',           label: 'Gain' },
        { k: 'aero.overtakes',      label: 'Overtakes attributable' },
        { k: 'aero.offsettingLoss', label: 'Offsetting loss, s and where' },
        { k: 'aero.recoverable',    label: 'Recoverable through' },
        { k: 'aero.onceFixed',      label: 'Once this is fixed' },
        { k: 'setupPriority',       label: 'Setup priority for the next event',
          placeholder: 'Am pace / Pro pace / race stint stability' },
        { k: 'setupAgreed',         label: 'Agreed between race engineer and team principal', type: 'textarea' },
      ],
    },

    {
      id: 'driver1', n: '9', title: 'Driver performance — driver 1',
      blurb: "Uses the PSDB for the driver's own account and the PSDR for what was fed back. Conflicts between the two are the point.",
      fields: [
        { k: 'd1.name',           label: 'Driver, category' },
        { k: 'd1.pace',           label: 'Pace vs class benchmark' },
        { k: 'd1.consistency',    label: 'Consistency, std dev on rep. laps' },
        { k: 'd1.largestGain',    label: 'Single largest available gain' },
        { k: 'd1.evidence',       label: 'Trace evidence', type: 'textarea' },
        { k: 'd1.worth',          label: 'Worth, per lap and per stint' },
        { k: 'd1.recommendation', label: 'Recommendation', type: 'textarea' },
        { k: 'd1.trialled',       label: 'Where trialled', placeholder: 'Practice, not a race' },
        { k: 'd1.owner',          label: 'Owner' },
      ],
    },

    {
      id: 'driver2', n: '9b', title: 'Driver performance — driver 2',
      fields: [
        { k: 'd2.name',               label: 'Driver, category' },
        { k: 'd2.gap',                label: 'Like for like gap to reference driver, s', numeric: true,
          hint: 'Corrected for fuel, tyre age and track temperature per Appendix A.' },
        { k: 'd2.otherLoss',          label: 'All other locations, loss (s)', numeric: true },
        { k: 'd2.concentrationPct',   label: 'Concentration, % of the deficit', numeric: true },
        { k: 'd2.concentrationCount', label: 'in how many locations', numeric: true },
        { k: 'd2.rootCause',          label: 'Common root cause' },
        { k: 'd2.secondOrder',        label: 'Second order consequence', type: 'textarea',
          hint: 'Where a technique fault is also feeding a vehicle problem.' },
        { k: 'd2.recommendation',     label: 'Recommendation', type: 'textarea' },
        { k: 'd2.psdrRef',            label: 'Cross reference — PSDR section 3 priorities' },
        { k: 'd2.psdbRef',            label: 'Cross reference — PSDB' },
      ],
      table: {
        key: 'driverLosses', addLabel: 'Add location',
        columns: [
          { k: 'location',  label: 'Location', w: 20 },
          { k: 'loss',      label: 'Loss (s)', w: 10, numeric: true },
          { k: 'character', label: 'Character', w: 26 },
          { k: 'phase',     label: 'Phase', w: 10, options: ['B', 'E', 'M', 'X'],
            optionLabels: { B: 'B — braking', E: 'E — entry', M: 'M — mid', X: 'X — exit' } },
        ],
      },
    },

    {
      id: 'correlation', n: '9c', title: "Correlation with the driver's own account",
      table: {
        key: 'correlation', addLabel: 'Add corner',
        columns: [
          { k: 'corner',   label: 'Corner', w: 14 },
          { k: 'reported', label: 'Driver reported', w: 26 },
          { k: 'trace',    label: 'Trace shows', w: 26 },
          { k: 'verdict',  label: 'A / C / U', w: 12, options: ['A', 'C', 'U'],
            optionLabels: { A: 'A — agrees', C: 'C — conflicts', U: 'U — unresolved' } },
        ],
      },
    },

    {
      id: 'strategy', n: '10', title: 'Strategy review',
      blurb: 'Self inflicted loss, totalled, against the finishing gap.',
      fixed: {
        key: 'strategy', label: 'Element', labelWidth: 22,
        rows: [
          { k: 'stopLap',    label: 'Stop lap' },
          { k: 'stationary', label: 'Stationary time' },
          { k: 'inLap',      label: 'In lap' },
          { k: 'outLap',     label: 'Out lap' },
          { k: 'undercut',   label: 'Undercut or overcut gain' },
        ],
        columns: [
          { k: 'planned', label: 'Planned', w: 12 },
          { k: 'actual',  label: 'Actual', w: 12 },
          { k: 'delta',   label: 'Delta', w: 12 },
          { k: 'comment', label: 'Comment', w: 26 },
        ],
      },
      fields: [
        { k: 'selfInflicted',    label: 'Self inflicted loss, totalled, s', numeric: true },
        { k: 'finishingGap',     label: 'Against a finishing gap of, s', numeric: true },
        { k: 'toPosition',       label: 'to position', placeholder: '4' },
        { k: 'penalties',        label: 'Fuel penalty, track limit and procedural losses', type: 'textarea' },
        { k: 'modelPredicted',   label: 'Model — predicted' },
        { k: 'modelActual',      label: 'Model — actual' },
        { k: 'modelCalibration', label: 'Model — calibration' },
      ],
    },

    {
      id: 'counterfactual', n: '10b', title: 'Counterfactual',
      blurb: 'Record the threshold so the question stops being asked on the radio.',
      fields: [
        { k: 'approached', label: 'Did we approach the threshold?', placeholder: 'Yes / No' },
      ],
      table: {
        key: 'counterfactuals', addLabel: 'Add counterfactual',
        columns: [
          { k: 'assessed',  label: 'Counterfactual assessed', w: 26 },
          { k: 'cost',      label: 'Modelled cost', w: 14 },
          { k: 'gain',      label: 'Modelled gain', w: 14 },
          { k: 'threshold', label: 'Viability threshold, s per lap deg.', w: 20 },
        ],
      },
    },

    {
      id: 'competitors', n: '11', title: 'Competitor benchmarking',
      fields: [
        { k: 'perCategory', label: 'Per driver category', type: 'textarea',
          hint: 'State the Pro gap and the Am gap separately.' },
        { k: 'bopPosition', label: 'BoP position', placeholder: 'Stable / change warranted' },
      ],
      table: {
        key: 'competitors', addLabel: 'Add competitor',
        columns: [
          { k: 'name',        label: 'Competitor', w: 14 },
          { k: 'singleLap',   label: 'Single lap vs us', w: 14 },
          { k: 'degradation', label: 'Degradation', w: 14 },
          { k: 'pit',         label: 'Pit execution', w: 14 },
          { k: 'weakness',    label: 'Their weakness', w: 20 },
          { k: 'beat',        label: 'How we beat them', w: 20 },
        ],
      },
    },

    {
      id: 'reliability', n: '12', title: 'Reliability and data quality',
      blurb: 'A recurring issue is a management problem, not an engineering one.',
      fields: [
        { k: 'reliability.mechanical',       label: 'Mechanical failures' },
        { k: 'reliability.mechanicalDetail', label: 'Detail', type: 'textarea' },
        { k: 'reliability.data',             label: 'Data issues' },
        { k: 'reliability.dataDetail',       label: 'Detail', type: 'textarea' },
        { k: 'processFailures',              label: 'Process failures and their cost in hours', type: 'textarea' },
        { k: 'nearMisses',                   label: 'Anything that nearly went wrong', type: 'textarea', rows: 3,
          hint: 'Near misses matter more than failures for planning.' },
      ],
      table: {
        key: 'faults', addLabel: 'Add fault',
        columns: [
          { k: 'fault',     label: 'Fault raised, with lap and distance', w: 28 },
          { k: 'action',    label: 'Action taken', w: 22 },
          { k: 'parts',     label: 'Parts at or near life limit', w: 22 },
          { k: 'recurring', label: 'Recurring', w: 10, options: YES_NO },
        ],
      },
    },

    {
      id: 'cost', n: '13', title: 'Cost of the weekend',
      blurb: 'Planned against actual. Delete if issued separately to Commercial.',
      fixed: {
        key: 'cost', label: 'Item', labelWidth: 26,
        rows: [...COST_ROWS, { k: 'total', label: 'TOTAL', derive: 'costTotals' }],
        columns: [
          { k: 'planned',  label: 'Planned', w: 12, numeric: true },
          { k: 'actual',   label: 'Actual', w: 12, numeric: true },
          { k: 'variance', label: 'Variance', w: 12 },
          { k: 'comment',  label: 'Comment', w: 26 },
        ],
      },
    },

    {
      id: 'decisions', n: '14', title: 'Decisions required',
      blurb: 'Escalated to the Team Principal. Every row needs an option, a recommendation and an owner.',
      table: {
        key: 'decisions', addLabel: 'Add decision', max: 3,
        columns: [
          { k: 'decision',       label: 'Decision', w: 22 },
          { k: 'optionA',        label: 'Option A', w: 16 },
          { k: 'optionB',        label: 'Option B', w: 16 },
          { k: 'recommendation', label: 'Recommendation', w: 20, required: true,
            requiredMsg: 'A decision put up without a recommendation is a question, not a decision.' },
          { k: 'costRisk',       label: 'Cost / risk', w: 14 },
          { k: 'owner',          label: 'Owner and date', w: 14 },
        ],
      },
    },

    {
      id: 'actions', n: '15', title: 'Actions for the next round',
      fields: [
        { k: 'actionsRound', label: 'Round', placeholder: '5' },
        { k: 'carriedOver',  label: 'Carried over and still open', type: 'textarea', rows: 3,
          hint: 'From the previous event, with the reason it is still open.' },
      ],
      table: {
        key: 'actions', addLabel: 'Add action', max: 9,
        columns: [
          { k: 'action', label: 'Action', w: 32 },
          { k: 'owner',  label: 'Owner', w: 14, required: true,
            requiredMsg: 'An action with no owner is a wish. Name someone.' },
          { k: 'due',    label: 'Due', w: 12 },
          { k: 'links',  label: 'Links to section', w: 14 },
        ],
      },
    },

    {
      id: 'forecast', n: '16', title: 'Forecast',
      fields: [
        { k: 'fc.nextEvent',       label: 'Next event' },
        { k: 'fc.circuit',         label: 'Circuit' },
        { k: 'fc.suits',           label: 'Suits our package?', placeholder: 'Yes / Partly / No' },
        { k: 'fc.dates',           label: 'Dates' },
        { k: 'fc.because',         label: 'Because', type: 'textarea' },
        { k: 'fc.target',          label: 'Realistic target, current package' },
        { k: 'fc.targetIfApproved', label: 'Target if decision 1 approved' },
        { k: 'fc.championship',    label: 'Championship scenario' },
        { k: 'fc.lever',           label: 'Biggest single lever this season' },
      ],
    },

    {
      id: 'signoff', n: '17', title: 'Distribution and sign off',
      blurb: 'The names and the reference come from the header block; only the archive details are new here.',
      fields: [
        { k: 'dataArchivedTo', label: 'Data archived to', placeholder: '/2026/R04-Silverstone/car11' },
        { k: 'issuedAt',       label: 'Date / time issued', placeholder: 'dd.mm.yyyy / hh:mm' },
      ],
    },

    {
      id: 'methodology', n: 'A', title: 'Methodology notes',
      blurb: 'Completed every event. The numbers above are only defensible if this section is.',
      fields: [
        { k: 'method.fuelCorrection', label: 'Fuel correction', type: 'textarea' },
        { k: 'method.repLaps',        label: 'Representative laps', type: 'textarea' },
        { k: 'method.degradation',    label: 'Degradation rates', type: 'textarea' },
        { k: 'method.likeForLike',    label: 'Like for like comparison', type: 'textarea' },
        { k: 'method.deviation',      label: 'Any deviation from the above', type: 'textarea' },
      ],
    },

    {
      id: 'thresholds', n: 'B', title: 'Threshold and reference data',
      fields: [
        { k: 'thresholds.section',   label: 'Referenced in section' },
        { k: 'thresholds.represent', label: 'What the thresholds represent', type: 'textarea' },
        { k: 'thresholds.derived',   label: 'How they were derived', type: 'textarea' },
        { k: 'thresholds.held',      label: 'Where the live values are held', type: 'textarea',
          hint: 'State plainly if values are deliberately withheld from this document.' },
      ],
    },

    {
      id: 'dataQuality', n: 'C', title: 'Data quality flags by session',
      table: {
        key: 'dataQuality', addLabel: 'Add session',
        columns: [
          { k: 'session', label: 'Session', w: 14 },
          { k: 'flags',   label: 'Channel losses, invalid ranges, interpolated data, offsets', w: 60 },
        ],
      },
    },

    {
      id: 'calibration', n: 'D', title: 'Calibration and configuration record',
      blurb: 'A calibration change not logged before the car leaves the garage costs the data engineer a morning.',
      table: {
        key: 'calibration', addLabel: 'Add change',
        columns: [
          { k: 'change',  label: 'Change', w: 22 },
          { k: 'session', label: 'Session / time', w: 16 },
          { k: 'reason',  label: 'Reason', w: 22 },
          { k: 'logged',  label: 'Logged before car left garage', w: 14, options: YES_NO },
          { k: 'offsets', label: 'Offsets in', w: 14 },
        ],
      },
    },
  ],
};
