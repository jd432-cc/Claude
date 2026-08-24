# Security review — Website-Main and Website-ComingSoon

Date: 2026-08-24
Scope: `Website-Main.zip`, `Website-ComingSoon.zip` (static Cloudflare Pages/Workers sites)
Method: source review plus dynamic testing in headless Chromium against both sites served locally.

Every finding below was reproduced. Items marked **PoC** were demonstrated with working exploit code.

---

## Summary

| # | Severity | Finding | Main | Coming-Soon |
|---|----------|---------|------|-------------|
| 1 | High | Stored XSS in Loom Planner via imported project JSON (**PoC**) | Exploitable | Blocked by CSP |
| 2 | High | Every per-tool CSP rule is missing from `_headers` | Affected | — |
| 3 | Medium | Both `wrangler.jsonc` declare the same Worker name | Affected | Affected |
| 4 | Medium | No CSP on marketing pages; the stated reason does not hold up under test | Affected | Affected |
| 5 | Medium | Deployed `public/tools/` is stale — three shared modules missing, three tools broken | Affected | — |
| 6 | Low | Coming-soon bundle bypasses the SRI checks that protect the main site | — | Affected |
| 7 | Low | `dev-server.js` containment check is a string prefix match (**PoC**) | Affected | Affected |
| 8 | Low | `postMessage` listener has no origin check | Affected | Affected |
| 9 | Low | Template path resolver reaches prototype properties | Affected | Affected |
| 10 | Info | Transport and isolation headers not set | Affected | Affected |

---

## 1. Stored XSS in the Loom Planner — High (Main site)

`public/tools/loom-planner/` renders state through `innerHTML` with unescaped interpolation. `importJSON()` accepts a
project file with no schema validation — it checks only that one top-level key is an array — and hands it straight to
`setState()`:

```js
// js/wiring.js:624
const data = JSON.parse(content);
if (data.connectors && Array.isArray(data.connectors)) setState(data);
```

The state then reaches these sinks unescaped:

| File | Line | Sink |
|------|------|------|
| `js/wiring.js` | 871, 1027 | `style="background:${group.colour};…"` |
| `js/wiring.js` | 1191 | `style="…background:${wg.colour};…"` |
| `js/wiring.js` | 1224 | `style="border-left-color:${group.colour};"` |
| `js/canbus.js` | 534 | `<span class="${dirClass}">${msg.direction}</span>` |
| `js/canbus.js` | 577, 581 | `${sig.factor}`, `data-sig-edit="${sig.id}"` |
| `js/utils.js` | 84, 92, 116, 118, 321 | `value="${val}"`, `value="${displayText}"`, `<option value="${o.value}">${o.label}` |

The `escHtml()` helper used elsewhere is itself only correct for element-text context:

```js
// js/wiring.js:2161 and js/canbus.js:817
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;   // escapes < > & — but NOT " or '
}
```

It does not escape quotes, so it is unsafe inside a quoted attribute even where it is applied.

### Proof of concept

A crafted `wiring_loom.json` containing:

```json
"wireGroups": [{ "id": "wg1", "name": "Power",
                 "colour": "red\"><img src=x onerror=\"window.__XSS_WIREGROUP=true\">" }]
```

Driven through the real UI (click **Import JSON**, choose the file) in headless Chromium:

```
window.__XSS_WIREGROUP set : true
window.__XSS_CONNGROUP set : true
injected <img src=x> nodes : 3
XSS EXECUTED               : true
```

The CAN bus tab is equally affected via `#can-import`:

```
msg.direction sink fired : true
sig.id attribute sink    : true
```

### It persists

`js/app.js` autosaves state to `localStorage` on `beforeunload`. After a single import, the payload re-executes on
every subsequent visit with no further user action:

```
after import      : true
localStorage keys : [ 'wiring_planner_state', 'canbus_planner_state' ]
XSS re-fires on plain page load (no re-import): true
```

**Impact.** A wiring loom or CAN configuration is exactly the kind of file a team passes around. One opened file gives
an attacker persistent script execution on `theracingdata.com`, with access to everything else same-origin — including
the other tools' saved sessions.

