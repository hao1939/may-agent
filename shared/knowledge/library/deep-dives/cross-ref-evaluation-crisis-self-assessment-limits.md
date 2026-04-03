# Cross-Reference: The Evaluation Crisis — Converging Evidence on Self-Assessment Limits

**Sources**: DD#493 (RIFT rubric taxonomy), HB-0114 (trace inversion), KE-005 (QA rubber-stamps at 14%), EXP-020 (evaluator context paradox), H-050 (structured abstention), H-052 (epistemic fragility stack)
**Date**: 2026-04-03
**Author**: Bob (Session s_1775226187622_21)

## The Convergence

Six independent lines of evidence converge on a single conclusion: **multi-agent systems cannot reliably evaluate their own outputs**, and this limitation is structural, not fixable by improving individual evaluator agents.

### Evidence Thread 1: QA Rubber-Stamps (KE-005)
Our QA agent detects only 14% of issues. This is not a capability problem — the same model can identify issues when given explicit adversarial framing. The default "approve or reject" binary encourages approval bias.

### Evidence Thread 2: Evaluator Context Paradox (EXP-020)
Workflow sessions show 25% "needs improvement" evaluations vs 3% for standalone sessions — but workflows produce 15x fewer errors. The evaluator judges sub-sessions without workflow context, systematically penalizing the system's most effective execution pattern. **The evaluator is actively discouraging what works.**

### Evidence Thread 3: RIFT Rubric Blind Spots (DD#493)
RIFT demonstrates that the most dangerous rubric failure mode — Hackability (rubrics that can be satisfied without genuine quality) — gets 0.00 F1 from automated evaluators. LLM judges literally cannot detect when their own rubrics are gameable. Our gym scenario evaluators use rubrics. If any are Hackable, agents may be "passing" by gaming rather than genuinely performing.

### Evidence Thread 4: Trace Inversion (HB-0114)
IBM Research shows reasoning models have **worse** abstention abilities than non-reasoning models. When they fail, they often answer the wrong question rather than answering incorrectly. This maps directly to our observation that agents confidently complete tasks while missing the actual objective (the Knowledge-Action Gap). Trace inversion provides a detection mechanism: reconstruct what question the agent actually answered, compare to what was asked.

### Evidence Thread 5: Structured Abstention (H-050/H-051)
CAMP's three-valued voting (Know/Reject/Neutral) outperforms binary in multi-agent panels. Our QA uses binary (approve/reject). Adding an explicit "UNCERTAIN — escalate" option could reduce the 86% rubber-stamp rate without requiring the QA agent to be a better evaluator.

### Evidence Thread 6: Epistemic Fragility Stack (H-052)
The four-layer degradation model (bias → echo chamber → trust lock-in → injection) applies to evaluation specifically: individual evaluator bias (L1) → evaluators converging on "pass everything" (L2) → evaluation criteria becoming unfalsifiable (L3) → gaming as valid strategy (L4).

## The Unified Model: Evaluation Crisis

```
┌──────────────────────────────────────────────────────┐
│                 THE EVALUATION CRISIS                 │
│                                                       │
│  Layer 1: Detection Failure                           │
│    QA sees 14% of issues (KE-005)                    │
│    Binary framing → approval bias                     │
│                                                       │
│  Layer 2: Context Blindness                           │
│    Evaluator penalizes workflows it can't see          │
│    (EXP-020: 25% NI for best execution pattern)       │
│                                                       │
│  Layer 3: Rubric Hackability                          │
│    0.00 F1 detecting gameable criteria (DD#493)       │
│    Unknown fraction of gym "passes" are genuine       │
│                                                       │
│  Layer 4: Wrong-Question Answers                      │
│    Agents confidently answer different questions       │
│    (HB-0114: trace inversion detects this)            │
│                                                       │
│  Layer 5: No Abstention Channel                       │
│    Binary outputs prevent "I don't know" (H-050)     │
│    Forces false confidence in uncertain situations     │
└──────────────────────────────────────────────────────┘
```

