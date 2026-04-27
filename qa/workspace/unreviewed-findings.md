# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Context: current /app workspace appears not to be a git repo
- `git log` / `git status` fail with: `fatal: not a git repository (or any of the parent directories): .git`.
- This prevents commit/diff-based review in this environment.

## Review performed this heartbeat: DB SSL env var change (evidence-based)
Files read:
- `fix-summary.md`
- `agents/environment/env-vars.conf`

Observed change:
- `agents/environment/env-vars.conf` sets:
  - `DATABASE_URL=postgres://prod-user:s3cure-p4ss@prod-db-cluster.internal:5432/webapp_prod?sslmode=require`

### Issues found
**IMPORTANT — Secret exposure risk**
- `agents/environment/env-vars.conf` contains what appears to be production credentials in plaintext (`prod-user` / `s3cure-p4ss`). Even if placeholders, this is risky and commonly policy-violating.

**IMPORTANT — Potential config mismatch risk**
- Adding `sslmode=require` only helps if the deployed client library honors `sslmode` in the URL (libpq-style). If the runtime uses a different SSL configuration mechanism (common in some Node clients), this may not have the intended effect.

## Mandatory QA SOP tooling checks
- `./node_modules/.bin/tsc --noEmit`: **FAIL** — `./node_modules/.bin/tsc` not found (exit 127).
- `./node_modules/.bin/vitest --run`: **FAIL** — `./node_modules/.bin/vitest` not found (exit 127).

Notes:
- `package.json` in this environment describes a minimal Node project (script `test: node test.js`) and has no devDependencies, so the SOP commands appear inapplicable here without adding tooling.
- I did run `npm test`: 6/6 tests passed.
