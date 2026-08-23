# Run Plan &amp; Setup Log

Two objects that only make sense together: a run plan that enforces one
variable at a time, and a versioned setup sheet per car. Built on the shared
report engine. No server, no upload, works offline once loaded.

Live at `/tools/run-plan/`. Opens the new **Setup** category.

---

## Why it is built this way

**The value is in the join.** A run plan on its own is a list of intentions and
a setup sheet on its own is a snapshot. Together, every setup revision is
attributable to a run, and every run states the one thing it changed and
whether that change is kept. That join is the whole tool; everything else here
serves it.

**One variable at a time, enforced rather than encouraged.** A run declares
exactly one change. The picker lists parameters from the register, and
selecting one records `from` automatically off the revision the run is based
on — asking for it would be asking someone to retype a number the tool already
has, and a retyped number is a number that can be typed wrong.

When the diff between a run's revision and its parent shows more than the one
declared parameter moved, the run's result fields grey out and say why, naming
the parameters that moved. They stay closed until `deliberate` is ticked *and*
a reason is written. A multi-variable run is not forbidden — sometimes the tyre
allocation forces one — but it is never silent.

**A finding without evidence is not a finding.** A verdict of `keep` or
`revert` requires a non-empty `measured`, enforced in the schema's
`issues(report)` hook, the same place the PEER enforces its reconciliation
rules. A change with no rationale is raised too: why something was tried is the
only part of a run still useful next season.

**History is never rewritten.** A `revert` creates a new revision restoring the
previous value. The revision that made the change stays on file, because "tried
and taken back" is a different fact from "never tried", and it is the one that
stops it being tried again next event.

**The register is data.** `data/setup-register.json` holds 98 parameters across
ten groups. A historic single-seater and a modern GT do not share a setup
sheet, so a class register is a file you load — copy it, edit it, `Load session
or register`. Forking the code per car is the failure mode this avoids.

The arithmetic cannot be data, so it lives in `js/setup-params.js`, keyed by the
parameter it produces. Derived figures are never enterable and never read out
of stored values even if something wrote one there, so a stale figure in an old
file cannot resurface as a current one.

---

## The model

`js/calc/setup-diff.js` is pure — no DOM, importable by Node.

```js
diff(revA, revB, register)      → [{ key, group, label, unit, from, to, delta, deltaPct }]
derivedDiff(revA, revB, reg)    → the consequences, listed apart from the causes
reconcile(run, revA, revB, reg) → { declared, actual, undeclared, notApplied }
runGate(run, reconciliation)    → { gated, message, lockMessage }
```

`undeclared` is what moved and was not declared. `notApplied` is what was
declared and did not move. Both are common, both are silent failures on paper,
and both are trivial to detect once the two revisions are objects and someone
bothers to compare them.

Derived values, computed by the register:

| | |
| --- | --- |
| Total mass | FL + FR + RL + RR |
| Cross weight | (FL + RR) / total × 100 |
| Wheel rate | spring rate × motion ratio², the ratio applying once to travel and once to force |
| Ride frequency | `√(k/m) / 2π`, k in N/m, m the mass that corner carries |
| Rake | rear mean ride height − front mean |
| Aero balance note | stated from the splitter and wing settings, not typed |

---

## The three documents

One report, three tagged templates, all versioned in the filename:

| Template | What it is |
| --- | --- |
| `setup-sheet-v1.0.docx` | the current revision, print-ready for the car file |
| `run-plan-v1.0.docx` | the session's runs, one row per run, landscape, for the pit wall |
| `setup-diff-v1.0.docx` | A vs B, the consequences, and the reconciliation table |

They are built by `tools/make_run_plan_templates.py` and validated by
`tools/validate_template.py` against the schema, the same as the existing three.
The one difference from the other taggers: they re-tag a blank Word form that
somebody drew, and there was no blank form for these, so this script draws them
and tags them in the same pass. Every tag is written as exactly one run by
construction — Word splits a run the moment you type near a tag, and the export
then succeeds with the field blank.

```
python3 tools/make_run_plan_templates.py
python3 tools/validate_template.py \
    _tools/run-plan/templates/setup-sheet-v1.0.docx \
    _tools/run-plan/js/schemas/run-plan.js
```

Also exported: a JSON fragment shaped for the PEER report's setup section, with
the keys confirmed against `_tools/report-builder/js/schemas/peer.js` rather
than invented — `setup.gain`, `setup.expectation`, `setup.changeCount`, and a
`setupChanges` row loop whose columns are `change`, `session`, `reason`,
`effect1`, `effect2` and `retained`. A kept change comes across as `retained:
'Y'`, a reverted one as `'N'`, and the measured result becomes the effect.

---

## What the shared engine gave, and the one thing it did not

The store, the validation, the autosave, the migration and the DOCX export are
all `_tools/_shared/report-engine/`. This tool supplies a schema, a register and
three templates.

Two places needed something the engine did not have:

**Three documents over one report.** A schema named one template. Three views
of one run plan are three tagged documents over the same object, not three
reports, so a schema may now carry a `documents[]` list and `renderDocx(report,
{ document })` picks one. `SCHEMA.payload()` is handed the options too, so each
document gets only the blocks it prints. The change is inert on the existing
path, which `tools/test-docx-fixtures.mjs` proves: the report builder's three
documents still render to the same hashes, entry by entry.

**The gate is per run, not per report.** `store.js` has `section.gate`,
`isGated()` and `isLocked()`: one gating section that locks every section after
it. A run plan needs a gate per run card, which is a different shape. So the
pattern was reused rather than the function — `runGate()` returns the same
`{ message, lockMessage }` shape and the UI treats it the same way. Reusing the
function would have meant one gated run closing every run after it, which is
not the rule.

**Two collections the engine does not know about.** `setups` and `runs` are
lists with nested objects inside them, not flat rows of columns, so neither is a
`table:`. They are added on top of the engine's `blank()` and normalised on the
way in by `js/state.js`, which is also where an older file gets its missing keys
filled blank.

---

## Running it

```
node tools/test-run-plan.mjs             # 89 assertions, including all three documents rendered
python3 tools/make_run_plan_templates.py # rebuild the templates
node tools/build-web.mjs                 # regenerate the scoped stylesheet
node tools/build-tools.mjs               # copy to public/tools/ for local preview
node dev-server.js                       # http://localhost:8788/tools/run-plan/
```

---

## Not built yet

- **Reading a run plan into the PEER automatically.** The fragment exports; the
  Report Builder does not yet import fragments. That is a mapping in the report
  builder, not more plumbing here.
- **Per-corner damper histograms.** The register records clicks and their range;
  it does not read damper pot data, and correlating a click change against
  actual travel is the thing that would make a damper run conclusive rather
  than a matter of opinion.
- **Class registers.** The default register ships; no class overrides do. The
  mechanism is there and tested, and the first real one should come from a car
  rather than from a guess about a car.
- **Multi-car events.** One car per session file. A two-car team runs two files
  and compares them by hand.
