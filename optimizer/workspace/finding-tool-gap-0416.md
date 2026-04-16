# Tool Gap Analysis — Apr 16 Early (6h Window)

**Period**: 2026-04-16 ~22:30–04:30 UTC
**Total sessions**: ~270 across all agents

## Session Volume Summary (last 6h)

| Agent | Sessions | Avg Ops | Max Ops | Total Ops |
|-------|----------|---------|---------|-----------|
| coder | 98 | 10.9 | 74 | 1070 |
| amy | 49 | 12.2 | 33 | 599 |
| bob | 18 | 17.8 | 44 | 321 |
| coach | 24 | 9.8 | 36 | 236 |
| tech-lead | 22 | 10.4 | 37 | 228 |
| optimizer | 22 | 9.4 | 31 | 206 |

## Key Patterns Observed

### 1. Gym Trial Repetition (bob: 18 sessions, 321 ops)
Bob ran EXP-166 and EXP-167 gym trials across 9+ iterations, each ~27-44 ops. Each iteration calls `gym-run.sh` repeatedly. The `gym-batch.sh` script already exists for batching, but bob's persistent-task workflow still spawns individual iterations.

**Gap**: No gap — `gym-batch.sh` exists. Bob's high ops come from the experiment workflow design (deliberate iteration), not missing tooling.

### 2. Coder 74-op Outlier
The 74-op coder session had a "reference: how an experienced engineer handled an impossible task" prefix — this is an experiment prompt variant. The high op count is experimental, not a tooling gap.

### 3. Repeated Gym Scenarios Dominate
- 31 sessions: "Fix failing tests in student grade processing pipeline"
- 23 sessions: "Fix the Product Search Service" (amy)
- 17 sessions: same (coder)
- 15 sessions: Phase 1 ANALYZE variants
- 12 sessions: Phase 2 FIX variants

These are all gym runs, not production work. No multi-step bash patterns to automate here — the gym runner already handles orchestration.

### 4. Tech-lead Task Planning (37 ops)
Tech-lead spent 37 ops "designing and queuing 3+ concrete coder tasks." This involves reading backlog, checking coder status, writing task specs, dispatching. Could potentially benefit from a task-template tool, but 37 ops for 3+ tasks is reasonable.

### 5. Existing Tool Coverage
Current scripts cover the main automation needs:
- `gym-run.sh` / `gym-batch.sh` — gym orchestration ✓
- `session-query.ts` — session data queries ✓
- `code-search.sh` — codebase search ✓
- `gym-stats.ts` — experiment analysis ✓
- `health-check.sh` / `status.sh` — system monitoring ✓

## Conclusion

**No significant tool gaps found.** The last 6h was dominated by gym experiment runs (EXP-166, EXP-167), which are well-served by existing tooling. The high-op outliers (coder 74, bob 44, tech-lead 37) are all explainable by task complexity, not missing automation.

**Minor opportunity**: A `session-summary` helper that takes a sessionId and returns task+status+opCount+outcome in one call (vs. manual DB queries) could save optimizer/coach 2-3 ops per archaeology session. Low priority — the bun -e pattern works fine.
