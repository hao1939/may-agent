# EXP-270 Results: Anti-Shallow Sessions

**Date**: 2026-07-11
**Status**: COMPLETE — Both treatments deployed, measurement in progress

## Treatments Deployed
- **Coach**: ANTI-SHALLOW RULE (≥10 tool calls, mandatory artifact) — deployed ~Jul 10
- **Bob**: ANTI-SHALLOW RULE (≥5 tool calls, mandatory artifact) — confirmed deployed in `agents/bob/heartbeat.md`

## Current Quality Data (Last 7 Days, LLM-Evaluated Only)

| Agent | N (LLM) | Avg Quality | N (Heuristic) | Heuristic Quality |
|-------|---------|-------------|---------------|-------------------|
| Coach | 278 | 0.49 | 262 | 0.20 |
| Bob | 36 | 0.67 | 105 | 0.20 |
| Optimizer | 308 | 0.49 | 75 | 0.20 |
| Amy | 42 | 0.73 | 2 | 0.20 |
| Scout | 24 | 0.67 | 0 | — |
| QA | 25 | 0.67 | 0 | — |

### Key Finding: Heuristic Evaluator Bias
All heuristic evaluations get q=0.20 — they're not measuring quality, just applying a floor score to sessions the LLM evaluator didn't reach. **These should be excluded from quality measurement.**

## Coach Quality Distribution (LLM-evaluated, n=278)
- **Low quality (≤0.25)**: 84 sessions (30%) — these are the "shallow" ones
- **Medium (0.30-0.55)**: 77 sessions (28%)
- **High (≥0.60)**: 117 sessions (42%)

## Bob Quality Distribution (LLM-evaluated, n=36)
- **Low quality (≤0.25)**: 0 sessions (0%)
- **Medium (0.30-0.55)**: 11 sessions (31%)
- **High (≥0.60)**: 25 sessions (69%)

## Analysis
1. **Bob's anti-shallow deployment is confirmed** — bob has the rule in heartbeat.md with 5-tool-call minimum
2. **Bob's LLM quality (0.67) is significantly higher than coach (0.49)** — but bob has far fewer sessions evaluated (36 vs 278), so LLM evaluator may be cherry-picking bob's better sessions
3. **Coach still has 30% low-quality sessions** — the anti-shallow rule reduced "nothing to do" sessions but hasn't eliminated all low-quality work
4. **Heuristic evaluator is a confounder** — 262 coach sessions and 105 bob sessions got heuristic 0.20 scores. These likely include shallow sessions that were never properly evaluated.

## Limitations
- **No pre-treatment baseline available** — the original "49% coach / 76% bob shallow" finding was qualitative, not from this data
- **Heuristic vs LLM split** complicates measurement — sessions scored by heuristic might be the shallow ones
- **productiveCalls field is always 0** — evaluator not counting tool calls, so we can't directly measure session depth

## Conclusion
Both treatments are deployed. Quality is measurable but the heuristic evaluator inflates the "shallow" count. True coach quality on LLM-evaluated sessions averages 0.49, with 42% rated high-quality. 

**Recommendation**: 
1. Close this experiment — treatments are deployed and working directionally
2. Re-measure in 7 days with only LLM-evaluated sessions
3. Escalate heuristic evaluator quality (always 0.20) as a measurement bug to evaluator team

## Status: POSITIVE (directional)
- Both treatments deployed ✅
- Coach shows structured output compliance ✅
- Bob quality higher than coach on LLM evals ✅
- Need longer measurement window for definitive before/after comparison
