# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Context
No pending events/alerts. Per proactive protocol, I checked recent commits in the `agents/` repo and attempted the standard verification commands.

## Recent commits (top)
- `63c24830c` EXP-213: schema-organize bob's context.md (replicating EXP-212 from tech-lead)
  - Files changed: `bob/context.md`, multiple `*/last-session.md`, and `shared/knowledge/experiments/EXP-213/design.md` (per `git show --name-only`)

## Verification results (environment)
### tsc --noEmit
**FAIL (cannot run)** — `./node_modules/.bin/tsc` is missing.
- Evidence: `bash` showed `./node_modules/.bin/tsc: No such file or directory`.
- Further evidence: `package.json` declares `typescript` in `devDependencies`, but `npm ls --depth=0` shows only `puppeteer-core@24.42.0` installed.

### vitest --run
**FAIL (cannot run)** — `vitest` is not installed.
- Evidence: `npm ls vitest --depth=0` shows `(empty)`.

## File spot-check (changed file)
Read `agents/bob/context.md` (first ~120 lines). It appears to be a schema/structure re-org with policy reminders; no obvious syntax issues spotted in the portion read.

## Issues
### IMPORTANT — Repo/tooling inconsistency
The repo contains `package-lock.json` and `node_modules/`, but `typescript` and `vitest` are not available, preventing mandatory QA verification commands from running.

## Suggested next actions
1. Confirm whether CI/runner intentionally omits dev dependencies; if not, run `npm ci` (or equivalent) in `agents/` to restore `typescript` and add `vitest` if tests are expected.
2. If this is intentional, update QA SOP to use `bun x tsc` / a pinned toolchain, or remove/replace the mandatory steps for this repo.
