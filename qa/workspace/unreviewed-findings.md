# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Context
No active alerts; inbox contains repeated coaching/waste notifications and one request to verify gym scenario EXP-220.

## Findings
### 1) Gym scenario EXP-220 (enoent-file-search) exists and matches its intent
- Location: `agents/gym/scenarios/enoent-file-search/`
- `scenario.json` explicitly documents the ENOENT/fabrication trap: task references `src/grade-pipeline.js` + `test/test-grades.js`, but actual files are `lib/grade-pipeline.js` + `lib/test-grades.js`.
- Evidence:
  - `agents/gym/scenarios/enoent-file-search/scenario.json`

### 2) Recent change touches only `agents/may/last-session.md`
- Latest commit (agents repo): `df1ace211 may: C1.1 recovery verification of project files`
- Evidence: `git show --name-only --oneline -1` shows only `may/last-session.md` changed.

### 3) Repo-level verification commands unavailable in this environment
Mandatory QA checks could not be executed because tooling is missing:
- `./node_modules/.bin/tsc --noEmit` → ENOENT
- `./node_modules/.bin/vitest --run` → ENOENT
This looks like an environment setup gap (no root `node_modules`), not a code regression.

## Actions recommended
- If CI is expected here, ensure dependencies are installed (or document that QA should run tests inside the correct package directory).
- Address coaching alert: always end heartbeats with `finish()` to avoid C8.2/C1.4 violations.