### Fix

1. Escape for the context. Use an attribute-safe escaper (`" ' < > &`) for anything inside a quoted attribute, or set
   values with `setAttribute`/`textContent`/`el.style.x =` rather than string-building HTML.
2. Validate on import. Colours should match `/^#[0-9a-f]{3,8}$/i` or a known-name allowlist; numeric fields should go
   through `Number()`; ids should be regenerated locally rather than trusted from the file.
3. Ship the CSP (finding 2) — it contains the damage even if a sink is missed.

---

## 2. Every per-tool CSP rule is missing from Main's `_headers` — High

`Website-ComingSoon/public/_headers` carries hardened per-tool policies. `Website-Main/public/_headers` is byte-identical
up to line 27 and then simply stops — the entire tools section is gone:

```
$ diff Website-Main/public/_headers Website-ComingSoon/public/_headers
27a28,56
> /tools/report-builder/*
>   Content-Security-Policy: default-src 'none'; script-src 'self'; …
> /tools/loom-planner/*
>   Content-Security-Policy: default-src 'none'; script-src 'self'; …
> /tools/report-builder/templates/*
>   Cache-Control: public, max-age=31536000, immutable
```

This is what turns finding 1 from an injection bug into working code execution. Replaying the identical payload with the
coming-soon loom-planner policy applied:

```
injected <img src=x> nodes : 3   (HTML injection still happens)
XSS EXECUTED               : false
CSP violations logged      : 3
  e.g. Refused to execute inline event handler because it violates …
```

Same bug, same payload — the policy stops it dead.

### The other four tools have no policy on either site

`_headers` notes that a new tool "gets no CSP until it is added here; that fails open rather than shipping a blank page."
That trade-off costs nothing here. I loaded each unprotected tool under the strictest policy already in use — the
report-builder one — and all four render with **zero** CSP violations:

| Tool | DOM nodes | CSP violations |
|------|-----------|----------------|
| `/tools/run-plan/` | 82 | none |
| `/tools/fuel-stint/` | 488 | none |
| `/tools/event-pack/` | 150 | none |
| `/tools/load-budget/` | 168 | none |

### Fix

Restore the tools section in `Website-Main/public/_headers`, and extend it to the four remaining tools:

```
/tools/run-plan/*
/tools/fuel-stint/*
/tools/event-pack/*
/tools/load-budget/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'
```

Consider inverting the default: a broad `/tools/*` policy with named exceptions fails closed instead of open.

---

## 3. Both sites deploy to the same Worker name — Medium

```jsonc
// Website-Main/wrangler.jsonc AND Website-ComingSoon/wrangler.jsonc — identical
{ "name": "yellow-cake-de51", "compatibility_date": "2026-08-20", … }
```

Two separate sites, one deployment target. Whichever is published last silently replaces the other. Given that the
coming-soon site is the more hardened of the two and the main site is the one with the live tools, either direction is
a bad outcome — and there is no warning at deploy time. Give each project its own `name`.

---

## 4. No CSP on the marketing pages — Medium (both sites)

`_headers` documents this as deliberate:

> No Content-Security-Policy is set on purpose. […] A CSP without `'unsafe-eval'` renders a blank page.

I tested that claim against the actual pages. It does not hold:

| Test | Page | Result |
|------|------|--------|
| Baseline, no CSP | `/index.html` | renders — 286 nodes |
| Candidate CSP **with** `'unsafe-eval'` | `/index.html` | renders — 286 nodes, **0 violations** |
| Candidate CSP **without** `'unsafe-eval'` | `/index.html` | still renders — 271 nodes, degrades to "props only" |
| Candidate + `'unsafe-inline'` + `blob:` | `/tools/index.html` | renders — 196 nodes |
| Candidate CSP | `/404.html` | renders — 48 nodes |

The page never went blank. The inline `<script type="text/x-dc">` block is inert to the browser (unknown MIME type), so
it needs no `script-src` allowance at all; only `support.js`, `image-slot.js` and the unpkg bundles do.

