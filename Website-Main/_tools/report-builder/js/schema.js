/* =============================================================
   TheRacingData — Report Builder
   The report register.

   One tool, three documents. Each is a schema module under
   schemas/; nothing else in the tool knows which one is loaded.

   `SCHEMA` is a live binding: every module imports it once and
   sees whatever `setReport` last selected, so switching report
   type is a state change rather than a page load. The store keys
   its autosave by schema id, so each report type keeps its own
   work in progress and swapping back finds it where it was left.
   ============================================================= */

import { PSDR_CIRCUIT } from './schemas/psdr-circuit.js';
import { PEER } from './schemas/peer.js';
import { PSDB } from './schemas/psdb.js';

export const REPORTS = [PSDR_CIRCUIT, PEER, PSDB];

/* A live binding: importers see whatever `setReport` last selected.
   Import it, do not destructure it off a dynamic import — that copies
   the value and freezes the tool on one report. */
export let SCHEMA = REPORTS[0];

export function reportById(id) {
  return REPORTS.find(r => r.id === id) || null;
}

export function setReport(id) {
  const next = reportById(id);
  if (!next) throw new Error(`unknown report type: ${id}`);
  SCHEMA = next;
  return SCHEMA;
}
