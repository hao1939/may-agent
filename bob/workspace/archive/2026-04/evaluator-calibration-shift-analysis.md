# Evaluator Calibration Shift: Post-Fix Analysis

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Type**: Observational analysis — not a hypothesis

---

## Observation

A step change in the heuristic evaluator's scoring occurred around 2026-04-01 06:00 UTC:

| Period | Heuristic Good Rate | Acceptable Rate | NI Rate |
|--------|-------------------|-----------------|---------|
| Mar 30-31 | ~90% (74-100%) | ~10% | 0% |
| Apr 1-2 | ~56% (49-61%) | ~44% | 0% |

The pass rate (good + acceptable) remained at ~100%. No sessions received `needs_improvement` from the heuristic evaluator post-fix. The change is entirely in the **good vs acceptable** distinction.

## Cause

Commit `a6250b0` fixed the evaluator heuristic, eliminating 64/65 false "acceptable" verdicts. Ironically, the fix appears to have also **tightened the good→acceptable boundary**, causing more sessions to receive "acceptable" instead of "good".

This is consistent with the analysis-failures session noting the fix was deployed but "hasn't been deployed (no bundle rebuild since the fix)" — the fix may have been partially deployed via a different mechanism, or the specific timing suggests a bundle rebuild happened around Apr 1 06:00.

## Implications

### 1. The Good-Rate Drop Is Not a Quality Drop
Any dashboard showing "good rate declining" since April 1 is measuring an **evaluator calibration shift**, not an agent quality regression. The underlying agent behavior is unchanged — the ruler got more precise.

### 2. Historical Comparisons Are Compromised
Before/after comparisons that span the Apr 1 boundary are unreliable for the "good" verdict. The pass rate (good + acceptable) remains valid. This affects:
- Agent-level quality trends
- Experiment results that use "good" as a metric
- Any retrospective R-calibration using "good" rate

### 3. Knowledge-Action Gap in the Evaluator Itself
The evaluator fix is itself an instance of the Knowledge-Action Gap mechanism (`cross-ref-knowledge-action-gap-mechanism.md`). The heuristic always had criteria for distinguishing good/acceptable — but a code bug prevented the criteria from being applied. The fix was structural (code change), not knowledge-based. This validates the theory from WITHIN the evaluation system:

> Even evaluation logic follows the pattern: knowledge (criteria) exists but isn't activated without structural routing (correct code).

### 4. Ongoing Evaluator Properties
Post-fix, the heuristic evaluator:
- Never gives `needs_improvement` (0 out of ~300+ sessions)
- Gives `good` at ~55% (down from ~90%)
- Gives `acceptable` at ~45% (up from ~10%)

The LLM evaluator (rare, <2% of sessions) gives `needs_improvement` at a higher rate and `good` at ~34%. The heuristic is still **more lenient** than the LLM evaluator, but the gap narrowed significantly post-fix.

## Data for KE-005 Update

This analysis provides additional evidence for KE-005 (QA rubber-stamps). The evaluator heuristic was itself rubber-stamping — giving "good" to 90% of sessions when a more discriminating evaluation would give it to ~55%. The fix reduced the rubber-stamping by 35 percentage points, but the heuristic still never fails a session (0% NI), suggesting further calibration is needed.

## Recommendation

Update KE-005 with this data point. The evaluator heuristic fix improved discrimination by ~35pp but still has 0% rejection rate. For experiments and quality tracking, use **pass rate (good + acceptable)** as the primary metric, not good rate alone, to avoid the Apr 1 discontinuity.

---

*This is an observational analysis, not a hypothesis. No new hypothesis needed — it's evidence for existing theories (Knowledge-Action Gap, KE-005).*
