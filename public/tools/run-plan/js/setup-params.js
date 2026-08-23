/* =============================================================
   TheRacingData — Run Plan & Setup Log
   The setup parameter register.

   One flat register: every setting the sheet carries, with its
   group, its unit and its precision. The form, the printed sheet
   and the diff all read it, so a parameter cannot exist in one and
   not the others.

   The list itself is data — data/setup-register.json — so a car
   class can override it. A historic single-seater and a modern GT
   do not share a setup sheet, and forking the code per car is the
   failure mode to avoid.

   The arithmetic cannot be data, so it is here, keyed by the
   parameter it produces. A register entry marked `computed` names
   one of these and is never enterable: cross weight from four
   corner weights, wheel rate from spring rate and motion ratio,
   ride frequency from wheel rate and corner mass. Same rule the
   report engine encodes with `computed` and `mirror`, for the same
   reason — the printed sheet and the form cannot be allowed to
   disagree.
   ============================================================= */

const CORNERS = ['fl', 'fr', 'rl', 'rr'];

const num = (values, key) => {
  const v = values?.[key];
  const n = Number(v);
  return v === '' || v == null || !Number.isFinite(n) ? null : n;
};

const sum = (values, keys) => {
  const parts = keys.map(k => num(values, k));
  return parts.some(p => p === null) ? null : parts.reduce((a, b) => a + b, 0);
};

const mean = (values, keys) => {
  const total = sum(values, keys);
  return total === null ? null : total / keys.length;
};

/* Each returns a number or null. Null prints blank rather than
   printing a zero that looks like a measurement. */
export const DERIVED = {
  massTotal: v => sum(v, CORNERS.map(c => `mass.corner.${c}`)),

  /* (FL + RR) / total. Fifty per cent is a car that behaves the same
     in both directions; anything else is a car that does not, and
     the number is worth more than the four weights it comes from. */
  crossWeight(v) {
    const total = DERIVED.massTotal(v);
    const cross = sum(v, ['mass.corner.fl', 'mass.corner.rr']);
    return total && cross !== null ? (cross / total) * 100 : null;
  },

  frontPct(v) {
    const total = DERIVED.massTotal(v);
    const front = sum(v, ['mass.corner.fl', 'mass.corner.fr']);
    return total && front !== null ? (front / total) * 100 : null;
  },

  rideHeightF: v => mean(v, ['ride.height.fl', 'ride.height.fr']),
  rideHeightR: v => mean(v, ['ride.height.rl', 'ride.height.rr']),

  rake(v) {
    const f = DERIVED.rideHeightF(v);
    const r = DERIVED.rideHeightR(v);
    return f === null || r === null ? null : r - f;
  },

  /* Wheel rate is the spring rate through the motion ratio, squared:
     the ratio applies once to the travel and once to the force. */
  wheelRateF: v => wheelRate(num(v, 'spring.rateF'), num(v, 'spring.motionRatioF')),
  wheelRateR: v => wheelRate(num(v, 'spring.rateR'), num(v, 'spring.motionRatioR')),

  rideFreqF(v) {
    const corner = mean(v, ['mass.corner.fl', 'mass.corner.fr']);
    return rideFrequency(DERIVED.wheelRateF(v), corner);
  },
  rideFreqR(v) {
    const corner = mean(v, ['mass.corner.rl', 'mass.corner.rr']);
    return rideFrequency(DERIVED.wheelRateR(v), corner);
  },

  toeTotalF: v => sum(v, ['geo.toe.fl', 'geo.toe.fr']),
  toeTotalR: v => sum(v, ['geo.toe.rl', 'geo.toe.rr']),

  /* Not a number. Stated from the two settings above it rather than
     typed, so a note that contradicts the sheet cannot be written. */
  aeroBalance(v) {
    const splitter = num(v, 'aero.splitter');
    const wing = num(v, 'aero.wingAngle');
    if (splitter === null && wing === null) return null;
    const parts = [];
    if (splitter !== null) parts.push(`splitter ${splitter} mm`);
    if (wing !== null) parts.push(`wing ${wing}°`);
    return parts.join(', ');
  },
};

export function wheelRate(springRate, motionRatio) {
  if (springRate === null || motionRatio === null) return null;
  return springRate * motionRatio * motionRatio;
}

/* f = sqrt(k / m) / 2pi, with k in newtons per metre and m the mass
   that corner carries. The register holds wheel rate in N/mm, which
   is a thousand times the SI figure and the unit every spring is
   actually sold in. */
export function rideFrequency(wheelRate_N_per_mm, cornerMass_kg) {
  if (!wheelRate_N_per_mm || !cornerMass_kg) return null;
  return Math.sqrt((wheelRate_N_per_mm * 1000) / cornerMass_kg) / (2 * Math.PI);
}

/* ---------- the register ---------- */

export function createRegister(data) {
  const params = (data.params || []).map(p => ({ ...p }));
  const byKey = new Map(params.map(p => [p.key, p]));
  const order = new Map(params.map((p, i) => [p.key, i]));

  return {
    id: data.id,
    label: data.label,
    note: data.note,
    groups: data.groups || [...new Set(params.map(p => p.group))],
    params,
    byKey: k => byKey.get(k) || null,
    order: k => (order.has(k) ? order.get(k) : Number.MAX_SAFE_INTEGER),
    entered: params.filter(p => !p.computed),
    inGroup(group) { return params.filter(p => p.group === group); },

    /* The one place a parameter's value is read. A computed parameter
       is never read out of the stored values, even if something wrote
       one there, so a stale figure in an old file cannot resurface as
       a current one. */
    value(values, key) {
      const param = byKey.get(key);
      if (!param) return null;
      if (param.computed) {
        const fn = DERIVED[param.computed];
        return fn ? fn(values || {}) : null;
      }
      const v = values?.[key];
      return v === '' || v == null ? null : v;
    },

    format(values, key) {
      const param = byKey.get(key);
      const v = this.value(values, key);
      if (v === null) return '';
      if (typeof v === 'string') return v;
      const dp = Number.isFinite(param?.precision) ? param.precision : 2;
      return Number(v).toFixed(dp);
    },
  };
}
