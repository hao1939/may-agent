# EXP-039 Results: Informationally Isolated Verification Protocol

**Status**: COMPLETE — Selective confirmation bias confirmed
**Tests**: H-009 (evaluator rubber stamp), H-001 (adversarial framing)
**Date**: 2026-04-06 (Phase A+B completed)
**Author**: Bob

## Summary

Isolated verification (stripping agent self-narrative from evaluator input) has **selective effect**: no impact on good sessions, significant impact on weak sessions where agent narrative masks execution failures.

## Phase A: Heuristic Evaluator

**N=19 production sessions. Result: No meaningful difference.**

| Metric | Contextual | Isolated | Delta |
|--------|-----------|----------|-------|
| Avg Quality | 4.84 | 4.89 | +0.05 |
| Verdict changes | — | — | 0/19 (0%) |

The heuristic evaluator scores on structural signals (tool calls, status, finish()). It barely reads agent narrative, so isolation doesn't help.

## Phase B: LLM Evaluator

**N=4 task trees. Result: Selective confirmation bias confirmed.**

| Session Quality | Δ Quality | Verdict Change? |
|----------------|-----------|-----------------|
| Good (Q≥0.85) | -0.01 to 0.00 | No (within noise) |
| Weak (Q=0.45) | **-0.10** | **Yes** (acceptable→needs_improvement) |

Inter-run noise floor: ~0.02-0.03. The -0.10 delta is 3-5x above noise.

## Key Findings

1. **Confirmation bias is selective**: Only affects evaluation of ambiguous/weak sessions where agent explanations provide "benefit of the doubt"
2. **Good work speaks for itself**: High-quality sessions have strong structural evidence independent of narrative
3. **Isolated evaluation finds more specific issues**: Without "agent says it was checked," evaluator must verify from tool outputs directly

## Prediction Assessment

| Prediction | Result |
|-----------|--------|
| P-A1: ≥2x issue detection | Partially supported (qualitative, not aggregate scores) |
| P-A2: Wider verdict distribution | Weakly supported (1/4 verdict changes, correct direction) |
| P-A3: Slight FP increase | Not observed |

## Hypothesis Updates

- **H-009 (evaluator rubber stamp)**: Confirmed — bias lives in LLM evaluator's narrative processing, not heuristic scoring
- **H-001 (adversarial framing)**: Partially supported — agent self-narrative creates confirmation frame for weak sessions

## Production Recommendation

**Hybrid approach**: Run contextual evaluation first, trigger isolated evaluation as "second opinion" ONLY for sessions scoring below 0.6. This captures the benefit (catching masked failures) without overhead on good sessions.

## Limitations

- Small LLM sample (N=4, only 1 showed significant difference)
- No planted-bug gym scenarios (cleaner signal needed)
- Same model for both conditions
