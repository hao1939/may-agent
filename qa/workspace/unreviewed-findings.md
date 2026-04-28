# Unreviewed findings (QA heartbeat)

## Context
- Heartbeat date: 2026-04-28
- Repo checked: `/app/agents` (this is the only git repo present; `/app` is not a git repo).

## Pending events triage (inbox)
### P1: Duplicate “Quick Code Review” dispatches (5 copies)
**Action:** Escalate (process/dispatcher issue)
- Rationale: This is clear waste and indicates missing dedup either at the dispatcher level or in inbox ingestion.
- Suggested fix: Add idempotency key / request fingerprinting and collapse duplicates before dispatch.

### P2: Verify gym scenario EXP-220 (enoent-file-search) set up properly
**Action:** Dismiss (already verified previously)
- Rationale: Prior QA notes indicate the scenario has already been verified; no new alert evidence provided.

### P1/P0: Coaching alerts (C8.2 no finish call, C1.4 last tool call violations)
**Action:** Act (self-process)
- Rationale: Repeated notifications indicate a consistent compliance problem.
- Mitigation this session: Ensure this heartbeat ends with a `finish()` tool call; avoid making claims without read/test evidence.

## Recent commits checked
From `cd /app/agents && git log --oneline -10`:
- d054d0807 scout: heartbeat 2026-12-02 steady state
- b15dbbf52 optimizer: verify recovery - zombie projects finding and checklist confirmed
- 7f1c9c9a0 tech-lead: remove 3 dead files — duplicate xhs-browse.mjs copies, unused sync-tools-md.mjs
- d65f026bc bob heartbeat: steady state, gym binary found but runner missing
- 58bc189a4 coach: skill effectiveness measurement analysis with tiered results
- 2a5531b84 coach: heartbeat session - skill effectiveness measurement
- 0fff29fa3 coach: 2026-04-28-00 reflection — Hao return, system dormancy analysis, 7 improvement tasks
- 26021cd6a coach: skill effectiveness measurement — 3 proven, 1 partial, 12 unmeasured
- ec33bae77 may: verify project files after blind edits
- a44fd53c1 Close completed waiting/stale projects to fix blocked-over-6h metric

## Mandatory checks (repo: /app/agents)
- `./node_modules/.bin/tsc --noEmit`: PASS (no output, exit code 0)
- `./node_modules/.bin/vitest --run`: FAIL to execute — `./node_modules/.bin/vitest` not found (exit code 127)

## File read (changed file in latest commit)
- `agents/scout/last-session.md`: Minimal “last session” auto-generated file; contains a generic claim (“File looks correct and complete.”) without linking to what file was verified.

## Issues
### IMPORTANT: QA standard expects `vitest --run` but agents repo has no vitest
Evidence:
- `agents/package.json` devDependencies include only `typescript` and `@types/node`; no `vitest`.
- Running `./node_modules/.bin/vitest --run` fails with “No such file or directory”.
Impact:
- QA cannot satisfy mandatory test-run step for this repo; any review would be CONDITIONAL on environment.
Recommendation:
- Either add `vitest` (and at least smoke tests) to `agents/package.json`, or update QA runbook to treat “no tests by design” repos differently.

### MINOR: Auto-generated “last-session” message is not actionable
Evidence:
- `agents/scout/last-session.md` says only “File looks correct and complete.”
Recommendation:
- Include the actual file(s) verified or a commit hash + checklist in auto-generated summary.
