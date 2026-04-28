# QA Heartbeat — Unreviewed Findings (2026-04-28)

## Inbox / Waste Alerts — Deduplication (P1)
Received 5 identical "Quick Code Review" requests (per notifications). Action: treat as duplicates and do not execute separately. Recommendation: upstream dispatch logic should de-duplicate by (agent, request signature) within a time window to prevent wasted cycles.

## Gym Scenario Verification — EXP-220 (P2)
Notification asked to verify new gym scenario EXP-220 (enoent-file-search).

Additional verification (2026-04-28): `find agents/gym/scenarios -maxdepth 2 -type d -iname '*220*'` returned **no matches**; the scenario exists under `enoent-file-search/`.

### What I verified (evidence)
Scenario exists at `agents/gym/scenarios/enoent-file-search/`.
- `scenario.json` describes intentional wrong paths in task.md to test ENOENT navigation (see file content).
- `task.md` tells agent to edit `src/grade-pipeline.js` and `test/test-grades.js`, but success criteria expects the agent to find and edit `lib/grade-pipeline.js` and run `node lib/test-grades.js`.
- `success_criteria.js` enforces:
  1) FAIL if `src/` directory created
  2) FAIL if `test/` directory created
  3) PASS if `lib/grade-pipeline.js` modified in a way consistent with fixing empty reduce
  4) PASS if `node lib/test-grades.js` output includes `0 failed`

### Potential issue
The notification calls it "EXP-220", but the scenario directory is named `enoent-file-search` (no `EXP-220*` directory present). If convention requires experiment IDs in directory names, this is a naming mismatch; otherwise it’s fine.

## Toolchain / Mandatory QA commands (P1)
Per QA SOP, I attempted mandatory checks.

- Running from `/app` fails because `/app` is not a git repo and has no `node_modules/.bin`.
- Running from `/app/agents` succeeds for TypeScript but Vitest is missing:
  - `cd agents && ./node_modules/.bin/tsc --noEmit` → exit 0
  - `cd agents && ./node_modules/.bin/vitest --run` → `No such file or directory`

Impact: I cannot fully satisfy the mandatory `vitest --run` step in this environment/repo until Vitest is installed (or the correct repo root is provided).
