# `_tools/`

Source for everything served under `/tools/`. **Edit here, never under
`public/tools/`** — `build.ps1` deletes `public/` and rebuilds it from
`_source/`, `static/` and this directory, so a hand edit to the build output
lives until the next build and no longer.

```
_tools/
  index.html            the /tools/ landing page — see the warning below
  _shared/              engine and assets used by more than one tool
    report-engine/      form, store, DOCX export, tag resolver, registry
    assets/             Archivo, docx-templates, logo, favicon
    css/trd-tokens.css  brand palette and type, on [data-trd]
  loom-planner/
  report-builder/
  fuel-stint/
  load-budget/
  run-plan/
  event-pack/
```

---

## Adding a tool

A tool is not finished when its directory exists. Three registration points sit
outside it, and a tool that misses one fails quietly rather than loudly.

**1. `static/_headers`** — a `/tools/<slug>/*` block with a Content-Security
Policy. A tool with no entry ships with no policy at all. Target the strict one:

```
/tools/<slug>/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'
```

That policy forbids inline styles, so no `style="..."` attributes anywhere in
the markup. Positioning goes in the stylesheet.

**2. `tools/build-web.mjs`** — add `'<slug>': '#trd-<slug>'` to `SCOPES`.
Without it no scoped stylesheet is generated, and the tool cannot be embedded
in the site shell without its `button { ... }` rules restyling the marketing
pages.

**3. `_tools/index.html`** — the catalogue. See below.

Then: a `README.md` inside the tool directory explaining *why* it is built the
way it is, and a `tools/test-<slug>.mjs` asserting on its pure calculation
modules — plain Node, no browser, no framework.

---

## `index.html` is a design export

The landing page is exported from claude.ai/design. The whole page, markup and
logic, lives inside a single escaped string in a JavaScript bundle, and the
catalogue is a hardcoded `live[]` array inside the `<script type="text/x-dc">`
block at the end of it.

**A re-export overwrites it.** Everything in the list below has to be re-applied
by hand afterwards:

- the six entries in `live[]` — loom planner, report builder, fuel & stint,
  load budget, run plan, event pack. Plain text, not HTML: the runtime escapes
  what it renders, so `&amp;` comes out as `&amp;` on the card;
- `"Setup"` added to the `cats` array, which was
  `["Telemetry", "Strategy", "Logistics"]`, **and** the cycle changed from
  `% 3` to `% cats.length` — hard-coding the count leaves the fourth category
  unreachable;
- the placeholder ceiling raised from 9 to 12 (`for (let i = live.length + 1;
  i <= 12; i++)`), so the grid still fills;
- the two figures in the count band at the top of the page — `12` tools and
  `6` live;
- **the trailing slash on the card link**: `href: isLive ? base + t.slug + "/"`.
  Without it the browser resolves every relative asset in the tool's page
  against `/tools/` rather than `/tools/<slug>/`, and the page arrives with no
  stylesheet and no script. This one was already wrong for the two tools that
  were live before, so it is the edit most worth checking after a re-export.

The alternative — generating the catalogue from a data file at build time —
would mean the design export could no longer round-trip, which is a larger
decision than this note.

---

## The shared report engine

Two tools fill a structured form and export a Word document from a tagged
template: the Report Builder and, on the same engine, Run Plan and Event Pack.
The engine is `_shared/report-engine/`, and a tool built on it supplies three
things:

- **schemas** — one per document, declaring sections, fields, tables, fixed
  grids, derived values and validation rules;
- **a register** — `createRegistry(schemas)` then `useRegistry(...)` at boot,
  which is what makes `SCHEMA` resolve inside the engine;
- **tagged templates** — a `.docx` per document under `templates/`, versioned
  in the filename, tagged by a script under `tools/` rather than by hand.

`SCHEMA` is a live binding. Import it; do not destructure a copy off a dynamic
import, or the tool freezes on whichever schema was loaded first.

Validate a template against its schema before shipping it:

```
python3 tools/validate_template.py <template.docx> <schema.js>
```

---

## Build and test

```
node tools/build-web.mjs            # regenerate scoped CSS
node tools/build-web.mjs --check    # CI gate: fails if any .scoped.css is stale
node tools/build-tools.mjs          # _tools/ -> public/tools/, for local preview
node tools/test-report-builder.mjs  # 49 assertions
node tools/test-docx-fixtures.mjs   # DOCX output unmoved, per zip entry
node tools/test-fuel-stint.mjs
node tools/test-load-budget.mjs
node tools/test-run-plan.mjs
node tools/test-event-pack.mjs
pwsh build.ps1                      # the real build
node dev-server.js                  # http://localhost:8788
```

`build.ps1` is the authority and it throws before it reaches the tools step:
it requires `_source/Homepage.dc.html`, `_source/Services.dc.html`,
`_source/support.js`, `_source/image-slot.js` and `data/stats.json`, none of
which are in this tree. `tools/build-tools.mjs` reproduces its tools step and
only its tools step, so the tool pages can be previewed through `dev-server.js`
in the meantime. It is not a replacement for the build.
