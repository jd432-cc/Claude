# TheRacingData — Cloudflare static site

Static site built from the Claude Design export. No framework, no npm install,
no build step on Cloudflare's side — `public/` is uploaded as-is.

```
_source/      the design export (re-drop a new export here)
data/         stats.json — the four hero figures, read at build time
static/       files copied verbatim into the build (_headers, favicon)
public/       ← THE DEPLOY DIRECTORY. Generated. Do not edit by hand.
build.ps1     regenerates public/ from _source/ + static/ + data/
dev-server.js local preview that mimics Pages routing
```

## The stats band

The four figures under the hero come from `data/stats.json`. `build.ps1` renders
them into `Homepage.dc.html` between the `<!--stats:start-->` and
`<!--stats:end-->` markers, so `public/index.html` always ships finished numbers
— no client-side fetch, nothing for search engines to miss.

`"compute": "seasonsOperating"` derives its value from `season.firstYear` and
`season.opensOn` (MM-DD). It counts inclusively and only ticks over on the
opening date, not on 1 January, so the site never claims a season that has not
started. Edit the JSON and re-run `.\build.ps1`.

**If you re-export from Claude Design**, the two marker comments and the `.stat`
rules in `<helmet><style>` are hand edits in `_source/Homepage.dc.html` and will
be lost. The build fails loudly if the markers are missing.

Rebuild after any change:

```powershell
.\build.ps1
```

## The 404 page

`_source/NotFound.dc.html` builds to `public/404.html`.

**Shipping the file is not enough on this deployment.** The site runs as a Worker
with static assets (see Deploy below), and Workers requires the 404 behaviour to
be declared — `"not_found_handling": "404-page"` in `wrangler.jsonc`. With it
unset, `/404` is reachable as an ordinary page but a genuine miss returns a bare
404 with an empty body. Cloudflare made this explicit deliberately: Pages used to
infer it from the presence of a `404.html`, and Workers does not guess.

Two things about this page differ from the other two, and both matter:

- **Asset paths must be root-relative.** The page is served at whatever URL the
  visitor got wrong, so `<script src="./support.js">` would resolve against that
  path — `/no/such/page` fetches `/no/such/support.js` and 404s. The runtime then
  never loads, `<x-dc>` is never consumed, and the SVG keeps its unprocessed
  `sc-camel-view-box` attribute instead of a real `viewBox`. It is `/support.js`
  for that reason. **A re-export will reintroduce the relative form.**
- **No `image-slot.js`.** The page has no `<image-slot>` elements, so it does not
  load that script and does not produce the `.image-slots.state.json` 404 the
  other two pages do.

The page is English-only. `setLang` is per-page in-memory state with no
persistence, so language never survives a navigation anywhere on this site; the
404 is consistent with that rather than a regression. Add `data-fr` / `data-es`
attributes if that changes.


## Deploy

The live site is a **Worker with static assets** named `yellow-cake-de51`, with
`theracingdata.com` attached to it as a custom domain. It is not a Pages project,
despite the Pages-era instructions this README used to carry — a dashboard asset
upload creates a Worker now.

**Option A — Wrangler CLI (preferred, and the only way to set `not_found_handling`).**

```powershell
npx wrangler deploy
```

Config lives in `wrangler.jsonc`. Keep `name` as `yellow-cake-de51`: deploying
under a different name creates a second Worker and leaves the custom domain
pointing at the old one. The first `wrangler deploy` over a Worker that was
created in the dashboard will warn that it is dashboard-managed and ask you to
confirm taking it over.

**Option B — dashboard upload.** Drag the **`public`** folder. This still works,
but it will not set `not_found_handling`, so the 404 page stays inert.

**Option C — Git integration.** Push this folder to a repo and connect it, with:

| Setting                | Value    |
| ---------------------- | -------- |
| Framework preset       | None     |
| Build command          | *(empty)* |
| Build output directory | `public` |

Note that Git deploys will **not** run `build.ps1` (Cloudflare's build image is
Linux and has no PowerShell by default). Run it locally and commit `public/`.

## Before you go live

