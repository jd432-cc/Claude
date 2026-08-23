/* =============================================================
   TheRacingData — Load Budget & Voltage Drop
   The Loom Planner bridge. Pure functions, no DOM.

   The Loom Planner already knows the wire schedule — gauge,
   length, from and to. This turns that into an electrical answer
   and hands it back, and the handing back is the part that has to
   be right: an export from here must re-import into the planner
   without losing a single field this tool does not own.

   The planner's export is its whole state object:

     { connectors[], components[], wires[], routeNodes[],
       connectorGroups[], wireGroups[] }

   and a wire is:

     { id, wireId, fromConnector, fromPin, toConnector, toPin,
       gauge, colour, length, notes, routeNode?, wireGroup? }

   Of those, this tool owns exactly one: `gauge`. Everything else
   is carried through untouched, in `_loom`, and written back
   verbatim on the way out. What this tool adds — load, duty,
   fuse, insulation, bundle — the planner has no field for, so it
   stays here and travels in the .trd.json session instead.
   ============================================================= */

/* Fields on a planner wire that belong to the planner. Held as a
   list rather than inferred, so a field the planner gains later
   fails loudly here instead of being dropped silently. */
const LOOM_WIRE_FIELDS = [
  'id', 'wireId', 'fromConnector', 'fromPin', 'toConnector', 'toPin',
  'gauge', 'colour', 'length', 'notes', 'routeNode', 'wireGroup',
];

export function isLoomExport(data) {
  return !!data && typeof data === 'object'
    && Array.isArray(data.connectors) && Array.isArray(data.wires);
}

export function csaForGauge(gauge, spec) {
  const map = spec?.awg?.map || {};
  return Number(map[String(gauge)]) || 0;
}

/* The nearest gauge at or above the area, so a conductor sized here
   is never written back as a thinner one than it was sized to. */
export function gaugeForCsa(csa_mm2, spec) {
  const map = spec?.awg?.map || {};
  const rows = Object.entries(map)
    .map(([gauge, area]) => ({ gauge, area: Number(area) }))
    .sort((a, b) => a.area - b.area);
  const hit = rows.find(r => r.area >= csa_mm2 - 1e-9);
  return (hit || rows[rows.length - 1])?.gauge ?? '';
}

/* ---------- planner -> circuits ----------

   A wire schedule row maps straight to a circuit. What is left to
   fill is the load current and the duty cycle, which is exactly the
   information the planner has no field for and this tool exists to
   apply. */
export function fromLoom(loom, spec, existing = []) {
  const priorById = new Map(
    existing.filter(c => c._loom?.id).map(c => [c._loom.id, c]));

  const label = (connId, pin) => {
    const node = [...(loom.connectors || []), ...(loom.components || [])]
      .find(n => n.id === connId);
    if (!node) return String(connId ?? '');
    const p = (node.pins || []).find(x => x.id === pin || x.number === pin);
    return p ? `${node.name}:${p.label || p.number}` : node.name;
  };

  const groupName = id =>
    (loom.wireGroups || []).find(g => g.id === id)?.name || '';

  const circuits = (loom.wires || []).map((wire, i) => {
    const prior = priorById.get(wire.id);
    const csa = csaForGauge(wire.gauge, spec);
    return {
      // Everything this tool adds. A re-import keeps whatever was
      // already filled in against the same planner wire.
      id: prior?.id || `c${i + 1}`,
      name: wire.wireId || label(wire.fromConnector, wire.fromPin),
      group: groupName(wire.wireGroup) || prior?.group || '',
      from: label(wire.fromConnector, wire.fromPin),
      to: label(wire.toConnector, wire.toPin),
      load_a: prior?.load_a ?? '',
      duty_pct: prior?.duty_pct ?? 100,
      class: prior?.class ?? 'continuous',
      kind: prior?.kind ?? 'power',
      inrush_a: prior?.inrush_a ?? '',
      inrush_ms: prior?.inrush_ms ?? '',
      length_m: Number(wire.length) || prior?.length_m || 0,
      dedicatedReturn: prior?.dedicatedReturn ?? true,
      groundNode: prior?.groundNode ?? '',
      csa_mm2: csa || prior?.csa_mm2 || 0,
      conductor: prior?.conductor ?? 'copper',
      insulation: prior?.insulation ?? 'spec55-150',
      bundleSize: prior?.bundleSize ?? 1,
      conductorTemp_c: prior?.conductorTemp_c ?? '',
      fuse_a: prior?.fuse_a ?? '',
      fuseType: prior?.fuseType ?? 'fast',
      fusePosition: prior?.fusePosition ?? '',
      critical: prior?.critical ?? false,

      /* The planner's own row, verbatim. Not read by anything in
         this tool except toLoom(), which writes it straight back. */
      _loom: Object.fromEntries(
        LOOM_WIRE_FIELDS.filter(k => k in wire).map(k => [k, wire[k]])),
    };
  });

  return {
    circuits,
    // The rest of the planner's state, held whole so the export can
    // reproduce a file the planner opens.
    _loomState: {
      connectors: loom.connectors || [],
      components: loom.components || [],
      routeNodes: loom.routeNodes || [],
      connectorGroups: loom.connectorGroups || [],
      wireGroups: loom.wireGroups || [],
    },
  };
}

/* ---------- circuits -> planner ----------

   The round trip. Gauge is written back from the conductor size this
   tool arrived at; everything else on the wire is the planner's own
   field, restored from `_loom`. A circuit created here rather than
   imported is emitted as a new wire with the fields the planner
   needs and nothing invented beyond them. */
export function toLoom(state, spec) {
  const base = state._loomState || {
    connectors: [], components: [], routeNodes: [],
    connectorGroups: [], wireGroups: [],
  };

  const wires = (state.circuits || []).map((c, i) => {
    const kept = c._loom || {};
    const wire = { ...kept };
    if (!wire.id) wire.id = `lb-${i + 1}`;
    if (!wire.wireId) wire.wireId = c.name || `W${i + 1}`;
    if (wire.length === undefined) wire.length = Number(c.length_m) || 0;
    if (wire.colour === undefined) wire.colour = '';
    if (wire.notes === undefined) wire.notes = '';
    if (wire.fromConnector === undefined) wire.fromConnector = '';
    if (wire.fromPin === undefined) wire.fromPin = '';
    if (wire.toConnector === undefined) wire.toConnector = '';
    if (wire.toPin === undefined) wire.toPin = '';
    // The one field this tool owns.
    wire.gauge = gaugeForCsa(Number(c.csa_mm2) || 0, spec);
    return wire;
  });

  return { ...base, wires };
}