A policy with `'unsafe-eval'` is weaker than one without, but far stronger than nothing — it still blocks injected
external script sources, `<object>`/`<embed>`, `<base>` hijacking and form exfiltration.

**Tested policy for `/index.html`, `/404.html` and the other design-export pages:**

```
default-src 'none'; script-src 'self' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://unpkg.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

`/tools/index.html` additionally needs `'unsafe-inline'` and `blob:` in `script-src`.

### Related: unpkg.com is a hard runtime dependency

`support.js` loads React, ReactDOM and Babel from `unpkg.com` at page load. During testing, with unpkg unreachable, the
marketing pages rendered **completely blank** — 0 nodes, 0 characters of body text. There is no fallback. The SRI hashes
are pinned and I verified all three against the live upstream files — they match exactly, so integrity is sound — but
availability rests entirely on a third-party CDN. Consider vendoring these three files, as the tools already do for
Archivo and docx-templates.

---

## 5. Main's deployed `public/tools/` is stale — three tools broken — Medium

`node tools/build-tools.mjs --check` on the main site:

```
  STALE   tools/_shared/report-engine/resolve.js
  STALE   tools/_shared/report-engine/store.js
  STALE   tools/_shared/report-engine/values.js
  STALE   tools/build-tools.mjs
  ORPHAN  tools/fuel-stint/README.md
  ORPHAN  tools/fuel-stint/js/state.js
  ORPHAN  tools/fuel-stint/js/ui.js
```

Three modules that `_shared/report-engine/docx.js` imports are absent from the deploy directory. Loading the affected
pages in a browser confirms real breakage:

| Page | HTTP failures | Rendered |
|------|---------------|----------|
| `/tools/report-builder/` | `404 /tools/_shared/report-engine/store.js` | broken |
| `/tools/run-plan/` | `404 store.js`, `404 resolve.js` | 38 nodes (82 on coming-soon) |
| `/tools/event-pack/` | `404 resolve.js`, `404 store.js` | 33 nodes (150 on coming-soon) |

The coming-soon deploy directory is out of sync in the other direction (10 stale, 10 orphaned files).

Two things follow. First, run `node tools/build-tools.mjs` before packaging, and wire `--check` into CI so a stale deploy
directory fails the build. Second, note that `_tools/build-tools.mjs` sits inside the source tree that gets copied
verbatim to `public/tools/` — once the build runs, the build script itself is published at
`/tools/build-tools.mjs`. Move it to `tools/` (where a copy already lives) so it is not part of the deploy payload.

---

## 6. The coming-soon bundle bypasses SRI — Low

`support.js` protects its CDN loads with subresource integrity, but the check is skipped whenever a resource override
is present:

```js
// public/support.js:1149
function cdnScriptFor(url, sri) {
  const res = window.__resources;
  const v = res ? res[url] : void 0;
  return typeof v === "string" && v ? { src: v } : { src: url, integrity: sri };
  //                                  ^ no integrity on this branch
}
```

The coming-soon `index.html` is a self-extracting bundle that decodes React and ReactDOM from embedded base64, turns
them into blob URLs, and injects exactly that map:

```html
<script type="__bundler/ext_resources">
[{"id":"https://unpkg.com/react@18.3.1/umd/react.production.min.js","uuid":"38ef6850-…"}, …]
```

The blobs are same-origin and delivered over TLS, so the practical risk is low — but the bundled bytes are executed with
no verification of any kind, and the SRI hashes that protect the main site do not apply here. If the bundling step is
ever compromised, nothing catches it. Verify bundled bytes against the pinned hashes before creating the blob URL.

---

## 7. `dev-server.js` containment check is a prefix match — Low (**PoC**)

```js
const ROOT = path.join(__dirname, 'public');
let file = path.join(ROOT, rel);
if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
```

`path.join` normalises `..`, so classic traversal is blocked. But `startsWith(ROOT)` also accepts any **sibling
directory whose name begins with `public`** — `public.bak`, `public-secret`, `public_old`:

```
$ curl 'http://localhost:8788/..%2fpublic-secret/leak.txt'
SECRET-OUTSIDE-ROOT

