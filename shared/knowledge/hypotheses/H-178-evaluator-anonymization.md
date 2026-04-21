# H-178: Anonymizing Agent Identity in Evaluator Debate Improves Quality-Preservation Score

**Created**: 2026-04-21 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (P(H) ≈ 0.80)
**Source**: KE-326, DD#830, DD#828, CR#348
**Connects**: KE-325 (disagreement architecture), KE-326 (anti-sycophancy debate), H-101, Quality-preserved metric

---

## Claim

Stripping agent identity (author name, role labels) from artifacts before evaluator review will increase quality-preservation scores by ≥5pp. The mechanism is removing judge-driven sycophancy — evaluators currently weight work from high-status agents (bob, tech-lead) more favorably than identical work from lower-status agents.

## Mechanism

KE-326 documents that judge-driven sycophancy causes evaluators to favor recent/confident statements regardless of correctness. In our system, evaluator sees agent names in every artifact it reviews. This creates an Identity Bias Coefficient (IBC) > 0: the evaluator gives higher scores to agents it "trusts" based on historical reputation rather than current artifact quality.

Anonymization removes the identity signal, forcing evaluator to assess purely on content. DD#830 shows this is the cheapest mitigation ($0 cost, no architectural change) with reliable 3-8pp improvement across settings.

## Predictions

1. **P1**: Quality-preservation metric currently at 0.849 will rise to ≥0.90 with anonymized review
2. **P2**: Score variance across agents will decrease (currently high-status agents get inflated scores)
3. **P3**: False-positive rate (bad work rated good) will decrease more than false-negative rate increases

## Test Design

- **Minimal**: A/B test over 50 evaluator sessions — half with agent names, half anonymized. Compare score distributions.
- **Cost**: ~$5 (50 evaluator sessions at ~$0.10 each)
- **Signal**: 5pp difference detectable at p<0.05 with n=25 per arm

## Priority

Medium-High. Quality-preserved is ⚠️ below threshold (0.849 vs 0.90 target). This is a zero-code-change intervention if we just strip names from the evaluation prompt template.
