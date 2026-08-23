/* =============================================================
   TheRacingData — Fuel & Stint Calculator
   State, persistence and the field register.

   The session is one plain object. The form, the strategy table,
   the chart, the CSV and the PEER fragment are all views of it,
   so there is only ever one thing to get wrong.

   SI is what is stored. A display unit is a presentation choice
   and a toggle; a display string is never state.

   Nothing leaves the machine. Autosave is localStorage; sharing
   is an explicit file export.
   ============================================================= */

export const SCHEMA_ID = 'fuel-stint';
export const VERSION = 1;
const KEY = `trd_${SCHEMA_ID}_v${VERSION}`;

/* ---------- the register ----------

   One entry per input: where it lives, what it is called, what it
   is measured in and how it is displayed. The form is generated
   from this, so a field cannot exist in the UI and not in the
   session, or the other way round. */
export const GROUPS = [
  {
    id: 'event', title: 'Event', blurb: 'Identifies the session. Nothing below depends on it.',
    fields: [
      { k: 'event.name', label: 'Event', type: 'text' },
      { k: 'event.venue', label: 'Venue', type: 'text' },
      { k: 'event.lapDistance_m', label: 'Lap distance', unit: 'm', si: 'm', display: 'length' },
      { k: 'event.sessionType', label: 'Session', type: 'text', placeholder: 'Race 1' },
    ],
  },
  {
    id: 'format', title: 'Format', blurb: 'A timed race is not a lap race divided by the base lap.',
    fields: [
      { k: 'format.mode', label: 'Run to', type: 'select',
        options: [['time', 'A clock'], ['laps', 'A lap count']] },
      { k: 'format.duration_s', label: 'Duration', unit: 'min', si: 's', display: 'minutes',
        showIf: s => s.format.mode === 'time' },
      { k: 'format.laps', label: 'Laps', unit: 'laps', showIf: s => s.format.mode === 'laps' },
      { k: 'format.plusOneLap', label: 'Flag falls on the next crossing', type: 'check',
        hint: 'The lap in progress when the clock runs out is run to the flag. Nearly every timed format works this way.',
        showIf: s => s.format.mode === 'time' },
      { k: 'format.formationLap', label: 'Formation lap', type: 'check',
        hint: 'Adds one lap of fuel to the first stint and no lap to the race.' },
    ],
  },
  {
    id: 'car', title: 'Car', blurb: 'Measured on this car, on this fuel, at the temperature it is filled at.',
    fields: [
      { k: 'car.tankCapacity_l', label: 'Tank capacity', unit: 'l', si: 'l', display: 'volume' },
      { k: 'car.burn_l_per_lap', label: 'Burn per lap', unit: 'l/lap', si: 'l', display: 'volume',
        hint: 'Measured over a full stint. A single lap is not a consumption figure.' },
      { k: 'car.fuel', label: 'Fuel', type: 'select', options: [] },
      { k: 'car.fuelDensity_kg_per_l', label: 'Density at reference', unit: 'kg/l',
        hint: 'Seeded from data/fuels.json with a source. Confirm against the delivery note.' },
      { k: 'car.fuelTemp_c', label: 'Fuel temperature', unit: '°C' },
      { k: 'car.margin', label: 'Margin on the stint need', unit: 'fraction',
        hint: '0.02 is 2%. Covers a slow lap, a yellow, a driver who lifts less than modelled.' },
      { k: 'car.reserve_l', label: 'Reserve', unit: 'l', si: 'l', display: 'volume',
        hint: 'In-lap, scrutineering sample and pump pickup. Never reaches the engine.' },
      { k: 'car.refuelAllowed', label: 'Refuelling permitted', type: 'check' },
      { k: 'car.refuelRate_l_per_s', label: 'Refuel rate', unit: 'l/s',
        showIf: s => !!s.car.refuelAllowed },
    ],
  },
  {
    id: 'pace', title: 'Pace', blurb: 'Two of these are measured quantities and are labelled as such.',
    fields: [
      { k: 'pace.baseLap_s', label: 'Base lap', unit: 's', si: 's', display: 'lap' },
      { k: 'pace.fuelSensitivity_s_per_kg', label: 'Fuel sensitivity', unit: 's/kg',
        hint: 'MEASURED, not a constant. Scales with lap length and with how power-limited the circuit is. Typical 0.020-0.050. Back-compute it below.' },
      { k: 'pace.degLinear_s_per_lap', label: 'Degradation', unit: 's/lap' },
      { k: 'pace.degOffset_s', label: 'Degradation offset', unit: 's',
        hint: 'What a fresh set is worth on lap one against a scrubbed one.' },
      { k: 'pace.outLapDelta_s', label: 'Out lap penalty', unit: 's' },
      { k: 'pace.inLapDelta_s', label: 'In lap penalty', unit: 's' },
      { k: 'pace.liftCoastCost_s_per_pct', label: 'Lift and coast cost', unit: 's/lap per 1%',
        hint: 'MEASURED, not a constant. What one percent of fuel saved costs in lap time on this circuit.' },
      { k: 'pace.rivalStintLap', label: 'Rival stint lap, for the undercut', unit: 'laps' },
    ],
  },
  {
    id: 'pit', title: 'Pit', blurb: 'Pit loss is computed from these, never entered as one number.',
    fields: [
      { k: 'pit.laneLength_m', label: 'Lane length, line to line', unit: 'm', si: 'm', display: 'length' },
      { k: 'pit.speedLimit_kph', label: 'Speed limit', unit: 'km/h', si: 'kph', display: 'speed' },
      { k: 'pit.racingSpeed_kph', label: 'Racing equivalent speed', unit: 'km/h', si: 'kph', display: 'speed',
        hint: 'Average speed over the same stretch at racing pace. Read it off the GPS trace, not the top speed.' },
      { k: 'pit.tyreChange_s', label: 'Tyre change', unit: 's' },
      { k: 'pit.stationary_s', label: 'Stationary, if measured', unit: 's',
        hint: 'Leave blank to compute it as the longer of the tyre change and the refuel.' },
      { k: 'pit.entryExitLoss_s', label: 'Entry and exit loss', unit: 's' },
    ],
  },
  {
    id: 'rules', title: 'Rules', blurb: 'What the regulations fix, rather than what the car can do.',
    fields: [
      { k: 'rules.minStops', label: 'Minimum stops', unit: 'stops' },
      { k: 'rules.maxStints', label: 'Maximum stints', unit: 'stints', hint: '0 for no limit.' },
      { k: 'rules.refuelForbiddenUnderSC', label: 'Refuelling forbidden under safety car', type: 'check' },
      { k: 'tyres.setsAvailable', label: 'Tyre sets available', unit: 'sets' },
      { k: 'tyres.maxLapsPerSet', label: 'Maximum laps per set', unit: 'laps' },
    ],
  },
];

