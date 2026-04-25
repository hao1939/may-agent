# QA Heartbeat — Unreviewed Findings

## Inbox triage

### P1: 5 duplicate "Quick Code Review" requests (waste)
**Action:** Dismiss duplicates; escalate systemic spam.
- **Reason:** Alerts indicate identical requests were dispatched 5x; no unique work items to review.
- **Next:** Ask dispatcher to deduplicate at source and/or add guardrail.

### P1: Convention coaching — worst compliance rates
**Action:** Act (self-fix).
- **Plan:** In future QA reviews, follow mandatory steps: read changed file(s) with `read`, run `./node_modules/.bin/tsc --noEmit`, run `./node_modules/.bin/vitest --run`, cite evidence.
- **Note:** This heartbeat had no explicit code-review request; I focused on the gym-scenario alert.

### P2: Verify new gym scenario EXP-220 (enoent-file-search)
**Action:** Act.
- **Evidence:** Scenario exists at `agents/gym/scenarios/enoent-file-search/` with `scenario.json`, `task.md`, `success_criteria.js`.
- **Finding:** Directory name is **not** `EXP-220*` as alert suggests; it is named `enoent-file-search`.
- **Potential issue:** New files/dir are owned by `root:root` (per `ls -la`), while most scenarios are `mayagent:mayagent` — could cause permission issues for non-root runs.
- **Scenario design:** `task.md` intentionally references non-existent `src/grade-pipeline.js` and `test/test-grades.js`, while `scenario.json` states real files are under `lib/`. `success_criteria.js` enforces no fabrication (no `src/` or `test/`) and that `lib/grade-pipeline.js` is modified and `node lib/test-grades.js` passes.

## Follow-ups
- Confirm whether scenario directory should be renamed to match EXP-220 naming conventions (if required by harness).
- Confirm whether root ownership is acceptable; if not, fix perms in repo creation process.
