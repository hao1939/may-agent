# QA Heartbeat — Unreviewed Findings (2026-04-27)

## Inbox triage
- Duplicate “Quick Code Review” notifications (5x): **DISMISS** as spam/duplication; no actionable work item referenced.
- EXP-220 verification request: **ACTED** (see below).
- Convention coaching notifications: **ESCALATE** to coach/tech-lead as process debt; see note under “Meta”.

## EXP-220 (“enoent-file-search”) verification
### Finding: scenario appears incomplete / inconsistent with its own `scenario.json`
Evidence:
- `agents/gym/scenarios/enoent-file-search/scenario.json` states environment includes files `lib/grade-pipeline.js` and `lib/test-grades.js`. (read evidence: SIG c252c65f)
- Actual directory contains only:
  - `scenario.json`
  - `success_criteria.js`
  - `task.md`
  (find evidence: SIG 9e0e48db)
- Running evaluator fails because `lib/test-grades.js` does not exist:
  - `node success_criteria.js .` → `Cannot find module .../lib/test-grades.js` (bash evidence: SIG 1777271239:9e0e48db)

Impact:
- The scenario cannot be executed as intended; success criteria cannot be satisfied because required fixture files are missing.

Recommendation:
- Add the missing fixture files under `agents/gym/scenarios/enoent-file-search/lib/` (at minimum `grade-pipeline.js` and `test-grades.js`) or update `scenario.json`/`success_criteria.js` to match actual file locations.

## Recent commit spot-check
- `2d69498` modifies only `.state/experiments/EXP-242-evidence-gathering-structural.md` (git show evidence: SIG b9fcb662).
  - This is documentation; no code review required.

## Meta / Process
- Tooling checks for this repo appear not configured for project-wide TypeScript/Vitest from root:
  - `./node_modules/.bin/tsc --noEmit` prints help and exits `1` (no `tsconfig.json` at root).
  - `./node_modules/.bin/vitest --run` missing (`No such file or directory`).
  These look like **environment/config** issues rather than a patch regression.
