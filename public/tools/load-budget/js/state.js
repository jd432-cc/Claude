/* =============================================================
   TheRacingData — Load Budget & Voltage Drop
   State, persistence and the circuit register.

   One plain object. The table, the fuse chart, the CSV and the
   loom export are all views of it.

   Nothing leaves the machine. Autosave is localStorage; sharing
   is an explicit file export.
   ============================================================= */

export const SCHEMA_ID = 'load-budget';
export const VERSION = 1;
const KEY = `trd_${SCHEMA_ID}_v${VERSION}`;

/* The classes a load falls into for fusing, and the kinds it falls
   into for grounding. They are different questions: `class` decides
   what the fuse has to survive, `kind` decides what the circuit must
   not share a stud with. */
export const CLASSES = [
  ['continuous', 'Continuous'],
  ['intermittent', 'Intermittent'],
  ['inrush', 'Inrush'],
];

export const KINDS = [
  ['sensor', 'Sensor'],
  ['signal', 'Signal'],
  ['logic', 'Logic'],
  ['power', 'Power'],
  ['ignition', 'Ignition'],
  ['injector', 'Injector'],
  ['motor', 'Motor'],
  ['lighting', 'Lighting'],
  ['heater', 'Heater'],
  ['starter', 'Starter'],
];

/* Entered columns first, computed columns after them. The order is
   the table's order and the CSV's order, so a row reads the same
   way in both. */
export const COLUMNS = [
  { k: 'fusePosition', label: 'Pos', w: 5, entered: true },
  { k: 'name', label: 'Circuit', w: 14, entered: true },
  { k: 'group', label: 'Group', w: 10, entered: true },
  { k: 'kind', label: 'Kind', w: 11, entered: true, options: KINDS },
  { k: 'load_a', label: 'Load, A', w: 7, entered: true, numeric: true },
  { k: 'duty_pct', label: 'Duty, %', w: 7, entered: true, numeric: true },
  { k: 'class', label: 'Class', w: 12, entered: true, options: CLASSES },
  { k: 'length_m', label: 'Length, m', w: 8, entered: true, numeric: true },
  { k: 'dedicatedReturn', label: 'Ded. rtn', w: 6, entered: true, type: 'check' },
  { k: 'groundNode', label: 'Gnd node', w: 8, entered: true },
  { k: 'csa_mm2', label: 'CSA, mm²', w: 8, entered: true, numeric: true },
  { k: 'insulation', label: 'Insulation', w: 14, entered: true, options: [] },
  { k: 'bundleSize', label: 'Bundle', w: 6, entered: true, numeric: true },
  { k: 'fuse_a', label: 'Fuse, A', w: 7, entered: true, numeric: true },
  { k: 'critical', label: 'Crit.', w: 5, entered: true, type: 'check' },

  { k: '_R', label: 'R, mΩ', w: 8 },
  { k: '_temp', label: 'Cond. °C', w: 8 },
  { k: '_drop', label: 'ΔV run', w: 8 },
  { k: '_dropPct', label: '% run', w: 7 },
  { k: '_return', label: 'ΔV return', w: 8 },
  { k: '_crank', label: '% crank', w: 8 },
  { k: '_allowed', label: 'I allowed', w: 8 },
];

export function blank() {
  return {
    _schema: SCHEMA_ID,
    _version: VERSION,
    system: {
      nominalV: 12.0, runningV: 13.8, crankingV: 9.5,
      ambient_c: 40, groundReturn_mohm: 5,
    },
    supply: {
      alternator_a_at_idle: 25, alternator_a_at_race: 70,
      batteryCapacity_ah: 20, batteryReserve_pct: 20,
    },
    limits: {},
    circuits: [],
    _loomState: null,
    raceRemaining_min: 60,
  };
}

export function newCircuit(n) {
  return {
    id: `c${n}`,
    name: '', group: '', kind: 'power',
    load_a: '', duty_pct: 100, class: 'continuous',
    inrush_a: '', inrush_ms: '',
    length_m: '', dedicatedReturn: true, groundNode: '',
    csa_mm2: 1.31, conductor: 'copper', insulation: 'spec55-150',
    bundleSize: 1, conductorTemp_c: '',
    fuse_a: '', fuseType: 'fast', fusePosition: '',
    critical: false,
  };
}

/* ---------- persistence ---------- */
export function save(session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); return true; }
  catch { return false; }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data._schema && data._schema !== SCHEMA_ID) return null;
  const base = blank();
  const out = { ...base, ...data };
  out.system = { ...base.system, ...(data.system || {}) };
  out.supply = { ...base.supply, ...(data.supply || {}) };
  out.limits = { ...base.limits, ...(data.limits || {}) };
  out.circuits = Array.isArray(data.circuits)
    ? data.circuits.map((c, i) => ({ ...newCircuit(i + 1), ...c }))
    : [];
  out._schema = SCHEMA_ID;
  out._version = VERSION;
  return out;
}

/* ---------- exports ---------- */

export function toCsv(session, model) {
  const head = COLUMNS.map(c => c.label);
  const rows = [head];
  for (const circuit of session.circuits) {
    const r = model.byId.get(circuit.id);
    rows.push(COLUMNS.map(c => cellText(circuit, r, c)));
  }
  rows.push([]);
  rows.push(['Continuous draw, A', model.budget.continuousDraw_a.toFixed(2)]);
  rows.push(['Alternator headroom at race, A', model.budget.headroom_a.toFixed(2)]);
  rows.push(['Alternator headroom at idle, A', model.budget.idleHeadroom_a.toFixed(2)]);
  rows.push(['Time to flat on the battery alone, min',
             Number.isFinite(model.budget.timeToFlat_min)
               ? model.budget.timeToFlat_min.toFixed(1) : 'n/a']);
  rows.push(['Loom mass, kg', model.mass.total_kg.toFixed(3)]);
  rows.push(['Circuits over limit', String(model.failing)]);
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

/* One place decides what a cell says, so the table, the CSV and the
   printed chart cannot disagree about a number. */
export function cellText(circuit, result, column) {
  if (!column.k.startsWith('_')) {
    const v = circuit[column.k];
    if (column.type === 'check') return v ? 'Y' : 'N';
    return v == null ? '' : String(v);
  }
  if (!result) return '';
  switch (column.k) {
    case '_R':        return fmt(result.resistance.R_ohm * 1000, 1);
    case '_temp':     return fmt(result.conductorTemp.temp_c, 0);
    case '_drop':     return fmt(result.running.dV, 3);
    case '_dropPct':  return fmt(result.running.pct, 2);
    case '_return':   return fmt(result.returnDrop.dV, 3);
    case '_crank':    return fmt(result.cranking.pct, 1);
    case '_allowed':  return fmt(result.ampacity.allowed, 1);
    default:          return '';
  }
}

function fmt(n, dp) {
  return Number.isFinite(n) ? n.toFixed(dp) : '—';
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
