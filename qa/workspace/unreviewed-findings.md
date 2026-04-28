# Unreviewed findings (QA heartbeat)

## Context
- Heartbeat date: 2026-04-28
- Repo checked: `/app/agents` (this is the only git repo present; `/app` is not a git repo).

## Recent commits (last 10)
- 237d42a97 scout: verify written files after triage session
- e448bb9ca optimizer: verify post-write files for request-dedup project
- 2d5c4d48d optimizer: close request-dedup M2/M3 — M1 dedup covers all milestones
- bec87e49e bob: verify RBE recovery files EXP-255 and H-EXP-046
- 93190f3a2 tech-lead: heartbeat 2026-12-01 — system healthy, build clean, inbox triaged
- a6b1de8f9 tech-lead: heartbeat 2026-12-01 — all green, inbox triaged
- 7eeb07351 coach: skill quality audit with gym evidence tiers
- 22b30cc80 coach: skill quality audit — 153 skills, only 8 have A/B evidence
- 4b37ce889 qa: heartbeat triage + verify enoent-file-search scenario
- 232b9b18b scout: heartbeat 2026-11-30 steady state

## Review performed
- Read file: `agents/scout/last-session.md` (commit 237d42a97). Content is minimal and consistent with commit message.

## Tooling checks
- `tsc --noEmit`: PASS (in `/app/agents`)
- `vitest --run`: FAIL to execute — `./node_modules/.bin/vitest` missing because `vitest` is not listed in `agents/package.json` and no binary exists in `agents/node_modules/.bin/`.

## Findings
### IMPORTANT: Missing test runner in agents repo
The QA standard requires running `./node_modules/.bin/vitest --run`, but `vitest` is not installed in the `agents` repo (no dependency and no binary). Either:
1) add `vitest` as a devDependency (and add at least a minimal test suite), or
2) update QA/runbook expectations for repos that intentionally have no tests.

### IMPORTANT: Process waste / duplicate review dispatches
Inbox shows multiple duplicate "Quick Code Review" requests; suggest upstream dedup at dispatcher or a guard to collapse duplicates.

### IMPORTANT: Coaching alerts (C8.2 + C1.4)
Multiple notifications indicate frequent missing `finish()` calls and last-tool-call violations. Recommend adding a lightweight checklist reminder at the start of QA heartbeat sessions and/or enforcing finish-call via guard.
