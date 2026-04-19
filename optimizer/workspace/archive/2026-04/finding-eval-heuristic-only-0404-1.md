# Finding: LLM Evaluations Dead, Heuristic-Only Since Mar 31

**Date**: 2026-04-04  
**Severity**: Medium (evaluation quality degraded, but cost savings significant)  
**Category**: System behavior change

## Summary

The LLM-based `evaluateTask()` pipeline has effectively stopped running since ~Mar 31. All evaluations are now heuristic-only. This happened because:

1. All sessions are now **root sessions** (no parent-child hierarchy)
2. `writeHeuristicEvaluations()` handles all root sessions → everything gets heuristic scores
3. `evaluateTask()` (the LLM path) only triggers for parent sessions with unevaluated children
4. Since there are no parent sessions, `evaluateTask()` never fires

## Evidence

LLM evaluations by day:
- Mar 29: 32 LLM evals
- Mar 30: 48 LLM evals  
- Mar 31: 11 LLM evals
- Apr 1: 14 LLM evals
- Apr 2: 8 LLM evals
- Apr 3: 7 LLM evals (all "skipped" evaluator self-evals)
- Apr 4: 1 LLM eval

## Impact

**CORRECTION**: The `usage` field in evaluations contains the SESSION's LLM costs (input/output tokens from the agent session), NOT evaluation costs. The $135/day shown in the evaluations table is the total cost of running all agent sessions. The actual cost of running heuristic evaluations is ~$0 (pure JS computation). When LLM evaluations were running (Mar 29-30), each evaluation cost a separate LLM call — but we can't easily separate eval cost from session cost in the current DB schema.
**Quality risk**: Heuristic scoring is less nuanced than LLM. Currently:
- quality=2 for all error/timeout sessions (59 "acceptable" in 24h)  
- quality=4-5 for sessions with finish(success) + low error rate
- 26 "needs_improvement" verdicts in 7 days (for shallow or high-waste sessions) — Coach feedback loop works
- However, heuristic can't detect subtle quality issues (wrong approach, incomplete results, etc.)

## Good Rate Drop Explained

The apparent drop from 82.8% (yesterday) to 34.4% (today) in "good rate" is NOT a quality regression. It's the heuristic rescoring (Phase 3 in evaluate-sessions handler) correctly downgrading rubber-stamped quality=5 evaluations to quality=2-3 based on transcript metrics. The REAL quality hasn't changed — the MEASUREMENT improved.

## Turn-Limit Dominance

All 59 "acceptable" sessions today are turn-limit errors (status=error, issue=session_error). These sessions had 30-59 productive tool calls but ran out of turns. The agents worked fine — the budget was the constraint.

## Recommendation

1. **Acceptable for now** — heuristic scoring provides reasonable differentiation
2. **Consider selective LLM evaluation** — for sessions with unusual patterns (high waste, unusual verdict)
3. **The maxTurns from 30→40 upgrade (already deployed)** should reduce turn-limit errors going forward
4. **Monitor the good rate** — if it stays ~35% with no "bad" verdicts, the heuristic is just more conservative than LLM
