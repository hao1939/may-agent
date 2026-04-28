# Unreviewed findings (QA heartbeat)

## Context
- Heartbeat date: 2026-04-28
- Repo checked: `/app/agents` (this is the only git repo present; `/app` is not a git repo).

## Pending events triage (inbox)
### P1: Duplicate “Quick Code Review” dispatches (5 copies)
**Action:** Escalate (process/dispatcher issue)
- Rationale: Clear waste; indicates missing dedup either at the dispatcher level or in inbox ingestion.
- Suggested fix: Add an idempotency key / request fingerprinting and collapse duplicates before dispatch.

### P2: Verify gym scenario EXP-220 (enoent-file-search) set up properly
**Action:** Escalate / needs clarification
- Evidence (this checkout): `grep -R "EXP-220" agents/gym/scenarios` returned no matches.
- Likely causes: scenario not present in repo, named differently than EXP-220, or alert refers to a different repo.
- Ask: provide the expected directory name/path for EXP-220.

### P1/P0: Coaching alerts (C8.2 no finish call, C1.4 last tool call violations)
**Action:** Act (self-process)
- Rationale: Repeated notifications indicate a consistent compliance problem.
- Mitigation this session: Ensure this heartbeat ends with a `finish()` tool call; avoid making claims without read/test evidence.

## Recent commits checked
From `cd /app/agents && git log --oneline -10`:
- `c24ab1e8e` EXP-257 completed: specificity gradient confirmed (L3>L2>L1=baseline)

## Mandatory checks (repo: /app/agents)
- `./node_modules/.bin/tsc --noEmit`: PASS (no output)
- `./node_modules/.bin/vitest --run`: FAIL to execute — `./node_modules/.bin/vitest` not found (exit code 127)

## File read (changed files in latest commit)
- `agents/bob/journal.md`: read first 200 lines; appears to be a journal log (no code).
- `agents/may/last-session.md`: read; appears to be an auto-generated session summary (no code).

## Issues
### IMPORTANT: QA standard expects `vitest --run` but agents repo has no vitest
Evidence:
- Running `./node_modules/.bin/vitest --run` fails with “No such file or directory”.
- `agents/package.json` devDependencies include only `typescript` and `@types/node` (no vitest).
Impact:
- QA cannot satisfy the mandatory test-run step for this repo; reviews must be CONDITIONAL on environment until tests/tooling exist.
Recommendation:
- Either add `vitest` (and at least smoke tests) to `agents/package.json`, or update QA runbook to treat “no tests by design” repos differently.

### MINOR: Auto-generated “last-session” content is not actionable
Evidence:
- `agents/bob/last-session.md` does not list which files were verified.
Recommendation:
- Include the actual file(s) verified and/or commit hash + checklist link in the auto-generated summary.
