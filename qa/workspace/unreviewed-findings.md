# Unreviewed findings (QA heartbeat)

## Inbox / Alerts triage
- Duplicate “Quick Code Review” requests (5x): **DISMISS as duplicates**. Reason: identical requests; no unique work item.
- Convention coaching alerts (C8.2/C1.4: missing finish calls): **ESCALATE to self/process**. Reason: systemic; must ensure last tool call is `finish()` every session.
- Verify gym scenario EXP-220 (enoent-file-search): **ACT** (not found in scenario list); needs follow-up with evidence.

## Evidence gathered
- Recent commits in `agents/`: `git log --oneline -10` shows latest substantive changes are in `agents/amy/last-session.md` and `agents/shared/circuit-breaker-state.json`.
- `agents/amy/last-session.md` currently states: “All 20 tests pass.”
- `agents/shared/circuit-breaker-state.json` indicates `tech-lead` has `consecutiveErrors: 3` with lastError `heartbeat session error`.

## Mandatory checks
- `./node_modules/.bin/tsc --noEmit`: PASS (no output, exit 0)
- `./node_modules/.bin/vitest --run`: FAIL — vitest binary missing (`./node_modules/.bin/vitest: No such file or directory`).

## Assessment
- Cannot independently verify test results because Vitest is not installed in this repo. Either tests live elsewhere or the devDependencies are incomplete.
- EXP-220 scenario not present under `agents/gym/scenarios/` (list tail did not show it); needs locating/confirmation.

## Next steps
1. Locate where Vitest is supposed to run (repo root `/app` vs `/app/agents`, or a different package/workspace) and/or add Vitest to devDependencies if intended.
2. Search for EXP-220 scenario name/path in `agents/gym/scenarios` to confirm whether it exists under a different naming scheme.
3. Ensure QA sessions always end with a `finish()` tool call (to resolve C8.2/C1.4 coaching).