1. **Set the real domain.** `$origin` at the top of `build.ps1` is
   `https://example.pages.dev`. It only affects the `og:url` social-preview tag,
   so the site works without it, but link previews will point at the wrong host.
2. **The images are all empty.** See below.

## The images

Every `<image-slot>` in the design is an **unfilled placeholder** — 11 on the
homepage, 3 on Services. They render as an outlined box with the caption text
("Hero — rally car mid-corner, gravel, low sun") and nothing else.

This is not a packaging bug. The slots were never filled in the design, and
`image-slot.js` is only interactive inside the Claude Design editor — the
comment in the file is explicit: *"Outside the omelette runtime the slot is
read-only."* Drag-and-drop will not work on the deployed site.

To ship real images, replace each `<image-slot ...></image-slot>` with a plain
`<img>` in the `_source/` HTML, e.g.:

```html
<img src="/img/hero.jpg" alt="Rally car mid-corner on a gravel stage"
     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
```

Put the files in `static/img/` and extend `build.ps1` to copy that directory.
Once no `<image-slot>` elements remain, the `image-slot.js` script tag can go too.

Expect one **404 for `.image-slots.state.json`** in devtools on every page load.
It is harmless — `image-slot.js` fetches that sidecar and handles a miss
(`r.ok ? r.json() : null`). It cannot be fixed by shipping the file, because
Cloudflare Pages does not upload dot-prefixed files. The 404 disappears when the
image slots are replaced with real `<img>` tags.

## Runtime dependency on unpkg.com

`support.js` loads React and ReactDOM 18.3.1 from `unpkg.com` at page load
(with SRI hashes). **If unpkg is unreachable, the page renders blank.** That is
a real availability risk for a production site on a third-party CDN.

Self-hosting is possible: `support.js` checks a `window.__resources` map for URL
overrides before falling back to unpkg. Setting it was tested and the page
renders and behaves identically — but note that setting `window.__resources`
*also* disables a defensive re-fetch the runtime performs to recover the raw
template (the HTML parser lowercases `onClick` to `onclick`; the re-fetch
restores it). That re-fetch turned out to be unnecessary here — the runtime
matches attributes case-insensitively and the buttons work either way — but it
is the reason self-hosting is not enabled by default.

Babel is *not* a concern: `support.js` references `@babel/standalone` (~3 MB)
but only loads it for `x-import` JSX modules. Neither page uses `x-import`, so
Babel is never fetched. Verified: `window.Babel` is `undefined` after load.

## What the build changes vs. the raw export

The export is a design artifact, not a website. `build.ps1` adds what a public
site needs, so re-exporting from Claude Design never loses these:

- `Homepage.dc.html` → `index.html`, `Services.dc.html` → `services.html`
- cross-page links `href="Services.dc.html"` → `href="/services"`
- `<title>` and `<meta name="description">` — the export has neither
- Open Graph / Twitter card tags
- `lang="en"` on `<html>` — the export emits a bare `<html>`
- favicon link
- UTF-8 written **without BOM** (a BOM before `<!DOCTYPE>` triggers quirks mode,
  and the pages carry accented FR/ES copy)

## Local preview

```powershell
node dev-server.js    # http://localhost:8788
```

Mimics Pages' extensionless routing (`/services` → `services.html`). It does
**not** apply `_headers`. For a faithful check including headers and redirects:

```powershell
npx wrangler dev
```

## Verified

Checked in a real browser against the built `public/`:

- both pages mount (`x-dc` template consumed, `#dc-root` present, 287 elements)
- EN / FR / ES switching works on both pages; accents render correctly
- newsletter form validates and clears (invalid + valid paths)
- both SVG charts draw (dyno curve, telemetry overlay)
- the results table renders all 5 rows
- `/`, `/services`, `/services.html`, `/support.js`, `/image-slot.js`,
  `/favicon.svg` all 200; unknown paths 404
- the 404 page mounts at both `/missing` and `/no/such/deep/path` (`#dc-root`
  present, `<x-dc>` consumed, `viewBox="0 0 480 200"` resolved from
  `sc-camel-view-box`, logo loads, every link resolves)
- no `.dc.html` links remain in the output
- no console errors
