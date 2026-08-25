# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository.

## Repository Overview

**Repository**: jd432-cc/Claude
**Contents**: AutoLISP tooling for the BTS CAD layer standard.

| File | Role |
| --- | --- |
| `BTSStandards.lsp` | Release R v1.1. Holds the standards data tables (`*BTS-LAYERS*`, `*BTS-REMAP*`, `*BTS-SPLIT*`, `*BTS-VARS*`) and the core commands: BTSCHECK, BTSFIX, BTSREMAP, BTSVARS, BTSJUNK, BTSOVERRIDE, BTSREPORT, BTSHELP. |
| `BTS-Approver-Standards-D-RevA.lsp` | Approver Standards D Rev A. A companion module adding the auditing, remediation, reporting and project governance commands. Requires the register from release R, so load that file first. |

Load order matters: `(load "BTSStandards")` then `(load "BTS-Approver-Standards-D-RevA")`.
`BTSHELP` lists the release R commands, `BTSAHELP` the approver suite.

### Conventions in the LISP

- Target is **AutoCAD LT 2024+**: entity level AutoLISP only. No ActiveX, no `vla-*`, no ObjectDBX. Anything needing a second drawing open is done by generating a script for `SCRIPT`.
- Commands are `C:BTSNAME`, internal functions are `bts:name`.
- Every check returns a list of `"CODE     |item|detail"` strings, printed by `bts:show` and written out by `bts:report-writer`, `bts:csv-writer` and `bts:json-writer`.
- Site policy lives in the `*BTS-A-*` configuration tables at the top of the approver module — edit those, not the code.
- Comments explain *why* a piece of DXF handling is the way it is; keep that habit.

This CLAUDE.md should be updated as the project evolves to reflect the actual codebase structure, tooling, and conventions.

---

## Development Branch Convention

All AI-assisted development work must follow this branching strategy:

- Feature branches must be prefixed with `claude/`
- Branch names encode the session context (e.g., `claude/claude-md-mm8c1qfgeqghkbyp-UL14Z`)
- **Never** push directly to `main` or `master` without explicit user approval
- Always use `git push -u origin <branch-name>` when pushing

---

## Git Workflow

### Committing
- Write clear, descriptive commit messages in the imperative mood (e.g., "Add user auth module", not "Added...")
- Keep commits focused — one logical change per commit
- Never skip pre-commit hooks (`--no-verify`) unless explicitly instructed
- Never amend published commits; create new ones instead

### Pushing
- Use `git push -u origin <branch-name>`
- On network failures, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)

### Pull Requests
- Keep PR titles under 70 characters
- Include a Summary and Test Plan in the PR body

---

## General AI Assistant Guidelines

### Code Quality
- Prefer editing existing files over creating new ones
- Do not over-engineer: implement only what is requested
- Do not add unsolicited docstrings, comments, or type annotations
- Do not introduce backwards-compatibility shims for removed code
- Remove dead code completely rather than commenting it out

### Security
- Never introduce command injection, XSS, SQL injection, or other OWASP top-10 vulnerabilities
- Validate only at system boundaries (user input, external APIs)
- Never commit secrets, credentials, or `.env` files

### Risk Management
- Confirm before taking destructive or hard-to-reverse actions (force push, `rm -rf`, dropping databases)
- Confirm before actions that affect shared systems (pushing code, opening PRs, sending messages)
- Investigate unexpected state (unfamiliar files, branches) before deleting or overwriting

---

## Updating This File

As the project grows, update this file to document:

- **Project purpose and architecture** — what the project does and how it is structured
- **Tech stack** — languages, frameworks, major dependencies
- **Directory structure** — key directories and their roles
- **Setup instructions** — how to install dependencies and run the project locally
- **Testing** — how to run tests and what the coverage expectations are
- **Linting and formatting** — tools used and how to run them
- **Environment variables** — required env vars and where to find examples
- **Deployment** — how the project is built and deployed
- **Domain-specific conventions** — naming conventions, patterns, and anti-patterns specific to this codebase
