# BTS Enterprise Standards Suite

AutoCAD standards tooling for BTS utility survey drawings. Audits, repairs and
remaps drawings against the BTS layer register (synchronised to
`BTS-Standard-RevE.dws`), checks PAS 128 quality level attribution, and rolls
the results up across a project.

Targets **AutoCAD LT 2024+** and full AutoCAD 2024+. Pure AutoLISP throughout —
`entmake` / `entget` / `entmod` / `ssget` / `tblnext` and DXF group codes. No
ActiveX, no ObjectDBX, no VBA, because LT has none of them.

## Install

1. Copy `src/` to a shared folder, e.g. `X:\CAD\BTS\`.
2. Add that folder to **Options > Files > Support File Search Path**.
3. Load it: `(load "X:/CAD/BTS/BTSLoad.lsp")` — or add `BTSLoad.lsp` to
   **APPLOAD > Startup Suite** so it loads with every drawing.
4. `BTSHELP` lists every command the loaded modules provide.

Step 2 is not optional if you intend to use the batch commands: they have to
find the suite again from inside each drawing they open.

## Commands

### Single drawing

| Command | Effect |
| --- | --- |
| `BTSCHECK` | Audit against the register. Read only. |
| `BTSFIX` | Create missing layers; correct colour, linetype, lineweight, plot state, transparency, descriptions. |
| `BTSREMAP` | Move objects off legacy layers, split hatch fills onto `-Hatch` layers, purge. |
| `BTSVARS` | Check drawing variables, offer to set them. |
| `BTSJUNK` | Bound-xref residue, dead title blocks, PDF-import styles. Read only. |
| `BTSOVERRIDE` | Objects whose colour, lineweight or transparency is BYOBJECT. Read only. |
| `BTSQLCHECK` | PAS 128 quality level attribution. Read only. |
| `BTSTEXTCHECK` | Text style, layer, distortion, height consistency, unresolved SHX. Read only. |
| `BTSREPORT` | Write the audit to a `.txt` beside the drawing. |
| `BTSCOMPLETECHECK` | Every check in the suite, one report, one score. |

### Folder and project

| Command | Effect |
| --- | --- |
| `BTSBATCHCHECK` | Audit every drawing in a folder. Read only. |
| `BTSBATCHFIX` | Create and correct layers in every drawing. **Saves.** |
| `BTSBATCHREMAP` | Clear legacy layers in every drawing. **Saves.** |
| `BTSBATCHVARS` | Check, and optionally set, variables across a folder. |
| `BTSBATCHJUNK` | Template residue across a folder. Read only. |
| `BTSBATCHREPORT` | Full check of a folder, rolled into one `.txt`. |
| `BTSPROJECTAUDIT` | The same, recursing through subfolders. |
| `BTSPROJECTREPORT` | Roll a batch log up into a management summary. |
| `BTSPACKAGE` | Issue readiness, manifest and transmittal script. |

Usual order on an inherited drawing:

```
BTSCHECK -> BTSFIX -> BTSREMAP -> BTSOVERRIDE -> BTSJUNK -> BTSREPORT
```

`BTSFIX` must run before `BTSREMAP`, or every remap is skipped for want of a
target layer. `BTSBATCHREMAP` offers to run the fix pass for you.

## How batch mode works, and what it demands of you

There is no ObjectDBX in AutoCAD LT, so a batch command cannot open drawings
in memory. Instead it enumerates the folder, writes a `.scr` that opens each
drawing and calls `bts:batch-run` inside it, and offers to launch it. Every
drawing appends to one shared log; `BTSPROJECTREPORT` rolls that log up.

Before running one:

- **Close every other drawing.** The script opens and closes documents.
- The drawing you launch from is **excluded** from the run — closing it would
  take the running script down with it.
- A drawing already open elsewhere on the network opens read-only. Write modes
  log it as skipped rather than failing the whole run.
- Write modes (`BTSBATCHFIX`, `BTSBATCHREMAP`, `BTSBATCHVARS` when setting)
  save each drawing in place. **Back the folder up first.**

Both files land next to the drawings, named `_BTS_<MODE>_<timestamp>`.

## Tuning

Everything site-specific is a register at the top of a module:

| Variable | File | What it controls |
| --- | --- | --- |
| `*BTS-LAYERS*` | `BTSEnterprise.lsp` | The layer register. Keep synchronised to the DWS. |
| `*BTS-REMAP*` / `*BTS-SPLIT*` | `BTSEnterprise.lsp` | Legacy layer names and how they map forward. |
| `*BTS-VARS*` | `BTSEnterprise.lsp` | Drawing variables and their required values. |
| `*BTS-TITLEBLOCK*` | `BTSEnterprise.lsp` | Title block name patterns and required attribute tags. |
| `*BTS-VP-SCALES*` | `BTSEnterprise.lsp` | Plot scales a viewport may use. |
| `*BTS-PAPER-UNITS-PER-MM*` | `BTSEnterprise.lsp` | Set to 1.0 for sheets drawn in millimetres. |
| `*BTS-SEVERITY*` | `BTSEnterprise.lsp` | Deviation weights feeding the 0–100 compliance score. |
| `*BTS-TEXT-STYLES*` / `*BTS-TEXT-LAYERS*` | `BTSAnno.lsp` | Approved styles, and where text may live. |
| `*BTS-QL-CODES*` | `BTSSurvey.lsp` | Valid PAS 128 quality levels. |
| `*BTS-TRANSMITTAL-SETUP*` | `BTSProject.lsp` | Named eTransmit setup `BTSPACKAGE` drives. |

## Departures from the reference document

- The reference lists `BTSJUNK` and `BTSREPORT` twice — once as single-drawing
  commands, once as folder-wide CAD manager commands. One name cannot be both,
  so the folder-wide versions are **`BTSBATCHJUNK`** and **`BTSBATCHREPORT`**.
  `BTSJUNK` and `BTSREPORT` keep their existing single-drawing behaviour.
- Internal function names follow the reference, so several v1.1 names have
  changed: `bts:lay-in-std` → `bts:lay-in-standard`, `bts:count-on` →
  `bts:count-on-layer`, `bts:move-sel` → `bts:move-selection`,
  `bts:move-blocks` → `bts:move-block-contents`, `bts:mk-layer` →
  `bts:create-layer`. Anything outside this suite calling the old names needs
  updating; there are no aliases.
- `bts:delete-layer` is `bts:purge-safe`. A layer is only ever removed when it
  is empty, not current, and unreferenced — including by a per-viewport freeze.
- The reference's recommended workflow skips step 6; `BTSHELP` prints the
  corrected sequence.

## Known limitations

- **Not yet exercised against a live AutoCAD.** The suite is checked for
  balanced forms, a resolved call graph, no leaked locals, and the string
  routines are unit-tested by transliteration — but it has not been run in the
  application. Test on copies before pointing a write mode at live work.
- Objects inside xrefs cannot be remapped. `BTSREMAP` reports what it could not
  move rather than pretending it succeeded.
- Dynamic-block title blocks insert under anonymous names (`*U12`) and will not
  match `*BTS-TITLEBLOCK*` patterns.
- The viewport scale check assumes millimetre sheets over a metre model. Change
  `*BTS-PAPER-UNITS-PER-MM*` if that is not true.
- MTEXT stacked fractions (`\S…;`) are dropped when text is flattened for QL
  scanning; a quality level written inside a stack will not be seen.
- `BTSPACKAGE` writes a transmittal script that requires a saved eTransmit
  setup named in `*BTS-TRANSMITTAL-SETUP*`; `-ETRANSMIT` cannot define one from
  the command line.
- Layer transparency is stored as xdata under `AcCmTransparency` (group 1071),
  not group 440. Writing 440 to a layer record does nothing — see the comments
  in `bts:trans-pct` before changing that code.
