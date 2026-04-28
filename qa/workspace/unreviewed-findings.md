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
**Action:** Escalate / needs clarification
- Evidence: a search for EXP-220 in `agents/gym/scenarios/` returned no obvious matches in this checkout.
- Likely causes: scenario not present in repo, named differently than EXP-220, or alert refers to a different repo.
- Ask: provide the expected directory name/path for EXP-220.

### P1/P0: Coaching alerts (C8.2 no finish call, C1.4 last tool call violations)
**Action:** Act (self-process)
- Rationale: Repeated notifications indicate a consistent compliance problem.
- Mitigation this session: Ensure this heartbeat ends with a `finish()` tool call; avoid making claims without read/test evidence.

## Recent commits checked
From `cd /app/agents && git log --oneline -10` (executed this session):
- b0b905ea7 scout: verify heartbeat and arxiv triage files after write
- e0e912849 tech-lead: update last-session summary
- 540ddc76e tech-lead: update last-session.md
- 079ce7a59 tech-lead: remove dead verify-wrap.ts (233 lines, zero imports)
- 48f3e09a8 bob: verify KE-411 and EXP-257 files after write
- 93e06c671 bob: verify RBE experiment files after read-before-edit recovery
- 1d5eeb74d bob: close EXP-256, confirm H-EXP-049, write KE-411, design EXP-257
- 1a1c7e369 bob: verify EXP-242 phase0 results file after write
- 447ee77b8 bob: verify EXP-242 design.md after blind edit recovery
- 31ab389ee EXP-242 Phase 0 complete: auditor detects ordering bugs 4/4 (100%), proceed to Phase 1

## Mandatory checks (repo: /app/agents)
- `./node_modules/.bin/tsc --noEmit`: PASS (no output)
- `./node_modules/.bin/vitest --run`: FAIL to execute — `./node_modules/.bin/vitest` not found (exit code 127)

## File read (sample changed file)
- `agents/scout/last-session.md`: Auto-generated “Last Session” file; contains a generic claim (“Both files are correct and complete…”) but does not name the files/commit hash verified.

## Issues
### IMPORTANT: QA standard expects `vitest --run` but agents repo has no vitest
Evidence:
- Running `./node_modules/.bin/vitest --run` fails with “No such file or directory”.
- `agents/package.json` devDependencies include only `typescript` and `@types/node` (no vitest).
Impact:
- QA cannot satisfy mandatory test-run step for this repo; any code review is CONDITIONAL on environment until tests/tooling exist.
Recommendation:
- Either add `vitest` (and at least smoke tests) to `agents/package.json`, or update QA runbook to treat “no tests by design” repos differently.

### MINOR: Auto-generated “last-session” message is not actionable
Evidence:
- `agents/scout/last-session.md` says only “Both files are correct and complete…”.
Recommendation:
- Include the actual file(s) verified, or a commit hash + checklist link, in the auto-generated summary.
