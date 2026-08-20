# Standalone pages

Self-contained bundles that are **not** part of `build.ps1` or the `public/`
deploy directory. Each one carries its own runtime, fonts and assets inline and
is served on its own.

## TheRacingData_Coming_Soon.html

A Claude Design export, brand-aligned against the live site. Edits were made to
the `__bundler/template` payload inside the bundle rather than to unpacked
source, so the file stays standalone.

Changed from the raw export:

- removed the bundled "Industry" design system, which set a blue accent ramp
  (`--color-accent: #5980a6`) and every heading in Barlow Condensed — the `h1`
  was rendering in it
- restored the `box-sizing: border-box` reset that stylesheet had been supplying
- replaced the redrawn mark and typeset wordmark with the real `logo.svg`
  lockup, embedded as a data URI
- swapped the artboard's fixed `1033x498` main for the site's fluid
  `max-width: 1500px` hero container
- brought the display scale down to `clamp(44px, 8.8vw, 128px)`, since Archivo
  Black sets far wider than the Barlow Condensed the page was drawn against
- let the header wrap on narrow screens
- `contactus@theracingdata.com`, matching the site footer
- dropped 15 now-unreferenced Barlow woff2 files (530 KB -> 226 KB)

Verified in Chromium at 1920 / 1440 / 1024 / 768 / 390: mounts, Archivo
throughout, no clipping, no horizontal scroll, no console errors.