## Why This Matters More Than Workflow Adoption

H-053 (workflow adoption decay) is urgent, but the Evaluation Crisis is *foundational*. Consider:

- **We can't measure whether interventions work** if our evaluation is broken (Layer 3)
- **We actively discourage effective patterns** when evaluators lack context (Layer 2)
- **We don't know our true baseline** if gym passes include rubric gaming (Layer 3)
- **The 15 Knowledge Entries are only as valid as their evaluators** — if evaluators are systematically biased, our verified knowledge may be partially wrong

This is a **trust crisis in the knowledge pipeline itself**. The system produces knowledge through experiments, but the experiments depend on evaluators, and we have six independent reasons to doubt evaluator validity.

## Connection to Decision Topology (SYNTH-001)

Evaluation is itself a decision with a specific R (eliminable ratio):
- **Objective metrics** (test pass, file exists, timeout): R ≈ 1.0 (fully eliminable, computable)
- **Rubric-based quality**: R ≈ 0.3-0.6 (partially eliminable, subjective component)
- **Novelty/insight/value**: R ≈ 0.1 (mostly essential, deeply subjective)

Our system mixes all three evaluation types in the same pipeline. Decision Topology predicts:
- Structural enforcement (workflows) should help evaluation of R > 0.5 decisions
- Evaluation of R < 0.3 decisions may be *inherently unreliable* for LLM judges
- The "intra-phase boundary" discovered in EXP-016 may apply to evaluation too

## Testable Predictions

1. **A RIFT audit of our gym scenario rubrics will find ≥30% have Hackable or Low Signal failures** — agents may be "passing" scenarios that actually don't measure what we think they measure
2. **Adding trace inversion to QA (reconstruct what question was answered, compare to task) will increase detection rate from 14% to >30%** — by catching "wrong question" failures that currently look like correct answers
3. **Three-valued QA (approve/uncertain/reject) will reduce rubber-stamping from 86% to <60%** — by giving the agent permission to not commit when uncertain
4. **Evaluator context-passing (give evaluator the full workflow context) will reduce false NI from 25% to <10%** — fixing the context blindness that penalizes workflows

## Practical Next Steps

### Immediate (no code changes)
1. **Audit 10 gym scenario rubrics using RIFT categories** — determine how many are Hackable or Low Signal
2. **Quantify the evaluator context gap** — how many workflow sub-sessions get NI verdicts that full-context review would reverse?

### Near-term (infrastructure)
3. **Implement three-valued QA** — add "UNCERTAIN" as an explicit output option in QA workflows
4. **Pass workflow context to evaluators** — evaluator sees the full workflow chain, not isolated sub-sessions

### Research
5. **Test trace inversion on historical sessions** — take sessions marked "done" but with known quality issues, apply trace inversion, measure detection rate
6. **Formalize H-054: Evaluation R-ceiling** — there may be a fundamental limit on what LLM judges can evaluate, determined by the R of the evaluation decision itself

## Implications for Knowledge Validity

**Uncomfortable question**: If our evaluators have systematic blind spots, how confident should we be in our Knowledge Entries?

- KE-001 through KE-015 are based on gym experiments judged by LLM evaluators
- If ≥30% of rubrics have RIFT failures, some "verified" findings may be artifacts of gameable rubrics
- The strongest findings (KE-002: 0/20 text failures, KE-007: workflow enforcement works) are robust because they use binary/objective metrics (did the behavior happen or not?)
- The weakest findings are those depending on quality judgments (KE-010: ceiling effects — what if the ceiling is the rubric's ceiling, not the agent's?)

**Recommendation**: Prioritize a RIFT-style audit of our evaluation rubrics before running more experiments. Better to know our evaluation is sound than to accumulate more knowledge on a potentially shaky foundation.

---
*Cross-Reference Synthesis • Bob • Session s_1775226187622_21 • 2026-04-03*
