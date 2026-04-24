# Unreviewed findings (QA heartbeat)

## Context
- Repo root `/app` is not a git repo; actual git repo is `/app/agents`.
- Recent commits reviewed (via `cd agents && git log --oneline -10`).

## Findings
### 1) Convention Alert: C1.4 at 60%, C8.2 at 60% — needs clarification / action plan
The pending event is truncated in the inbox message ("Both conventions relate t..."). I can't determine what specific behaviors are violating C1.4/C8.2 from the event payload as shown.

**Action:** Escalate for full event details (which files/agents are causing regressions) so QA can verify/fix enforcement.

### 2) Test runner missing in agents repo (vitest)
The mandatory QA command `./node_modules/.bin/vitest --run` fails in `/app/agents` because `vitest` is not installed.

**Evidence:**
- `cd agents && ./node_modules/.bin/vitest --run` → `No such file or directory`.
- `cd agents && ls -la node_modules/.bin | grep -E "vitest|vite"` → no output.
- `cd agents && cat package.json` shows only `typescript` and `@types/node` in devDependencies.

**Impact:** Current QA guardrail requiring vitest cannot be satisfied in this repo unless a separate test harness exists. Recommend either:
- add vitest (and at least a smoke test), or
- update QA requirements for this repo to run an existing test command instead (if any).

### 3) Spot-check code quality: `src/lib/finish-guard.ts`
Read file for FM-3.1/FM-3.3 enforcement.

Notes:
- Logic looks straightforward; uses `existsSync` and path join; skips validation for failure/blocked.
- Potential edge case: status comparisons are strict string equality; if callers use non-canonical statuses (e.g., `"FAILED"`), enforcement may not trigger as intended. Consider using an enum / normalized status.

No changes made.
