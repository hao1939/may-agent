# Unreviewed Findings (QA heartbeat)

Date: 2026-04-25

## Inbox triage
- Duplicate “Quick Code Review” notifications (5x): **DISMISS** — deduplicated waste alert; no unique action items.
- EXP-220 (enoent-file-search) verification request: **ACT** — verified scenario presence in `agents/gym/scenarios/` directory listing; did not yet read scenario contents.

## Verification checks (agents repo)
- `tsc --noEmit`: **PASS** (ran in `/app/agents`, no output, exit code 0).
- `vitest --run`: **ENV FAIL** — `./node_modules/.bin/vitest: No such file or directory`.
  - Evidence: `agents/package.json` has no `vitest` dependency; `node_modules/.bin` lacks vitest.

## Spot-check: recent change
- Read `agents/src/lib/finish-guard.ts` (new guard file).
  - Implements deliverable existence checks (FM-3.1) and verification evidence presence/quality checks (FM-3.3).
  - Potential gap: evidence quality warnings are **non-blocking** even if ghost keywords appear; this may be intended but should be confirmed against spec.

## Next actions
- For EXP-220: read scenario files and confirm required structure and path references.
- Consider adding a minimal test runner or documenting that vitest is not part of the agents repo; current QA protocol expects it.
