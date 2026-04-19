# EXP-188: Finish-Guard Enforcement for Persistent-Task Workflow

## Research Question
Can a finish-guard gate (blocking `finish(success)` unless `workflow.run("persistent-task")` was called) enforce persistent-task usage when an active project exists?

## Design
- **Scenario**: `use-persistent-task-autodetect` — agent has active project, task includes persistent-task injection text
- **Baseline**: Current text-only injection (project-scanner.ts tells agent to use persistent-task)
- **Treatment**: Added Gate 3 to `src/lib/tools/finish-guard.ts` — blocks `finish(success)` when session contains persistent-task injection text but no `workflow.run("persistent-task")` call was made
- **Metric**: Binary pass/fail — did agent call `workflow.run("persistent-task")`?

## Results

| Condition | Trial 1 | Trial 2 | Trial 3 | Pass Rate |
|-----------|---------|---------|---------|-----------|
| Baseline (text injection only) | FAIL | FAIL | FAIL | 0/3 (0%) |
| Treatment (finish-guard enforcement) | PASS | PASS | PASS | 3/3 (100%) |

**Delta**: +100pp (0% → 100%)

## Run IDs
- Baseline: 3283, 3284, 3285 (use-persistent-task-autodetect, no guard)
- Treatment: 3280, 3281, 3282 (use-persistent-task-autodetect, with guard)
- Additional baseline (base scenario): 3274, 3275, 3276 (use-persistent-task, 0/3)

## Implementation
Gate 3 in `src/lib/tools/finish-guard.ts`:
1. Scans user messages for both "persistent-task" AND "active project" (indicates project-scanner injection)
2. If found, checks assistant tool calls for `workflow.run` with "persistent-task" in args
3. If no such call found, blocks finish with actionable error message
4. Placed BEFORE the `!hasDeliverables` early return (critical — agents often finish without deliverables)

## Key Finding
Text injection alone fails because agents read the project file, do the work inline, and call `finish(success)` without ever invoking the workflow. The finish-guard creates an unavoidable enforcement point. This matches EXP-184's 100% result with finish-guard enforcement.

## Caveats
- N=3 per condition (small sample)
- Guard detects injection via string matching ("persistent-task" + "active project" in user messages)
- Guard is already committed to the binary — production impact needs monitoring

## Recommendation
**PROMOTE** — the guard is already in `finish-guard.ts` and rebuilt into the binary. Monitor production for:
1. False positives (sessions blocked when they shouldn't be)
2. Persistent-task adoption rate in production heartbeats
