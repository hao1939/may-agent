# Lens A: Evaluation Handler Overlap Analysis

**Date**: 2026-04-16  
**Scope**: `agents/may/handlers/evaluation-sync.ts` (404 lines), `evaluator-heartbeat.ts` (313 lines)  
**Note**: `evaluator-review.ts` does not exist — only 2 eval handlers, not 3.

## Finding: Duplicated LLM Evaluation Sampling

Both handlers independently sample heuristic-evaluated sessions and upgrade them to LLM evaluations:

| Aspect | evaluation-sync.ts | evaluator-heartbeat.ts |
|--------|-------------------|----------------------|
| **Lines** | 353-370+ | 181-286+ (`sampleAndEvaluateTopLevel()`) |
| **Mechanism** | Random 30% sample of heuristic batch, calls `evaluateStandaloneSession()` | Finds agents with lowest LLM eval rate, calls `evaluateStandaloneSession()` |
| **Budget** | Unbounded (30% of MAX_PER_RUN=50 = up to 15) | MAX_LLM_EVALS_PER_RUN = 3 |
| **Shared import** | `evaluateStandaloneSession` from `src/lib/evaluator.js` | Same |

### Why this matters
- **Double-spending on LLM evals**: Both run on cron, both sample sessions for LLM evaluation. A session could be picked by both.
- **Conflicting strategies**: evaluation-sync uses random sampling; evaluator-heartbeat uses priority-based (lowest LLM rate first). Neither knows about the other's picks.
- **Cost risk**: Combined worst case is ~18 LLM evals per cycle instead of the intended 3.

## Original Responsibilities (Clean Split)

The handlers had clean separation before the LLM sampling was added to evaluation-sync:

- **evaluation-sync.ts**: Heuristic evaluation of all sessions (pure JS, no LLM, no cost)
- **evaluator-heartbeat.ts**: LLM calibration checks + top-level LLM sampling

The overlap was introduced when evaluation-sync.ts added its own LLM sampling at line 353+ (likely from the checkpoint noted in session context — "Add LLM evaluation sampling to evaluation-sync.ts").

## Severity: Medium
Not a bug, but causes uncontrolled LLM eval spend and makes the system harder to reason about.

## Recommended Action (separate session)
Remove the LLM sampling block from `evaluation-sync.ts` (lines ~353-380). Let `evaluator-heartbeat.ts` own all LLM evaluation decisions — it already has the smarter priority-based approach and explicit budget cap. This restores the clean split: sync = heuristic, heartbeat = LLM.
