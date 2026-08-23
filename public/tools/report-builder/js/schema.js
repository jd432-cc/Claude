/* =============================================================
   TheRacingData — Report Builder
   The report register.

   One tool, three documents. Each is a schema module under
   schemas/; nothing else in the tool knows which one is loaded.

   The register itself is the shared engine's, created here and
   installed here: this is the only file that knows which reports
   this tool carries. `SCHEMA` is re-exported as the live binding
   it is, so importers see whatever `setReport` last selected.
   Import the binding, do not destructure a copy off a dynamic
   import, or the tool freezes on one report.
   ============================================================= */

import { createRegistry, useRegistry }
  from '../../_shared/report-engine/registry.js';
import { PSDR_CIRCUIT } from './schemas/psdr-circuit.js';
import { PEER } from './schemas/peer.js';
import { PSDB } from './schemas/psdb.js';

export const REPORTS = [PSDR_CIRCUIT, PEER, PSDB];

useRegistry(createRegistry(REPORTS));

export { SCHEMA, byId as reportById, setActive as setReport }
  from '../../_shared/report-engine/registry.js';
