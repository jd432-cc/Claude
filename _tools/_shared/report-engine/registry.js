/* =============================================================
   TheRacingData — shared report engine
   The schema register.

   Every tool built on this engine fills a structured form and
   exports a Word document from a tagged template. What differs
   between them is the set of schemas, so the register is a
   factory rather than a fixed list: each tool creates its own
   and installs it at boot, and nothing in the engine knows what
   is in it.

   `SCHEMA` is a live binding: every engine module imports it once
   and sees whatever the installed register last selected, so
   switching report type is a state change rather than a page
   load. Import the binding; do not destructure it off a dynamic
   import, which copies the value and freezes the tool on one
   schema.
   ============================================================= */

/* The live binding the engine reads. Null until a tool installs a
   register, which it does before anything is rendered. */
export let SCHEMA = null;

let installed = null;

export function createRegistry(schemas) {
  if (!Array.isArray(schemas) || !schemas.length) {
    throw new Error('a schema register needs at least one schema');
  }
  const seen = new Set();
  for (const s of schemas) {
    if (!s?.id) throw new Error('every schema needs an id');
    if (seen.has(s.id)) throw new Error(`duplicate schema id: ${s.id}`);
    seen.add(s.id);
  }

  const registry = {
    schemas,
    SCHEMA: schemas[0],
    byId(id) {
      return schemas.find(s => s.id === id) || null;
    },
    setActive(id) {
      const next = registry.byId(id);
      if (!next) throw new Error(`unknown report type: ${id}`);
      registry.SCHEMA = next;
      // A register that is not the installed one still tracks its own
      // selection; only the installed one moves the engine's binding.
      if (installed === registry) SCHEMA = next;
      return next;
    },
  };
  return registry;
}

/* Called once at boot by the tool that owns the register. */
export function useRegistry(registry) {
  installed = registry;
  SCHEMA = registry.SCHEMA;
  return registry;
}

/* The engine's own view of the installed register. A tool re-exports
   these under whatever names its own code already uses. */
export function byId(id) {
  return installed ? installed.byId(id) : null;
}

export function setActive(id) {
  if (!installed) throw new Error('no schema register installed');
  return installed.setActive(id);
}
