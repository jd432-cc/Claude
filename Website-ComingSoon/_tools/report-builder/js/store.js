/* =============================================================
   TheRacingData — Report Builder
   State, derived values, validation, persistence.

   The report is one plain object. Everything else — the form, the
   DOCX payload, the .trd.json file — is a view of it, so there is
   only ever one source of truth to get wrong.

   Nothing leaves the machine. Autosave is localStorage; sharing is
   an explicit file export.
   ============================================================= */

import { SCHEMA, CONSISTENCY_BANDS, SYSTEMS_CHECK } from './schema.js';

const KEY = `trd_report_${SCHEMA.id}_v${SCHEMA.version}`;
const TABLES = SCHEMA.sections.filter(s => s.table).map(s => s.table.key);

/* ---------- dotted-path access ---------- */
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

/* ---------- lap times ----------
   Accepts 2:14.82 or 134.82 and normalises to seconds, so a gap can
   be computed without asking the engineer to enter both forms. */
export function toSeconds(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const mmss = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fromSeconds(sec) {
  if (sec == null || !Number.isFinite(sec)) return '';
  if (sec < 60) return sec.toFixed(2);
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(2).padStart(5, '0')}`;
}

/* ---------- empty report ---------- */
export function blank() {
  const r = { _schema: SCHEMA.id, _version: SCHEMA.version, check: {} };
  for (const t of TABLES) r[t] = [];
  SYSTEMS_CHECK.forEach((_, i) => { r.check[`c${i + 1}`] = false; });
  return r;
}

/* ---------- derived values ----------
   Computed rather than typed, so the arithmetic in the document can
   never disagree with the arithmetic in the form. */
export const DERIVED = {
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

  reportRef(r) {
    const parts = [r.round, r.venueCode, 'PSDR', r.carCode];
    if (parts.some(p => !p)) return '';
    return parts.map(p => String(p).toUpperCase()).join('-');
  },
};

export function derive(report, name) {
  const fn = DERIVED[name];
  return fn ? fn(report) : '';
}

/* Mirrored fields restate a value the engineer already gave elsewhere. */
export function resolveField(report, field) {
  if (field.computed) return derive(report, field.computed);
  if (field.mirror) return get(report, field.mirror) ?? '';
  return get(report, field.k) ?? '';
}

/* ---------- validation ----------
   The doctrine is enforced here rather than left to good intentions:
   a finding without evidence is not a finding. */
export function validate(report) {
  const issues = [];

  for (const section of SCHEMA.sections) {
    if (section.table) {
      const rows = report[section.table.key] || [];
      for (const col of section.table.columns) {
        if (!col.required) continue;
        rows.forEach((row, i) => {
          const hasContent = section.table.columns
            .some(c => String(row[c.k] ?? '').trim() !== '');
          if (hasContent && !String(row[col.k] ?? '').trim()) {
            issues.push({
              section: section.id, row: i,
              message: `${section.title}, row ${i + 1}: ${col.requiredMsg || `${col.label} is required.`}`,
            });
          }
        });
      }
    }
    if (section.gate && !get(report, section.gate.field)) {
      issues.push({ section: section.id, gate: true, message: section.gate.message });
    }
  }
  return issues;
}

export function isGated(report) {
  const gate = SCHEMA.sections.find(s => s.gate)?.gate;
  return gate ? !get(report, gate.field) : false;
}

/* ---------- completion, for the section rail ---------- */
export function completion(report, section) {
  let total = 0, done = 0;
  for (const f of section.fields || []) {
    if (f.computed) continue;
    total += 1;
    if (String(resolveField(report, f) ?? '').trim()) done += 1;
  }
  if (section.table) {
    total += 1;
    if ((report[section.table.key] || []).length) done += 1;
  }
  if (section.checkgrid) {
    total += 1;
    if (Object.values(report.check || {}).some(Boolean)) done += 1;
  }
  return total ? done / total : 0;
}

/* ---------- persistence ---------- */
export function save(report) {
  try {
    localStorage.setItem(KEY, JSON.stringify(report));
    return true;
  } catch {
    return false;   // private mode, or quota
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return null;
  }
}

/* A file written against an older schema is accepted rather than
   rejected: missing keys simply come through blank. */
export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  const base = blank();
  const merged = { ...base, ...data, check: { ...base.check, ...(data.check || {}) } };
  for (const t of TABLES) if (!Array.isArray(merged[t])) merged[t] = [];
  merged._schema = SCHEMA.id;
  merged._version = SCHEMA.version;
  return merged;
}

export function filename(report, ext) {
  const ref = derive(report, 'reportRef') || 'PSDR';
  return `${ref}.${ext}`;
}
