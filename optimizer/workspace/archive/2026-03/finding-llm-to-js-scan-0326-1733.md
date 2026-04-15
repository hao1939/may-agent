# LLM-to-JS Scan Finding — 2026-03-26T17:33

## Scan Summary
Queried may.db for 24h session data. 2,610 total ops across all agents.

### Top cost consumers (24h):
| Agent | Ops | Sessions | Avg |
|-------|-----|----------|-----|
| optimizer | 957 | 41 | 23.3 |
| coach | 741 | 39 | 19.0 |
| tech-lead | 346 | 14 | 24.7 |
| bob | 226 | 30 | 7.5 |
| coder | 124 | 16 | 7.8 |
| qa | 94 | 31 | 3.0 |
| may | 64 | 27 | 2.4 |
| scout | 40 | 11 | 3.6 |
| evaluator | 18 | 26 | 0.7 |

### Already optimized (no further JS-ification needed):
- Evaluator: 0.7 avg ops (JS heuristic handles most evaluations)
- May: 2.4 avg ops (JS handlers do the heavy lifting)
- Scout: 3.6 avg ops (idle heartbeats = 1 op)
- QA: 3.0 avg ops (20/31 sessions at 0-2 ops)

## New Candidate Found: Periodic Task Router (for optimizer)

**Pattern**: Every optimizer heartbeat (23/day) starts by reading `periodic-tasks.md` (6KB), parsing "Last done" timestamps, comparing to current time, and selecting the most overdue task. This is 100% deterministic date parsing.

**Current cost**: 1-2 ops × 23 heartbeats = 23-46 ops/day just for task selection.

**Proposed JS handler**: `periodic-task-router.ts`
- Parse `periodic-tasks.md` for "Last done:" timestamps
- Compare each to current time, compute staleness
- Account for cooldowns (e.g., skill lifecycle = 12h)
- Write `agents/optimizer/workspace/next-task.md` with:
  - Most overdue task name
  - Time since last done
  - Previous top finding summary (1 line)
- Inject into heartbeat context so optimizer can skip the read + parse step

**Savings estimate**: 23-46 ops/day (1-2% of total, modest but adds up)

**Complexity**: LOW — simple date parsing, no LLM judgment needed.

**Priority**: LOW — Previous candidate (tool-quality-trend, ~9-20 ops/day savings) still blocked on restart. This is a secondary candidate to implement after restart unblocks the queue.

## Reviewed but NOT candidates:
1. **Coach common-sense-verify** (118 ops/day, 6 runs): Requires genuine LLM judgment to evaluate whether an agent followed a behavioral rule. Not mechanizable.
2. **Bob heartbeats** (191 ops/day, avg 7.5): Architecture thinking — requires LLM.
3. **Tech-lead sessions** (346 ops/day): Implementation work — requires LLM.
4. **Optimizer periodic-task *execution*** (vs. *selection*): The actual analysis/scanning work requires LLM judgment. Only the routing/selection is deterministic.

## Status
- Previous candidates: tool-quality-trend (9-20 ops/day) — blocked on restart
- This candidate: periodic-task-router (23-46 ops/day) — ready to implement after restart
- Combined if both activated: ~32-66 ops/day savings
