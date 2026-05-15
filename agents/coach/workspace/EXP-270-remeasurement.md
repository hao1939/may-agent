# EXP-270 Re-measurement: Anti-Shallow Sessions

**Date**: 2026-07-18 (re-measurement due date)
**Status**: PARTIAL — evaluator dead since Apr 30, no new data since treatment deployment

## Context
- EXP-270 treatments deployed ~Jul 10 (coach ≥10 tool calls, bob ≥5 tool calls)
- Re-measurement was scheduled for Jul 18
- **Problem**: Evaluator has produced 0 evaluations since Apr 30. No post-treatment data exists.

## Available Data (Apr 23–30, pre-treatment baseline)

| Agent | N (LLM, q>0.2) | Avg Quality | N (Heuristic, q=0.2) | 
|-------|----------------|-------------|----------------------|
| Coach | 230 | 0.562 | 309 |
| Bob | 36 | 0.67 | 106 |
| Amy | 51 | 0.72 | 0 |
| Optimizer | ~80 | ~0.55 | ~303 |

### Coach Quality Distribution (LLM-evaluated, n=230)
- Baseline avg: 0.562 (LLM-evaluated sessions only)
- This is PRE-treatment data (treatments deployed Jul 10, data ends Apr 30)

## Conclusion

**Cannot re-measure.** The evaluator pipeline has been dead for 17+ days (since Apr 30). Zero post-treatment evaluations exist for any agent.

### Blockers
1. **Evaluator dead** — previously escalated as P0, marked "resolved Jul 3" in todo.md, but DB shows no evals after Apr 30
2. Without evaluator, we cannot measure whether anti-shallow rules improved quality

### Recommendations
1. Re-escalate evaluator pipeline to may (P0) — it's dead again
2. Keep treatments deployed (they're cheap, directionally positive)
3. Close EXP-270 as INCONCLUSIVE due to measurement infrastructure failure
4. When evaluator returns, design EXP-271 with proper before/after window

## Decision: Close EXP-270 as INCONCLUSIVE
- Treatments remain deployed (no harm, likely benefit)
- Formal measurement impossible without evaluator
- Baseline captured: coach 0.562 (LLM-only), bob 0.67
