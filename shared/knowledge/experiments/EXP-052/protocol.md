# EXP-052: RIFT Audit of Gym Scenario Rubrics — Testing H-054 (Evaluation R-Ceiling)

**Date**: 2026-04-07
**Author**: Bob (Architect)
**Status**: COMPLETE — Phase 1 + Phase 2 executed. Phase 3 (remediation) deferred as future work.
**Tests**: H-054 P1 (rubric ambiguity limits LLM judge accuracy)
**Cost estimate**: ~$0 for Phase 1 (manual audit), ~$2-3 for Phase 2 (LLM inter-rater)

## Question

Do our gym scenario rubrics contain ambiguities that create a fundamental accuracy ceiling for any evaluator (human or LLM)? If so, can we measure the ceiling and identify which rubric types are most affected?

## Background

H-054 proposes that LLM judges have accuracy limits determined by decision topology — specifically, the number of response-independent fixed thresholds (RIFT points) in the rubric. High-RIFT rubrics (clear, mechanical criteria) allow high evaluator accuracy. Low-RIFT rubrics (judgment-dependent, ambiguous criteria) create an accuracy ceiling that no evaluator can exceed.

This connects to EXP-025's finding that evaluation of gym scenarios is unreliable (e.g., qa-overstrict-gate showed variable results across runs). It also connects to H-009's finding that our heuristic evaluator was a rubber stamp.

## Method

### Phase 1: Manual RIFT Audit (Bob)

For each of the 20 EXP-025 scenarios, read the `success_criteria.js` or scoring rubric and classify each criterion as:

**RIFT (Response-Independent Fixed Threshold):**
- Binary pass/fail based on observable output (e.g., "file X contains string Y")
- Checkable by regex, file existence, or test output
- Any competent evaluator would agree on the verdict
- Examples: "all tests pass", "file contains required field", "no error on startup"

**Non-RIFT (Judgment-Dependent):**
- Requires interpretation of intent, quality, or appropriateness
- Reasonable evaluators could disagree
- Examples: "code is well-structured", "review is thorough", "appropriate error handling"

**Semi-RIFT:**
- Has an observable check but edge cases require judgment
- Examples: "fix preserves existing functionality" (what counts as "existing functionality"?)

### Classification Template

For each scenario:
```
Scenario: <name>
Total criteria: N
RIFT criteria: X (list each)
Non-RIFT criteria: Y (list each)
Semi-RIFT criteria: Z (list each)
RIFT ratio: X / N
Predicted evaluator ceiling: (100% × RIFT_ratio) + (50-70% × semi_RIFT_ratio) + (30-50% × non_RIFT_ratio)
```

### Phase 2: Inter-Rater Reliability Test (if Phase 1 shows variance)

1. Take 5 scenarios with lowest RIFT ratio from Phase 1
2. Run each scenario 3 times with the agent
3. Have 3 independent LLM evaluators (different prompts/temperatures) score each run
4. Compute Fleiss' kappa across evaluators
5. Compare kappa for high-RIFT vs low-RIFT scenarios

**H-054 prediction**: kappa > 0.8 for high-RIFT scenarios, kappa < 0.5 for low-RIFT scenarios.

### Phase 3: Remediation (if Phase 2 confirms)

For scenarios where RIFT ratio < 0.5:
1. Rewrite rubric to increase RIFT ratio (convert judgment criteria to mechanical criteria)
2. Re-run Phase 2 inter-rater test
3. Verify kappa improves

## Phase 1 Execution Plan

Read each scenario's scoring file:

```bash
for s in agents/gym/scenarios/*/success_criteria.js; do
  echo "=== $(dirname $s | xargs basename) ==="
  head -40 "$s"
  echo "---"
done
```

For each, fill in the RIFT classification.

## Success Criteria

- **Strong support for H-054**: RIFT ratio explains >50% of variance in evaluator agreement (Phase 2)
- **Moderate support**: Scenarios with RIFT ratio < 0.5 exist AND show lower inter-rater reliability
- **Practical value**: Identify ≥3 scenarios whose rubrics should be rewritten for reliability
- **Refutation**: High RIFT ratio ≈ low RIFT ratio in inter-rater agreement → rubric structure doesn't matter

## Why This Matters

If H-054 is confirmed:
1. **Evaluation reliability becomes designable** — we can predict evaluation quality from rubric structure
2. **Gym improvements become systematic** — instead of debugging individual scenarios, fix the rubric type
3. **Production evaluation** — any task evaluation should be designed with RIFT-first criteria
4. **Connects to H-009** — the evaluator rubber-stamp problem may be unsolvable for low-RIFT tasks (fundamental ceiling, not evaluator quality)

---

*EXP-052 | Bob (Architect) | 2026-04-07*
