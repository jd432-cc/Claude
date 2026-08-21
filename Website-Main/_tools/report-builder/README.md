# Report Builder

A browser page that fills a report template and exports it as a Word document
in the house format. No server, no upload, works offline once loaded.

Live at `/tools/report-builder/`. First template: **PSDR (Circuit)**.

---

## Why it is built this way

**The template is the layout.** The `.docx` under `templates/` is your blank
form with tags dropped into the cells. No code knows what the document looks
like, so re-tagging the form changes the output without touching JavaScript.

**Nothing leaves the machine.** Motorsport data is confidential and the paddock
has bad signal. Everything runs client-side; autosave is `localStorage` and
sharing is an explicit file export.

**One report object.** The form, the DOCX payload and the `.trd.json` file are
all views of the same object, so there is only one thing to get wrong.

---

## Running it

```
node tools/build-web.mjs          # regenerate scoped CSS
node tools/test-report-builder.mjs # 27 assertions, end-to-end
pwsh build.ps1                    # build public/
node dev-server.js                # http://localhost:8788
```

Validate a template before shipping it:

```
python3 tools/validate_template.py \
    _tools/report-builder/templates/psdr-circuit-v1.2.docx \
    _tools/report-builder/js/schema.js
```

---

## Changes to the existing repo

Three things were broken before this tool could be added.

**`build.ps1` could not reproduce `public/tools/`.** The build deletes `public/`
and rebuilds it from `_source`, two runtime files and `static/*` (`-File`,
non-recursive). Nothing re-created `public/tools/**`. The loom planner survived
only because the script had not been re-run since it was added — the next run
would have deleted it. Tools now live in `_tools/` and are copied recursively.
`loom-planner` moved there unchanged.

**`dev-server.js` 404'd on directory URLs.** `/tools/loom-planner/` resolved to
a directory, `readFile` returned `EISDIR`, and the tool failed locally while
serving correctly in production. Now falls back to `index.html`. Also added
`.css`, `.woff2` and `.docx` MIME types.

**`tools/build-web.mjs` was referenced but missing.** `planner.css` documents a
scoping step that had no script. Reconstructed: emits `*.scoped.css` with every
selector prefixed by the tool's root id, so an unscoped stylesheet can be
embedded in the site shell without `button { ... }` restyling the marketing
pages. Idempotent, and `--check` fails the build if output is stale.

**`_headers`** gained a real CSP for `/tools/*` and an immutable cache rule for
versioned templates.

---

## The template

`psdr-circuit-v1.2.docx`, produced from `PSDR v1.1 TEMPLATE.docx` by
`tools/tag_psdr_circuit.py`. Re-runnable against a new revision of the blank
form. 90 tags, 4 row loops.

Tagging in code rather than by hand is deliberate: Word splits a run the moment
you type near a tag, turning `{bestLap}` into `{best` + `Lap}` across two runs.
The export still succeeds — the field just comes out blank. The validator
catches exactly this.

### Three things that will bite you if you tag by hand

**Loops repeat everything between `FOR` and `END-FOR`.** Both tags in one row
repeats that row's *cells*, giving one very wide row. `FOR` in the body row
leaks a stray leading cell on every iteration. Each command needs its own
carrier row; rows containing only a command are dropped by the engine.

**Loop variables need a `$` prefix.** `{$o.corner}`, not `{o.corner}`.

**The browser build sandboxes each tag in a fresh `<iframe>`.** Slow, and it
would force `unsafe-eval` into the CSP. `js/resolve.js` replaces it with a path
resolver that understands `a.b.c` and `$idx+1` and nothing else. That is why
`/tools/*` can carry a real policy, and why a template cannot execute code.

### Defects fixed in the blank form

- Sections 2 and 6 had heading boxes with no paragraph to write into.
- Only 2 of the 5 guidance lines were italic. Keying deletion off italics would
  have shipped the other three in every issued report. All five are now wrapped
  in `{IF showGuidance}`; the three stragglers were italicised to match the
  form's own stated rule.

---

## What the form enforces

The doctrine is validation, not a suggestion.

- **No cause without a trace.** An opportunity row with content but no evidence
  is flagged and blocks a clean RELEASE.
- **Section 1 gates the rest.** Until the reference lap is confirmed clean, the
  later sections stay closed. A bad reference makes every number below it wrong.
- **Derived figures are computed, never typed** — gap to theoretical, total
  recoverable, projected best, biggest opportunity, window %, consistency band,
  report reference. The arithmetic in the document cannot disagree with the
  arithmetic in the form.
- **The consistency scale prints whole**, with the achieved band marked. Printing
  only the achieved band would lose the comparison that makes the scale worth
  printing.

DRAFT keeps the guidance lines; RELEASE strips them.

---

## Adding the other five templates

Mechanical, in this order — PSDR Rally, PEER Circuit, PEER Rally, then the two
PSDBs.

1. Copy `tag_psdr_circuit.py`, adjust the table map, run it.
2. Write a schema alongside `schema.js`. Nothing else in the form needs changing.
3. Run the validator, then the test suite.

The PSDBs are last and hardest: repeating corner blocks and the circle-one
balance scales. Per the decision taken, the full scale prints with the chosen
token highlighted rather than printing the selection alone — each token needs
pre-splitting into its own run so it can be bolded individually.

---

## Not built yet

- **PDF.** DOCX is the deliverable; Word or LibreOffice exports the PDF. A
  print-CSS path is only worth building for the PSDB blank sheets, where
  printing at the halt is the actual use case.
- **The Node CLI.** Same renderer, no browser, for the Python pipeline to shell
  out to. `js/docx.js` is already free of DOM dependencies except `download()`.
- **PEER ingestion.** The point of the `.trd.json` export: a PEER pre-populates
  from every PSDR and PSDB filed that event.

---

## Third-party

`docx-templates` 4.15.0 (MIT), vendored at
`assets/vendor/docx-templates.browser.js`, licence alongside it. Vendored rather
than loaded from a CDN so the tool works offline and needs no CSP exception.
