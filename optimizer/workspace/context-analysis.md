# Persistent-Task Context Analysis
*2026-04-16*

## 1. All Persistent-Task Runs Found

| Workflow Run | Goal | Iterations | Child Sessions | Total Ops | Duration | Status |
|---|---|---|---|---|---|---|
| `wr_1776243028526_16sm` | Fix verify-wrap ctx.agent bug | 3 iter (w+r each) | 6 | 90 | 26m | DONE |
| `wr_1776243684438_ijd2` | Same bug (duplicate) | 3 iter | 4 | 43 | 13.5m | DONE |
| `wr_1776243720577_bu8t` | Same bug (duplicate) | 3 iter | 4 | 71 | 20m | DONE |
| `wr_1776265016904_pyvu` | Unified Metrics Phase 1 | 3 iter | 4 | 68 | 12.4m | DONE |
| **`wr_1776292221031_awt0`** | **EXP-166 gym trials** | **10 iter** | **15** | **298** | **274m** | **DONE** |
| `wr_1776313371848_y5gw` | EXP-167 gym trials | 3 iter | 4 | 61 | 14.6m | DONE |
| `wr_1776337349875_jd9x` | Structured handoff M1 | 1 iter | 2 | 50 | 5.7m | DONE (after 1) |

**Longest run**: EXP-166 at 10 iterations / 15 child sessions / 274 minutes.

## 2. Context Size per Iteration (EXP-166 — longest run)

The `task` field is the full prompt sent to each child session:

| Iteration | Type | Task Length (bytes) | Ops | Status |
|---|---|---|---|---|
| 1 | worker | 642 | 57 | done |
| 2 | worker | 2,404 | 40 | done |
| 2 | review | 4,246 | 3 | done |
| 3 | worker | 6,171 | 30 | interrupted |
| 4 | worker | 5,132 | 27 | interrupted |
| 4 | review | 5,817 | 7 | done |
| 5 | worker | 4,780 | 16 | interrupted |
| 6 | worker | 2,727 | 24 | interrupted |
| 6 | review | 3,347 | 0 | done |
| 7 | worker | 3,275 | 31 | done |
| 8 | worker | 2,619 | 24 | interrupted |
| 8 | review | 4,120 | 1 | done |
| 9 | worker | 3,760 | 33 | done |
| 10 | worker | 4,371 | 5 | done |
| 10 | review | 4,750 | 0 | done |

**Key finding**: Task sizes are BOUNDED, not growing unboundedly. They range 642–6,171 bytes. This is because:
- `buildWorkerPrompt` only includes last 3 iterations (line ~260 of persistent-task.ts)
- `pruneOldIterations` collapses old iterations after keeping KEEP_RECENT=5 (line ~290)
- `ctx.summarize(workerResult, { maxLength: 1500 })` caps worker output stored in project file

## 3. The Real Bottleneck

**It's NOT child session context overflow.** Each child gets a fresh session with a bounded prompt (3-6KB). The pruning/windowing works.

**The bottleneck is the ORCHESTRATOR session (parent).** The `execute()` function in persistent-task.ts runs the entire loop in a single async function call within the parent session. Each `ctx.runAgent()` call:
1. Spawns a child session
2. Waits for it to complete  
3. Accumulates the result in the parent's context

The parent session accumulates ALL `ctx.runAgent()` results. For EXP-166:
- 15 child sessions × average ~20 ops each = ~300 tool calls worth of results flowing back
- The parent (`s_1776291828058_154`) had 50 ops of its own + the workflow overhead

**However**, the EXP-166 run completed all 10 iterations successfully, suggesting the current system CAN handle 10+ iterations without overflow. The parent finished with status=done, no errors.

## 4. Calculating Accumulation Rate

From the code analysis:
- Worker result stored: `ctx.summarize(workerResult, { maxLength: 1500 })` → up to 1.5KB per worker iteration
- Review result: ~200 bytes (CONTINUE/DONE/BLOCKED + detail)
- Project file operations: ~500 bytes of markdown manipulation overhead per iteration
- **Per iteration (worker + review)**: ~2.2KB of new context in the orchestrator

**Estimated context limit**: ~200KB for the orchestrator session (Claude context window minus system prompt, etc.)

**Estimated max iterations before overflow**: 200KB / 2.2KB ≈ ~90 iterations

But this is optimistic — the orchestrator also accumulates:
- `ctx.runAgent()` return values (which include session metadata)
- Emit events
- Error handling state

**Realistic estimate**: 30-50 iterations before the orchestrator would overflow.

## 5. What Actually Stops Runs

From the data, runs stopped because:
1. **DONE decisions** (most runs): The reviewer said DONE after 1-3 iterations
2. **EXP-166**: Completed 10 iterations successfully — reviewer said DONE at iter 10
3. **No overflow crashes observed** in any run

The `interrupted` status on some child sessions (5 of 15 in EXP-166) is from individual session timeouts, NOT orchestrator overflow. The orchestrator handled these gracefully and continued.

## 6. Summary

| Question | Answer |
|---|---|
| Max iterations achieved | 10 (EXP-166) |
| Context overflow observed? | No — none of the 7 runs hit overflow |
| Child prompt size bounded? | Yes — 3-6KB via windowing + pruning |
| Orchestrator accumulation rate | ~2.2KB/iteration |
| Theoretical max iterations | ~30-50 before orchestrator overflow |
| Primary bottleneck | Orchestrator session context (not child sessions) |
| Current mitigation | `ctx.summarize(maxLength: 1500)` + `pruneOldIterations` |

**The system works but has never been stress-tested beyond 10 iterations.** The design is sound for <30 iterations. For truly long-running tasks (50+), the orchestrator would need to externalize state (which the project file already does) and periodically restart itself.
