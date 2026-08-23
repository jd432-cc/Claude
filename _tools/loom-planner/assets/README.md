# Brand assets

These files are referenced by the app but are **not** committed here. Drop them
in from the TheRacingData brand repository. Nothing has been redrawn or
approximated — the mark's geometry is load-bearing and must come from source.

## Required

| File | Referenced by | Notes |
| --- | --- | --- |
| `logo.svg` | `index.html` header lockup | Mark + wordmark, no tagline, dark ground. Rendered at 168px wide (minimum is 140px). |
| `favicon.svg` | `index.html` `<link rel="icon">` | Solid `#970000` field, trace knocked out in Paper. |
| `fonts/Archivo-Variable.woff2` | `css/styles.css` `@font-face` | Variable weight axis 100–900. SIL Open Font Licence. |

## Behaviour when absent

- **`logo.svg` missing** — the header falls back to a small caption reading
  "TheRacingData" set in the *eyebrow* role with a Signal Red rule. This is
  deliberately not a substitute wordmark: the real wordmark is drawn geometry,
  not type, and must never be re-set in Archivo.
- **`favicon.svg` missing** — harmless 404, default document icon.
- **Font missing** — falls back to the Google Fonts CDN link in `index.html`,
  then to Arial / Arial Black. Metrically close enough that the layout holds,
  but the packaged Electron build has no network, so ship the woff2.

## Logo rules that this layout already honours

- Clear space on all sides: one cap-height of the wordmark.
- Minimum width 140px on screen. Below that, drop the tagline.
- Below ~32px, use the icon rather than a lockup.
- The minimum-speed node is a real transparent hole — never fill it to "fix" it
  against a new background.
- Do not recolour, restretch, or add effects to the lockup.
