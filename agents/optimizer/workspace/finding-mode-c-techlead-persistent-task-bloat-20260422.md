# Finding: Persistent Task Evaluation Loop Causes Op Bloat

**Date**: 2026-04-22
**Mode**: C (Technique Scouting)
**Sessions investigated**:
- `s_1776684784353_341` — tech-lead, 109 ops, iteration 6
- `s_1776685590314_435` — tech-lead, 85 ops, iteration 8
- `s_1776686332086_464` — optimizer, 67 ops, iteration 21 (error)

## Root Cause

**Reviewer-Evaluator disagreement loop on a structurally unachievable goal.**

Both tech-lead sessions are iterations of the same persistent task: "Increase workflow coverage from 31% to 80%." The task has 5/5 milestones complete, and the **reviewer** marks it DONE every iteration, but the **evaluator** scores it FAIL (3-4/10) because actual session-level coverage is 19.9%, not 80%.

This creates an infinite loop:
1. Reviewer says DONE → persistent-task system advances to next iteration
2. Evaluator says FAIL → task stays open, new iteration is scheduled
3. Worker re-analyzes the same data, produces the same finding, burns 85-109 ops
4. Goto 1

The task prompt itself is **massive** (~4-5KB) because it accumulates reviewer/evaluator verdicts from every past iteration. By iteration 8, the prompt contains **6 rounds of duplicated evaluator/reviewer feedback** — the same FAIL(4/10)/DONE cycle repeated verbatim.

## Ops Breakdown

### s_1776684784353_341 (109 ops, 16.8 min)
| Tool | Count |
|------|-------|
| bash | 104 |
| read | 6 |
| edit | 5 |
| finish | 1 |

### s_1776685590314_435 (85 ops, 10.8 min)
| Tool | Count |
|------|-------|
| bash | 77 |
| read | 7 |
| edit | 8 |
| finish | 1 |

### s_1776686332086_464 (67 ops, 11.8 min)
| Tool | Count |
|------|-------|
| bash | 60 |
| read | 2 |
| edit | 5 |
| write | 2 |

The vast majority of ops are bash calls — the worker repeatedly investigates the same coverage numbers, reads the same workflow files, and produces the same analysis markdown each iteration.

## Optimizer Error Session (s_1776686332086_464)

**Error**: `401 AuthenticationError: Github_copilotException - IDE token expired: unauthorized: token expired. Received Model Group=claude-opus-4.6`

This is an LLM auth token expiry mid-session — not a code bug. The optimizer was on iteration 21 of the same workflow-coverage persistent task (from the optimizer's side). It burned 67 ops before the token expired.

## Structural Issues

1. **Prompt bloat**: The task prompt accumulates all past evaluator/reviewer feedback without summarization. By iteration 8, the same FAIL/DONE verdicts appear 6+ times verbatim. This wastes context window and confuses the worker.

2. **Goal-state mismatch**: The task goal requires *implementation* (achieve 80% coverage), but it's assigned to a review-role agent (tech-lead). The reviewer correctly identifies "this requires implementation work beyond this review task's scope" but the system keeps iterating.

3. **No termination condition**: When reviewer says DONE and evaluator says FAIL indefinitely, the persistent-task system has no circuit breaker. It should cap iterations or detect the disagreement pattern.

4. **Duplicate work across agents**: Both tech-lead AND optimizer are assigned iterations of what appears to be the same underlying project, doubling the waste.

## Is a Fix Dispatchable?

**Yes — two fixes:**

1. **Immediate (config)**: Close/archive the "workflow coverage" persistent task. The reviewer has marked it DONE 6+ times. The remaining gap (19.9% → 80%) requires infrastructure changes, not more review iterations.

2. **Systemic (code change)**: Add a circuit breaker to the persistent-task iteration system:
   - If reviewer says DONE for N consecutive iterations (e.g., 3) while evaluator keeps failing, auto-escalate to human or auto-close.
   - Cap accumulated feedback in the prompt to the last 2 iterations (summarize older ones).
   - Detect when a task is assigned to an agent that cannot fulfill the goal (review agent vs. implementation goal).

Fix #1 is immediately dispatchable. Fix #2 requires design work on the persistent-task scheduler.
