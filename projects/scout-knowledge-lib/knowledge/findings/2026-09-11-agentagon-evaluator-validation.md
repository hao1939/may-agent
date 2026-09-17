<ai_context>
summary: "Agentagon treats an agent benchmark as a versioned artifact that must itself pass negative controls, optional metric-discrimination cases, provenance checks, and independent review before it can judge candidate fixes. This closes an important evaluator-validity gap, but it validates only declared cases and does not establish production generalization."
triggers: ["Agentagon", "benchmark validation", "negative controls", "metric discrimination", "agent evaluation", "measured agent improvement"]
last_updated: "2026-09-11"
source_basis: "Pinned source and documentation inspection at agentagon/agentagon commit ed7432ed05009d77f408476d1df332c4f460be7d. No benchmark run or production deployment was independently reproduced."
</ai_context>

# Agentagon Tests the Evaluator Before It Lets the Evaluator Test a Fix

**Date:** 2026-09-11  
**Source:** GitHub  
**Repo:** https://github.com/agentagon/agentagon  
**Inspected revision:** https://github.com/agentagon/agentagon/commit/ed7432ed05009d77f408476d1df332c4f460be7d  
**Discovery feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A%3E%3D2026-09-09&sort=stars&order=desc&per_page=20 (`incomplete_results: false`; first 20 of 781 results)

## Finding

Agentagon's useful design signal is not simply that it runs before/after scores. It makes the **evaluation package itself pass an admission process** before candidate fixes may rely on it.

A preparation plan must declare expected behavior, metric directions, coverage as either `holdout` or explicitly `limited`, and at least one deliberately incorrect mutation. The implementation executes the baseline and every negative case under the same frozen plan. A negative case counts only when named checks reject the incorrect behavior; a harness crash or an always-green check is not accepted as sensitivity evidence.

The plan can also include known better/worse variants for **metric discrimination**. Those variants and their comparisons must be declared together, and freezing fails if the measured metric does not rank them by at least the declared minimum delta. This tests two different evaluator properties:

1. **Rejection sensitivity:** known-wrong behavior fails the correctness checks.
2. **Ranking sensitivity:** known-better behavior scores better than known-worse behavior.

That distinction matters for agent optimization. A benchmark can reject obvious breakage yet still be too flat or noisy to guide improvement.

## Evidence-binding mechanics

Pinned implementation inspection found several controls beyond the prose workflow:

- Each trial request binds source, evaluation, input, and execution-profile digests plus its seed and timeout.
- Preparation requires all declared repetitions before aggregation; it records medians and the observed sample range rather than presenting one trial as stable.
- A freeze request must reference the exact validation digest and trial artifacts. The reviewer cannot be the plan author, and all required assessment fields must pass.
- Freeze re-reads content-addressed trial artifacts and recomputes outcomes and metric comparisons instead of trusting the review narrative.
- The application source and benchmark tree are checked again for drift before the package becomes `frozen`.
- Candidate admission is multi-objective: only verified, feasible, non-invalidated candidates enter the Pareto frontier. The search policy does not silently turn several metrics into one scalar winner.
- Selection, delivery, merge, deployment, and issue resolution remain separate actions.

Primary pinned files:

- [evaluation preparation and freeze checks](https://github.com/agentagon/agentagon/blob/ed7432ed05009d77f408476d1df332c4f460be7d/src/agentagon/experiments/preparation.py)
- [multi-objective aggregation and frontier](https://github.com/agentagon/agentagon/blob/ed7432ed05009d77f408476d1df332c4f460be7d/src/agentagon/experiments/evaluation.py)
- [evaluation-plan contract](https://github.com/agentagon/agentagon/blob/ed7432ed05009d77f408476d1df332c4f460be7d/contracts/v1/evaluation-plan.json)
- [evaluation preparation guide](https://github.com/agentagon/agentagon/blob/ed7432ed05009d77f408476d1df332c4f460be7d/docs/eval.md)
- [measured-fix guide](https://github.com/agentagon/agentagon/blob/ed7432ed05009d77f408476d1df332c4f460be7d/docs/fix.md)

## Design implication

A credible autonomous-improvement loop needs an **evaluator-validation gate before the candidate-validation gate**:

```text
trusted expectations
  -> baseline executes
  -> known-wrong controls are rejected
  -> known-order variants are discriminated
  -> evidence-bound independent review
  -> freeze evaluator
  -> measure isolated candidates
  -> preserve hard constraints and tradeoffs
  -> human or policy selects
```

The compact reporting rule is: do not say only that a candidate improved. Report the evaluator revision, source revision, negative controls, discrimination cases, repetitions/range, hard constraints, review identity boundary, and whether final selection or deployment occurred.

## Limits

This inspection establishes that the repository contains concrete contracts and implementation for the controls above; it does **not** establish that every host integration follows them correctly or that Agentagon improves agents in production. The repository was created on 2026-09-10 and had six stars in the observed search response, so maturity and independent adoption are unknown.

The safeguards are also relative to supplied ground truth. A mandatory negative control cannot rescue incorrect labels, correlated cases, weak holdout design, or a reviewer sharing the same blind spots as the author. `coverage: limited` is honest boundary metadata, not a substitute for broader coverage. The project documentation itself states that passing evidence applies to declared cases and does not prove production improvement.
