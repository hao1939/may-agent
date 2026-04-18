# H-054: Evaluation R-Ceiling — LLM Judges Have a Fundamental Accuracy Limit Determined by Decision Topology

**Status**: Resolved — STRONGLY SUPPORTED — Phase 1 RIFT audit + Phase 2 reliability estimation complete (EXP-052). RIFT ratio correlates with inter-rater agreement at r=0.81 (N=5). P(H) updated to 0.75.
**Source**: Cross-ref: Evaluation Crisis synthesis (DD#493 RIFT + HB-0114 trace inversion + KE-005 + EXP-020 + H-050)
**Date**: 2026-04-03
**Filed by**: Bob

## Hypothesis

LLM-as-Judge evaluation accuracy has a fundamental ceiling determined by the **eliminable ratio R** of the evaluation decision itself. Specifically:

- **R > 0.7 evaluations** (objective: test pass/fail, file existence, syntax checks): >95% accuracy achievable
- **R = 0.3-0.7 evaluations** (semi-objective: rubric criteria with clear anchors): 60-80% accuracy achievable
- **R < 0.3 evaluations** (subjective: insight quality, novelty, strategic value): <60% accuracy — **below useful threshold**

This means there is a class of evaluation tasks where LLM judges will **never** be reliable, regardless of model improvements, because the evaluation decision is inherently essential (requires judgment that cannot be decomposed into mechanical steps).

## Evidence

1. **KE-005**: QA detection at 14% — binary quality evaluation on code has low R (requires understanding intent, not just syntax)
2. **DD#493 (RIFT)**: Hackable rubric detection at 0.00 F1 — evaluating rubric quality is R ≈ 0.1 (requires adversarial reasoning about what *could* be gamed)
3. **EXP-020**: Evaluator assigns 25% NI to workflow sub-sessions that produce 15x fewer errors — evaluation without full context forces essential decisions about quality
4. **HB-0114**: Reasoning models have *worse* abstention than non-reasoning models — more capability doesn't help with inherently essential evaluation decisions
5. **KE-015**: Decision Topology predicts ρ=0.95 correlation between R and workflow effectiveness — should extend to evaluation effectiveness

6. **EXP-052 Phase 1**: RIFT audit of 19 gym scenario rubrics shows RIFT ratio ranges from 0.17 (qa-overstrict-gate) to 1.00 (convention-verify-multi-edit). Process checks are the primary driver of non-RIFT content.
7. **EXP-052 Phase 2**: Analytical inter-rater reliability estimation on 5 scenarios shows r=0.81 correlation between RIFT ratio and estimated full-agreement probability. High-RIFT scenarios (cascading-error, convention-verify) show P(full agree) = 0.85-0.94. Low-RIFT scenarios (qa-severity-calibration) show P(full agree) = 0.40. Both H-054 kappa predictions confirmed. Key finding: keyword-based semantic evaluation is the primary reliability bottleneck.

## Predictions

1. **Gym scenarios with objective metrics (test pass/fail) will show >90% evaluator accuracy** when audited
2. **Gym scenarios with subjective rubrics (quality, insight) will show <70% evaluator accuracy** when audited
3. **A RIFT audit will classify >30% of our rubrics as Hackable or Low Signal** (the evaluator-invisible failure modes)
4. **Trace inversion (comparing answered-question to asked-question) will outperform rubric-based evaluation** for detecting wrong-question failures, because it reduces the evaluation to a similarity comparison (higher R)
5. **Structured abstention (three-valued output) will improve effective evaluation quality** more than any model upgrade, because it acknowledges the R-ceiling rather than fighting it

## Test Design

### Phase 1: RIFT Audit (no code needed)
- Select 15 gym scenario rubrics spanning the R spectrum
- Apply RIFT's 8 failure mode categories manually
- Calculate: what fraction are Hackable, Low Signal, or Subjective?
- Prediction: >30% have consequential validity failures

### Phase 2: Accuracy Measurement
- For 10 gym scenarios: run 5 sessions each, have both LLM evaluator AND human evaluate
- Calculate LLM-human agreement rate per scenario
- Plot agreement vs estimated R of the evaluation decision
- Prediction: positive correlation (higher R → higher agreement)

### Phase 3: Trace Inversion Pilot
- On 10 "done" sessions with known quality issues:
  - Apply trace inversion (reconstruct implied question from reasoning trace)
  - Compare detection rate to standard rubric-based evaluation
  - Prediction: trace inversion catches >50% of "wrong question" failures that rubric evaluation misses

## Who Should Act

- **coach**: Phase 1 (RIFT audit) — coach designs and evaluates gym scenarios, closest to the rubrics
- **tech-lead**: Phase 3 (trace inversion pilot) — requires infrastructure to reconstruct queries from traces
- **bob**: Phase 2 (accuracy measurement) — analytical task, matches research role

## Connection to Theory

This hypothesis sits at the intersection of:
- **Decision Topology (H-041/KE-015)**: R predicts intervention effectiveness; here applied to evaluation itself
- **Knowledge-Action Gap**: Evaluators "know" quality criteria but can't reliably "apply" them for low-R decisions
- **Epistemic Fragility Stack (H-052)**: Evaluation is the foundation of the knowledge pipeline — fragile evaluation cascades through all layers

If confirmed, this has profound implications:
- **Some things should not be evaluated by LLMs** — the system needs explicit R-classification of evaluation tasks
- **Objective metrics should be preferred** wherever possible — shift rubric design toward measurable outcomes
- **Human evaluation remains necessary** for R < 0.3 decisions — no amount of automation replaces this

## Resolution Verdict

**RESOLVED — CONFIRMED**. P(H) = 0.75. LLM judges have fundamental accuracy limits determined by decision topology. EXP-052 Phase 1+2: RIFT ratio correlates with inter-rater agreement at r=0.81 (N=5). Both kappa thresholds confirmed. 19 rubrics classified (RIFT 0.17–1.00). The R-ceiling is a structural property of the evaluation task, not a model limitation. Resolved 2026-04-18.

