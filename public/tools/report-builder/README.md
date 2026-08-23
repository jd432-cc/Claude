# Report Builder

A browser page that fills a report template and exports it as a Word document
in the house format. No server, no upload, works offline once loaded.

Live at `/tools/report-builder/`. Three documents, picked from the toolbar:

| | Document | Template |
| --- | --- | --- |
| **PSDR** | Post-Session Data Report (Circuit) | `psdr-circuit-v1.2.docx` |
| **PEER** | Post Event Engineering Report | `peer-v1.4.docx` |
| **PSDB** | Post-Session Driver Debrief | `psdb-v1.0.docx` |

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

**One form, three documents.** Nothing outside `js/schemas/` knows which report
is loaded. `js/schema.js` is the register and `SCHEMA` is a live binding, so
swapping type is a state change rather than a page load, and adding a fourth
report is a schema and a tagged template — not another form.

---

## Switching report type

The picker in the toolbar. Each type keeps its own autosave, keyed by schema
id, so leaving a half-written PSDR to fill a PSDB and coming back finds the
PSDR where it was left. Which one was open last is remembered separately.

A `.trd.json` session file names its own type, and opening one follows it:
loading a PEER while the PSDR form is up switches the form to the PEER rather
than dropping the fields it does not recognise.

---

## Running it

```
node tools/build-web.mjs          # regenerate scoped CSS
node tools/test-report-builder.mjs # 49 assertions, all three reports
pwsh build.ps1                    # build public/
node dev-server.js                # http://localhost:8788
```

Validate a template against its schema before shipping it:

```
python3 tools/validate_template.py \
    _tools/report-builder/templates/psdr-circuit-v1.2.docx \
    _tools/report-builder/js/schemas/psdr-circuit.js
```

Re-tag a template from its blank form — re-runnable against a new revision:

