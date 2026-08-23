# Load Budget &amp; Voltage Drop

A browser page that sizes conductors, fuses and the charging system for a race
car loom, and proves the numbers rather than asserting them. No server, no
upload, works offline once loaded.

Live at `/tools/load-budget/`. Sits beside the Loom Planner and reads its
output.

---

## Why it is built this way

**It starts from the Loom Planner, because the loom already exists.** The
planner knows the wire schedule — gauge, length, from and to. Re-typing it here
would be work, and worse, it would be a second copy to disagree with the first.
`Import from Loom Planner` is the primary entry path: a wire schedule row maps
straight to a circuit, and what is left to fill is the load current and the
duty cycle, which is exactly the information the planner has no field for and
this tool exists to apply.

**The round trip loses nothing.** This tool owns one field on a planner wire:
`gauge`. Every other field — `id`, `wireId`, `fromConnector`, `fromPin`,
`toConnector`, `toPin`, `colour`, `length`, `notes`, `routeNode`, `wireGroup` —
is carried through in `_loom` and written back verbatim, and so are the
planner's connectors, components, route nodes and groups. `Back to Loom
Planner` produces a file the planner opens with only the conductor sizes
changed. That is asserted against a committed fixture of the planner's real
export in `tools/test-load-budget.mjs`, field by field, not described and
hoped for.

**Everything is computed from something you can check.** Resistance from
resistivity, length and area. Drop from resistance and current. Ampacity from a
free-air rating and two derating factors, both shown. A number you cannot check
is a number nobody will argue with when it is wrong.

**The return path is reported separately.** Shared grounds are where looms
actually fail, and a single loop resistance hides them. Chassis return
resistance is not computed at all — a bolted, painted, corroded joint is a
measured property of that car, and the field says so.

**Seed data is labelled as seed data, in the tool.** `data/wire-spec.json`
carries a `source` on every conductor, every insulation and the ampacity table,
and the table itself opens with a warning in capitals. That warning is printed
in the sidebar where it cannot be missed, not filed in a README nobody opens.
The table is editable and exportable, because the number that matters is the
one on the datasheet for the wire actually on the reel.

**The fuse chart is the point.** It is the sheet that gets laminated and taped
inside the fusebox lid, and it is the one output of this tool that is read at
two in the morning with a torch. So it is Ink on Paper, large type, in
fuse-position order, and it prints from the page itself under a `@media print`
block rather than opening a generated document — the page takes
`default-src 'none'` and a print stylesheet needs no exemption.

**Nothing leaves the machine.** Autosave is `localStorage`; sharing is an
explicit file export. The page makes no offsite request at all.

---

## The model

`js/calc/electrical.js` is pure — no DOM, importable by Node. `js/calc/loom.js`
is the planner bridge and is equally pure. Every worked example in the build
brief is an assertion in `tools/test-load-budget.mjs`.

| | |
| --- | --- |
| Resistivity | `ρ(T) = ρ₂₀ × (1 + α(T − 20))`, ρ₂₀ = 1.724e-8 Ω·m, α = 0.00393 /°C |
| Resistance | `R = ρ(T) × L_loop / A`, `L_loop = 2L` dedicated, `L` + chassis mΩ otherwise |
| Drop | `ΔV = I × R`, evaluated at running and cranking volts |
| Ampacity | `I_allowed = I_base × k_temp × k_bundle` |
| `k_temp` | `√((T_rating − T_ambient) / (T_rating − 20))` |
| `k_bundle` | 1–2 → 1.00, 3–5 → 0.80, 6–15 → 0.70, 16+ → 0.50 |
| Fuse | `1.25 × load ≤ fuse ≤ I_allowed` (1.5× for inrush) |
| Charging | `Σ(load × duty)`, headroom, and time to flat |
| Mass | `csa × length × 8.96 g/m` plus an insulation allowance per class |

Conductor temperature is either measured or estimated from the loading ratio
against the derated rating, as a square law. Which of the two was used is
printed beside every drop computed from it — an estimated conductor temperature
is an assumption, and an assumption that is not visible is a defect.

Default limits: 3% general, 1% **and** 0.25 V absolute for a critical circuit,
10% cranking. All editable. A sensor reference gets the absolute limit as well
as the percentage because the drop appears directly as measurement error, and
250 mV of error on a 5 V reference is 5% of full scale wherever the supply
happens to be that lap.

---

## Two things added to the brief's data model

**`groundNode`.** The brief asks the tool to flag a ground path shared between
circuits of different classes, and the model it gives has `dedicatedReturn:
bool` but nothing to say *which* ground point a chassis return lands on. The
check is meaningless without it: every chassis return shares "the chassis". So
a circuit carries the stud it returns to, and the check is per node.

**`kind`.** The brief's `class` field is `continuous | intermittent | inrush`,
which is the question the fuse asks. The ground check asks a different question
— sensor, signal, logic, power, ignition, injector, motor, lighting, heater,
starter — and a circuit can be continuous and an injector at the same time. Two
fields, because they are two questions.

---

## Exports

- **`.trd.json` session** — everything, including the planner state it was
  imported from.
- **Circuit CSV** — the table exactly as it reads on screen, computed columns
  included, plus the budget figures underneath it.
- **Loom Planner JSON** — the round trip described above.
- **Printable fuse chart** — `Print fuse chart` hides the tool and prints the
  sheet.
- **The rating table** — export `wire-spec.json`, correct it against the
  datasheet, load it back.

---

## Running it

```
node tools/test-load-budget.mjs   # 86 assertions
node tools/build-web.mjs          # regenerate the scoped stylesheet
node tools/build-tools.mjs        # copy to public/tools/ for local preview
node dev-server.js                # http://localhost:8788/tools/load-budget/
```

---

## Not built yet

- **AC and switching behaviour.** Everything here is DC. An injector driver's
  switching current does things to a shared ground that a DC drop calculation
  does not see, and the ground check flags the topology rather than quantifying
  the noise.
- **The fuse time-current model is coarse.** `meltTime()` is a two-parameter
  approximation, enough to catch a motor that will blow its fuse on every start
  and not enough to certify one that will not. The datasheet curve is the
  authority and the tool says so where it uses the model.
- **Connector and splice resistance.** Not modelled. On a long loom with a
  dozen terminations it is not negligible, and it belongs in the planner's
  schedule rather than here.
- **Reading the Loom Planner's CAN bus module.** The planner has one; a load
  budget has nothing to say about it yet.