/* ---------- defaults ----------

   A plausible one-hour circuit race. Every figure is overwritten by
   the first team that uses this, which is the point of shipping a
   filled form rather than an empty one: an empty form teaches nobody
   what the fields are for. */
export function blank() {
  return {
    _schema: SCHEMA_ID,
    _version: VERSION,
    event: { name: '', venue: '', lapDistance_m: 5891, sessionType: 'Race' },
    format: { mode: 'time', duration_s: 3600, laps: 52, formationLap: true, plusOneLap: true },
    car: {
      tankCapacity_l: 100, burn_l_per_lap: 3.2, fuel: 'petrol',
      fuelDensity_kg_per_l: 0.745, fuelTempRef_c: 15, fuelBeta_per_c: 0.00095,
      fuelTemp_c: 25, refuelAllowed: true, refuelRate_l_per_s: 6,
      margin: 0.02, reserve_l: 1.5,
    },
    pace: {
      baseLap_s: 105, fuelSensitivity_s_per_kg: 0.030,
      degLinear_s_per_lap: 0.04, degOffset_s: 0,
      outLapDelta_s: 2.5, inLapDelta_s: 1.8,
      liftCoastCost_s_per_pct: 0.10, rivalStintLap: 12,
    },
    pit: {
      laneLength_m: 380, speedLimit_kph: 60, racingSpeed_kph: 190,
      stationary_s: '', entryExitLoss_s: 1.2, tyreChange_s: 3.5,
    },
    rules: { minStops: 0, maxStints: 0, mandatoryWindow: [], refuelForbiddenUnderSC: true },
    tyres: { setsAvailable: 6, maxLapsPerSet: 25 },
    sc: { assumed: [] },
    pinned: null,
    notes: '',
  };
}

/* ---------- dotted paths ---------- */
export function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[last] = value;
  return obj;
}

/* ---------- display units ----------

   Converted on the way out and on the way in; the stored value is
   always SI. A tool that stores "3.2 l" as a string is a tool that
   silently computes in the wrong unit the first time someone
   switches the toggle. */
const CONVERSIONS = {
  metric: {
    volume: { factor: 1, label: 'l' },
    length: { factor: 1, label: 'm' },
    speed:  { factor: 1, label: 'km/h' },
    mass:   { factor: 1, label: 'kg' },
    minutes: { factor: 1 / 60, label: 'min' },
    lap:    { factor: 1, label: 's' },
  },
  imperial: {
    volume: { factor: 0.264172, label: 'US gal' },
    length: { factor: 3.28084, label: 'ft' },
    speed:  { factor: 0.621371, label: 'mph' },
    mass:   { factor: 2.20462, label: 'lb' },
    minutes: { factor: 1 / 60, label: 'min' },
    lap:    { factor: 1, label: 's' },
  },
};

