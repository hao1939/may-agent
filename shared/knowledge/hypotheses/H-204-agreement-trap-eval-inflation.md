# H-204: Agreement Trap Evaluation Inflation

**Created**: 2026-04-27 by Bob
**Status**: refuted (EXP-244: only 15% defensible, 20% ambiguous — well below 30% threshold)
**Confidence**: ★★★☆ (strong theoretical basis from DD#880, no direct measurement yet)
**Source**: DD#880 (arXiv:2604.20972) — "Escaping the Agreement Trap"
**Connects**: H-099 (discovery boundary), KE-002 (text rules ineffective), DD#849 (formalization-gaming gap)

---

## Claim

30%+ of agent evaluation failures in our system are defensible decisions — logically consistent with system rules and constraints — that are penalized because they differ from expected reference labels. Our evaluation methodology suffers from the Agreement Trap identified in DD#880.

## Mechanism

Our gym scenarios and evaluator use agreement-based metrics: "did the agent produce output matching the expected behavior checks?" When multiple valid approaches exist (ambiguity), we penalize agents for choosing a different-but-valid path. This:

1. **Inflates failure rates** — agents appear worse than they are
2. **Corrupts learning signals** — coach trains agents away from valid decisions
3. **Creates phantom improvement opportunities** — we design interventions for "failures" that aren't failures

DD#880 found 79.8-80.6% of "false negatives" were actually policy-grounded in rule-governed environments. Even if our rate is lower (we use more specific behavioral checks), 30%+ is conservative.

## Evidence

### Supporting
- DD#880: 33-46.6pp gap between agreement-based and defensibility-based metrics in comparable AI systems
- DD#880: 79.8% of "false negatives" were policy-grounded decisions
- Anecdotal: gym scenarios sometimes mark agents wrong for valid alternative approaches (e.g., fixing a bug via refactor instead of patch)
- H-099 baseline variance: the 67% natural rate might include some "failures" that are actually valid alternative approaches to KB integration

### Against / missing
- Our gym checks are behavioral (specific file changes, test results), not label-matching — may be more precise than DD#880's domain
- No direct audit of our evaluation failures using defensibility criteria
- The 30% number is extrapolated from a different domain (insurance/compliance)

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Audit 20 random "failed" gym trials | ≥6 (30%) have defensible alternative approaches |
| Re-evaluate with "is this logically valid given the task?" | Pass rate increases ≥15pp across scenarios |
| Scenarios with more specific behavioral checks | Lower agreement-trap rate (≤15%) |
| Scenarios with vague "quality" checks | Higher agreement-trap rate (≥50%) |

## Test Plan

- **Design**: Audit study. Sample 20-30 failed gym trials across diverse scenarios. For each, independently assess: "Is the agent's approach logically defensible given task instructions?" Score as Defensible/Indefensible/Ambiguous.
- **Scenario**: Use existing failed trial logs from recent experiments
- **Decision rule**: Confirmed if ≥30% defensible. Falsified if <15% defensible. Ambiguous if 15-30%.

## Implications if true

- **Evaluator redesign**: Add defensibility assessment alongside agreement checks
- **Gym scenario audit**: Tighten behavioral checks to reduce ambiguity, or add "alternative valid paths" to scenario definitions
- **Metric correction**: Our reported pass rates understate true agent capability by ~15-30pp
- **Intervention prioritization**: Some experiments targeting "failures" were solving non-problems — recheck historical conclusions
- **hypotheses-resolved metric**: Some unresolved hypotheses may already be validated if we discount agreement-trap failures

## Links

- Parent: DD#880 (arXiv:2604.20972)
- Related: H-099 (discovery boundary), DD#849 (formalization-gaming gap)
- Follow-up: Design EXP for audit study
