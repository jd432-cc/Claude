/* =============================================================
   TheRacingData — Report Builder
   Value helpers: dotted paths and lap times.

   Kept apart from store.js so a schema can import them without
   importing the store that will go on to import the schema.
   ============================================================= */

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

/* Accepts 2:14.82 or 134.82 and normalises to seconds, so a gap can
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

/* Every schema builds its report reference the same way; only the
   document code in the middle changes. */
export function reference(report, code) {
  const parts = [report.round, report.venueCode, code, report.carCode];
  if (parts.some(p => !p)) return '';
  return parts.map(p => String(p).toUpperCase()).join('-');
}