export function toDisplay(value, kind, units) {
  const c = CONVERSIONS[units]?.[kind];
  if (!c || value === '' || value == null) return value;
  const n = Number(value);
  return Number.isFinite(n) ? round(n * c.factor) : value;
}

export function fromDisplay(value, kind, units) {
  const c = CONVERSIONS[units]?.[kind];
  if (!c || value === '' || value == null) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n / c.factor : value;
}

export function unitLabel(kind, units, fallback) {
  return CONVERSIONS[units]?.[kind]?.label ?? fallback;
}

function round(n) {
  return Math.abs(n) >= 100 ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 1000;
}

/* ---------- persistence ---------- */
export function save(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;   // private mode, or quota
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/* A file written against an older version is accepted rather than
   rejected: missing keys come through at their default. */
export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data._schema && data._schema !== SCHEMA_ID) return null;
  const base = blank();
  const out = { ...base, ...data };
  for (const group of ['event', 'format', 'car', 'pace', 'pit', 'rules', 'tyres', 'sc']) {
    out[group] = { ...base[group], ...(data[group] || {}) };
  }
  if (!Array.isArray(out.rules.mandatoryWindow)) out.rules.mandatoryWindow = [];
  if (!Array.isArray(out.sc.assumed)) out.sc.assumed = [];
  out._schema = SCHEMA_ID;
  out._version = VERSION;
  return out;
}

/* ---------- exports ---------- */

export function toCsv(computed, candidate) {
  const rows = [[
    'Stint', 'From lap', 'To lap', 'Laps', 'Fuel, l', 'Fuel, kg',
    'Stint time, s', 'Binding constraint',
  ]];
  for (const s of candidate.stints) {
    rows.push([s.n, s.fromLap, s.toLap, s.laps,
               s.load_l.toFixed(2), s.loadMass_kg.toFixed(2),
               s.time_s.toFixed(2), s.binding]);
  }
  rows.push([]);
  rows.push(['Stops', candidate.stops]);
  rows.push(['Pit loss, s', candidate.pitLoss_s.toFixed(2)]);
  rows.push(['Total race time, s', candidate.total_s.toFixed(2)]);
  rows.push(['Race laps', computed.derived.raceLaps]);
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* The strategy section of the PEER, keyed to match
   _tools/report-builder/js/schemas/peer.js exactly: a fixed grid
   `strategy.<row>.<column>` over stopLap / stationary / inLap / outLap
   / undercut, and the fuel grid alongside it. Planned, because that is
   what a plan is; the actual column is filled after the race by the
   person writing the report. */
export function toPeerFragment(computed, candidate) {
  const d = computed.derived;
  const stopLaps = [];
  let at = 0;
  for (let i = 0; i < candidate.stints.length - 1; i++) {
    at += candidate.stints[i].laps;
    stopLaps.push(at);
  }
  const burn = Number(computed.car.burn_l_per_lap) || 0;

  return {
    _schema: 'peer',
    _fragment: 'strategy',
    _source: `${SCHEMA_ID} v${VERSION}`,
    strategy: {
      stopLap:    { planned: stopLaps.join(', ') },
      stationary: { planned: candidate.pitLoss.stationary_s.toFixed(1) },
      inLap:      { planned: Number(computed.pace.inLapDelta_s || 0).toFixed(1) },
      outLap:     { planned: Number(computed.pace.outLapDelta_s || 0).toFixed(1) },
      undercut:   { planned: d.undercut.crossover
                      ? `Pays from ${d.undercut.crossover} lap(s) of offset`
                      : 'Does not pay inside 5 laps of offset' },
    },
    fuel: {
      consumption: { modelled: burn.toFixed(2) },
      reserve:     { modelled: Number(computed.car.reserve_l || 0).toFixed(1) },
      correction:  { modelled: Number(computed.pace.fuelSensitivity_s_per_kg || 0).toFixed(3) },
    },
    modelPredicted: `${candidate.stops} stop, ${candidate.stints.map(s => s.laps).join('/')}, ` +
                    `${fmtClock(candidate.total_s)}`,
  };
}

export function fmtClock(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds - h * 3600) / 60);
  const s = seconds - h * 3600 - m * 60;
  const mm = String(m).padStart(2, '0');
  const ss = s.toFixed(1).padStart(4, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss.padStart(4, '0')}`;
}

export function fmtLap(seconds) {
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return seconds.toFixed(2);
  const m = Math.floor(seconds / 60);
  return `${m}:${(seconds - m * 60).toFixed(2).padStart(5, '0')}`;
}

export function download(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame; revoking immediately races the download
  // in Safari and cancels it.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
