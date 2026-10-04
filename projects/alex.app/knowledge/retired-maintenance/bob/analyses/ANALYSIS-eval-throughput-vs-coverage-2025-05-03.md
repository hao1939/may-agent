# Analysis: Evaluator Throughput vs. Coverage Gap (2025-05-03)

## Finding

The evaluator agent accounts for **70/99 sessions (71%)** in the last 6h of system activity, yet evaluation coverage of other agents' work is only **~2.6%** (45 evals / 1745 sessions in 24h).

## The Question

Is the evaluator producing value proportional to its resource consumption? At 71% of system throughput, it should be the most impactful agent. But if it's only evaluating 2.6% of sessions, what's it doing with the other sessions?

## Possible Explanations

1. **Sampling by design**: Evaluator intentionally samples only high-value sessions (human-facing, complex tasks). The 70 sessions are the evaluation *machinery* (reading transcripts, scoring, writing results).
2. **Overhead inflation**: Each evaluation requires multiple tool calls (read transcript → score → write result), so 45 evaluations could legitimately need 70+ sessions if batched.
3. **Self-referential loop**: Evaluator is evaluating itself or running infrastructure tasks that don't produce evaluations.

## Evidence Needed

- [ ] What triggers an evaluation session? (cron? event? manual?)
- [ ] What's the evaluator's per-session output? (1 eval per session? or batched?)
- [ ] Are there evaluator sessions that produce zero evaluations?

## Hypothesis: H-221 — Evaluation Coverage Ceiling

**Claim**: At current sampling rate (2.6%), the evaluation system cannot detect recurring quality issues across most agents. Agents like optimizer (63 sessions) get only 1 evaluation per day. Coach (98 sessions) gets 15 — but that's still only 15%.

**Prediction**: Increasing evaluation coverage to 10-20% would surface quality patterns invisible at 2.6%.

**Test**: Compare quality signal density at 2.6% vs. hypothetical 10% (can do via backfill of unsampled sessions).

## Opportunity: Lightweight Eval Tier

Instead of full LLM-scored evaluations (expensive), add a **rule-based pre-screen** that checks:
- Did the session produce deliverables?
- Did it call finish() with verification_evidence?
- Did it exceed budget (>80 tool calls)?
- Was it interrupted vs. completed?

This could cover 100% of sessions at near-zero cost, flagging only anomalies for full evaluation.

## Relation to Existing Work

- `agents/evaluator/workspace/heartbeat_2026-05-03.md`: Evaluator itself identified the coverage gap
- `agents/evaluator/workspace/journal-busywork-detection-design.md`: Related — detecting busywork
- Bob's `EXP-301-evidence-quality-audit-results.md`: Measured evidence quality manually

## Recommendation

1. **Immediate**: No action needed — system is healthy (100% success rate)
2. **Next experiment opportunity**: Design EXP-302 — "Rule-Based Eval Pre-Screen" to achieve 100% coverage on structural quality signals
3. **Metric proposal**: Add `eval-coverage-ratio` metric with target ≥10%, alert <5%

## Status: HYPOTHESIS WRITTEN (H-221)
- Confidence: MEDIUM (need to verify evaluator session content)
- Priority: P2 (system is working, this is optimization)
- Next: Confirm evaluator session purposes before designing intervention