$ curl -o /dev/null -w '%{http_code}\n' 'http://localhost:8788/..%2f..%2fetc%2fpasswd'
403
```

Local preview tooling only, bound to `localhost:8788` — but `public.bak/` is precisely the sort of directory that
accumulates next to a deploy folder. Fix:

```js
const rp = path.relative(ROOT, file);
if (rp.startsWith('..') || path.isAbsolute(rp)) { res.writeHead(403).end('forbidden'); return; }
```

---

## 8. `postMessage` listener has no origin check — Low

`public/support.js:1407` accepts messages from any origin:

```js
window.addEventListener("message", (e) => {
  const type = e.data && e.data.type;
  if (type === "__dc_theme") { … }
  if (!designDocMode || type !== "__dc_probe") return;
  postDesignMode(designDocMode);
});
```

Reachable impact is small — the theme value is validated against `"light"`/`"dark"`, and `X-Frame-Options: DENY` stops
the site being framed. Still, check `e.origin` against an allowlist, and replace the `"*"` targets on the two outbound
`postMessage` calls (lines 1387, 1858) with a concrete origin.

---

## 9. Template path resolver reaches prototype properties — Low

`_shared/report-engine/resolve.js` is a genuinely good piece of design: it replaces docx-templates' JavaScript
evaluation with a strict grammar, so a template can never execute code and the page needs no `'unsafe-eval'`. One gap —
`lookup()` walks any dotted path, and `__proto__`, `constructor` and `prototype` all match the identifier pattern:

```js
const PATH = /^\$?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;
```

A template containing `{constructor.constructor}` resolves to the `Function` constructor. The result is only stringified
into the document, so this is an information-disclosure edge rather than code execution — but reject those three segment
names explicitly, and prefer `Object.hasOwn(value, key)` in the walk.

---

## 10. Transport and isolation headers — Info

Currently set on `/*`, on both sites: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`. Worth adding:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Confirm whether HSTS is already applied at the Cloudflare zone level before adding it here. `Permissions-Policy` could
also deny `payment=()`, `usb=()`, `serial=()`.

---

## What is already right

Worth recording, because several of these are things sites of this kind usually get wrong:

- **No secrets anywhere.** Scans for AWS keys, GitHub tokens, Slack tokens, PEM blocks, and credential-shaped
  assignments came back clean across both trees. No `.env`, no lockfiles, no npm dependency surface.
- **SRI hashes are correct.** All three pinned `sha384` values match the live upstream files byte for byte.
- **The docx resolver is a real mitigation** (finding 9 notwithstanding). `noSandbox` is not enabled, and the custom
  `runJs` avoids both the iframe and `new Function()` paths in docx-templates.
- **The `.docx` templates are clean** — no `vbaProject.bin`, no OLE objects, no `TargetMode="External"` references
  across all 20 templates.
- **No active content in any SVG** — no `<script>`, no event handlers, no remote `xlink:href`.
- **The other four tools have no HTML-injection sinks at all.** `run-plan`, `event-pack`, `fuel-stint` and `load-budget`
  contain zero uses of `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or `new Function`. Loom Planner is
  the outlier, not the pattern.
- **Build and dev scripts are clean** — no `Invoke-Expression`, no `shell=True`, no `pickle.load`, no `yaml.load`.
- **Link hygiene is clean** — no `target="_blank"` without `rel="noopener"`, no `http://` subresources, no external
  form actions, no open-redirect patterns.
- **Tool data stays local.** The tools persist to `localStorage` and export to file; nothing is transmitted.

---

## Recommended order

1. Restore and extend the tool CSP rules in `Website-Main/public/_headers` (finding 2) — one file, biggest effect.
2. Fix the Loom Planner escaping and add import validation (finding 1).
3. Give the two projects distinct Worker names (finding 3).
4. Re-run `build-tools.mjs` and add `--check` to CI (finding 5).
5. Add the tested marketing-page CSP (finding 4).
6. Findings 6–10 as maintenance.