```
python3 tools/tag_psdr_circuit.py "PSDR v1.1 TEMPLATE.docx"  templates/psdr-circuit-v1.2.docx
python3 tools/tag_peer.py         "PEER TEMPLATE v1.4.docx"  templates/peer-v1.4.docx
python3 tools/tag_psdb.py         "PSDB TEMPLATE v1.0.docx"  templates/psdb-v1.0.docx
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

**The stylesheet declared a webfont that was never shipped.** `@font-face` named
`assets/fonts/Archivo-Variable.woff2`, which is not in the package: online the
Google Fonts link in the page covered it, offline the text fell back to Arial
and the request 404'd. Archivo is vendored now and the CDN link is gone.

The loom planner still loads Archivo from Google Fonts. Until it is vendored too
the `/tools/*` CSP has to keep `fonts.googleapis.com` and `fonts.gstatic.com`;
the report builder no longer uses either.

---

## The templates

Each is produced from its blank form by a tagger under `tools/`, re-runnable
against a new revision of that form. The helpers are shared; a tagger is a map
from the form's tables to tag names and nothing else.

| Template | Tagger | Tags | Row loops |
| --- | --- | --- | --- |
| `psdr-circuit-v1.2.docx` | `tag_psdr_circuit.py` | 90 | 4 |
| `peer-v1.4.docx` | `tag_peer.py` | 374 | 18 |
| `psdb-v1.0.docx` | `tag_psdb.py` | 51 | 1 |

Tagging in code rather than by hand is deliberate: Word splits a run the moment
you type near a tag, turning `{bestLap}` into `{best` + `Lap}` across two runs.
The export still succeeds — the field just comes out blank. The validator
catches exactly this.

### Four things that will bite you if you tag by hand

**Loops repeat everything between `FOR` and `END-FOR`.** Both tags in one row
repeats that row's *cells*, giving one very wide row. `FOR` in the body row
leaks a stray leading cell on every iteration. Each command needs its own
carrier row; rows containing only a command are dropped by the engine.

**Loop variables need a `$` prefix.** `{$o.corner}`, not `{o.corner}`.

**The browser build sandboxes each tag in a fresh `<iframe>`.** Slow, and it
would force `unsafe-eval` into the CSP. `js/resolve.js` replaces it with a path
resolver that understands `a.b.c` and `$idx+1` and nothing else. That is why
`/tools/*` can carry a real policy, and why a template cannot execute code.

**Braces in the form are commands.** A blank form containing `{` anywhere in
its text reaches the engine as a command and fails the export. The validator
reports it as a tag with no source, which is how the one in the PEER was found.

### The three shapes

Almost everything in these forms is one of three things, and the schema says
which:

- **a labelled cell** — the label stays, the value lands beside or beneath it;
- **a fixed grid** (`fixed:`) — the form's own rows, filled cell by cell, named
  `{grid.row.column}`. A TOTAL row is derived from the rows above it;
- **a row loop** (`table:`) — as many rows as there is content, and no more.

A fourth handles the prompts. The PEER carries its instructions inside the
cells, so a prompt is bracketed with `{IF showGuidance}` and the value goes
underneath it: DRAFT keeps the prompt, RELEASE prints the answer alone.

### Defects fixed in the blank forms

**PSDR v1.1**

- Sections 2 and 6 had heading boxes with no paragraph to write into.
- Only 2 of the 5 guidance lines were italic. Keying deletion off italics would
  have shipped the other three in every issued report. All five are now wrapped
  in `{IF showGuidance}`; the three stragglers were italicised to match the
  form's own stated rule.

**PEER v1.4**

- An unresolved cross-reference, `{{ref:driver-performance}}`, sat in the
  section 3 guidance. Left alone it reaches the engine as a command and fails
  the export outright. Resolved to the section number it points at.
- The Qualified cell carried `gsdf` — stray keystrokes in the blank form.

**PSDB v1.0**

- Seventeen corner blocks, copied and pasted. They are one block and a row
  loop now, so a filled report carries as many as there are corners.

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
- **The PEER's gap split must reach 100%.** The form's own rule — attribute the
  whole deficit or the split is not credible — so a split that does not is
  raised as an issue rather than left for the reader to notice.

Each schema brings its own rules; the store enforces whatever it is given.
DRAFT keeps the guidance lines; RELEASE strips them.

---

## The circled scales

The PSDB is a printed form: the driver's balance is circled on a scale, not
written down. Per the decision taken, the full scale prints with the chosen
token highlighted rather than printing the selection alone.

Emphasis cannot come from the data — the engine substitutes text, not
formatting — so the template carries it instead. Each scale cell is three runs:
plain, **bold**, plain. The payload splits the scale around the selection and
puts the chosen token in the middle one, which is the run that is bold. Nothing
is circled by the engine; the bold token is.

An unfilled PSDB is therefore not an empty document. It is the blank sheet,
seventeen corner blocks and all, which is what gets taken to the halt.

---

## Adding the remaining templates

Mechanical: the rally variants of all three, then any new document.

1. Copy the nearest tagger, adjust the table map, run it. The helpers in
   `tools/docx_tagging.py` do the work; the tagger is only the map.
2. Write a schema in `js/schemas/` and add it to the register in
   `js/schema.js`. Nothing else in the tool needs changing.
3. Run the validator against the pair, then the test suite.

A schema declares anything its own `payload` hook adds under `provides:`, so
the validator can tell a tag it does not recognise from one the schema supplies
itself.

---

## Not built yet

- **PDF.** DOCX is the deliverable; Word or LibreOffice exports the PDF. A
  print-CSS path is only worth building for the PSDB blank sheets, where
  printing at the halt is the actual use case.
- **The Node CLI.** Same renderer, no browser, for the Python pipeline to shell
  out to. `js/docx.js` is already free of DOM dependencies except `download()`.
- **PEER ingestion.** The point of the `.trd.json` export: a PEER pre-populates
  from every PSDR and PSDB filed that event. All three now share one store, so
  the remaining work is a mapping, not plumbing.

- **The PEER's repeated session block.** The form says to copy section 4 once
  per session. The form fills one block; the runs, stints and qualifying rows
  inside it are loops, so a single session is complete. A second session is
  still a copy and paste in Word.

---

## Third-party

`docx-templates` 4.15.0 (MIT), vendored at
`assets/vendor/docx-templates.browser.js`, licence alongside it.

**Archivo** (SIL Open Font Licence), from
[Omnibus-Type/Archivo](https://github.com/Omnibus-Type/Archivo), vendored at
`assets/fonts/`, licence alongside it. Five static weights — 400, 500, 600, 700
and 800 — which is what the stylesheet asks for. Upstream publishes no variable
woff2, only a variable `.ttf`; five files that are certainly right beat one
converted here. Adding a weight to the CSS means adding a face, or the stack
falls back to Arial for it.

Both are vendored rather than loaded from a CDN for the same reason: the tool is
used where the signal is not. The page now makes no offsite request at all, so
it renders the same on a lost connection as on a good one.
