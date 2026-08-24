# Evidence — 2026-08-24 security review

Reproduction scripts for the findings in `../2026-08-24-website-security-review.md`.

## Prerequisites

- Node 22+ and Playwright with a Chromium build. The scripts resolve Chromium from
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; change `executablePath` to match your install.
- The site under test served locally. From `Website-Main/`: `node dev-server.js` (serves `public/` on
  `localhost:8788`). For the coming-soon site, copy `dev-server.js` and change `PORT` to `8790`.

## Scripts

| File | Proves | Serves |
|------|--------|--------|
| `poc-import-xss.mjs` | Finding 1 — stored XSS via the Loom Planner's wiring Import JSON button | main, `:8788` |
| `poc-canbus-xss.mjs` | Finding 1 — the same class of bug on the CAN bus tab | main, `:8788` |
| `poc-csp-mitigation.mjs` | Finding 2 — the same payload is blocked once the coming-soon CSP is applied; also shows the broken report-builder from finding 5 | main, `:8788` |
| `csp-candidate-test.mjs` | Finding 4 — the candidate marketing-page CSP renders every page. Needs `cdn/react.js`, `cdn/react-dom.js`, `cdn/babel.js` fetched from unpkg alongside it | main, `:8788` |
| `csp-tool-coverage-test.mjs` | Finding 2 — all four unprotected tools render under the strictest tool CSP with zero violations | coming-soon, `:8790` |

## Payloads

`loom-planner-wiring-xss.json` and `loom-planner-canbus-xss.json` are crafted project files. They set
`window.__XSS_*` flags rather than doing anything harmful, so a run either reports `true` or it does not.
