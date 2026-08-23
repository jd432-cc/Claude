/* =============================================================
   TheRacingData — shared report engine
   State, derived values, validation, persistence.

   The report is one plain object. Everything else — the form, the
   DOCX payload, the .trd.json file — is a view of it, so there is
   only ever one source of truth to get wrong.

   Every function here reads the active schema rather than a fixed
   one, so the same store serves every report a tool registers.
   Autosave is keyed by schema id: each type keeps its own work in
   progress, and the key format is fixed so a tool that gains a
   register does not orphan work saved before it did.

   Nothing leaves the machine. Autosave is localStorage; sharing is
   an explicit file export.
   ============================================================= */

import { SCHEMA, byId, setActive } from './registry.js';
import { get, set, toSeconds, fromSeconds } from './values.js';

export { get, set, toSeconds, fromSeconds };

const key = () => `trd_report_${SCHEMA.id}_v${SCHEMA.version}`;
const tables = () => SCHEMA.sections.filter(s => s.table).map(s => s.table.key);
const checkgrids = () => SCHEMA.sections.filter(s => s.checkgrid).map(s => s.checkgrid);
const grids = () => SCHEMA.sections.filter(s => s.fixed).map(s => s.fixed);

/* ---------- empty report ---------- */
export function blank() {
  const r = { _schema: SCHEMA.id, _version: SCHEMA.version };
  for (const t of tables()) r[t] = [];
  for (const cg of checkgrids()) {
    r[cg.key] = {};
    cg.items.forEach((_, i) => { r[cg.key][`c${i + 1}`] = false; });
  }
  // A fixed grid has the shape of the table it prints into: its rows are
  // the form's own, so they are created rather than added.
  for (const g of grids()) {
    r[g.key] = {};
    for (const row of g.rows) {
      r[g.key][row.k] = Object.fromEntries(g.columns.map(c => [c.k, '']));
    }
  }
  return r;
}

/* ---------- derived values ----------
   Computed rather than typed, so the arithmetic in the document can
   never disagree with the arithmetic in the form. Each schema brings
   its own set; nothing here knows what they are. */
export function derive(report, name) {
  const fn = SCHEMA.derived?.[name];
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
  // Doctrine the generic rules cannot express — a split that must total
  // 100%, a figure that must reconcile — belongs to the report itself.
  for (const extra of SCHEMA.issues?.(report) || []) issues.push(extra);
  return issues;
}

/* The gating section and everything before it stay open; the rest of
   the report waits until the gate is satisfied. A schema without a
   gate never locks anything. */
export function gateIndex() {
  return SCHEMA.sections.findIndex(s => s.gate);
}

export function isGated(report) {
  const gate = SCHEMA.sections.find(s => s.gate)?.gate;
  return gate ? !get(report, gate.field) : false;
}

export function isLocked(report, section) {
  const at = gateIndex();
  if (at < 0 || !isGated(report)) return false;
  return SCHEMA.sections.indexOf(section) > at;
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
    if (Object.values(report[section.checkgrid.key] || {}).some(Boolean)) done += 1;
  }
  if (section.fixed) {
    for (const row of section.fixed.rows) {
      if (row.derive) continue;
      for (const col of section.fixed.columns) {
        total += 1;
        if (String(get(report, `${section.fixed.key}.${row.k}.${col.k}`) ?? '').trim()) done += 1;
      }
    }
  }
  return total ? done / total : 0;
}

/* ---------- persistence ---------- */
export function save(report) {
  try {
    localStorage.setItem(key(), JSON.stringify(report));
    return true;
  } catch {
    return false;   // private mode, or quota
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return null;
  }
}

/* A file written against an older schema is accepted rather than
   rejected: missing keys simply come through blank.

   A file written against a *different report type* switches the tool
   to that type. Opening a PEER and being shown a PSDR form would be
   the more surprising behaviour of the two. */
export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data._schema && data._schema !== SCHEMA.id && byId(data._schema)) {
    setActive(data._schema);
  }
  const base = blank();
  const merged = { ...base, ...data };
  for (const cg of checkgrids()) {
    merged[cg.key] = { ...base[cg.key], ...(data[cg.key] || {}) };
  }
  for (const g of grids()) {
    merged[g.key] = { ...base[g.key] };
    for (const row of g.rows) {
      merged[g.key][row.k] = { ...base[g.key][row.k], ...(data[g.key]?.[row.k] || {}) };
    }
  }
  for (const t of tables()) if (!Array.isArray(merged[t])) merged[t] = [];
  merged._schema = SCHEMA.id;
  merged._version = SCHEMA.version;
  return merged;
}

export function filename(report, ext) {
  const ref = derive(report, 'reportRef') || SCHEMA.refCode;
  return `${ref}.${ext}`;
}
