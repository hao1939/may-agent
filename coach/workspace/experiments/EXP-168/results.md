# EXP-168 Results: F1 Dose-Response — Partial Hints

**Date**: 2026-06-22 (results write-up)
**Status**: COMPLETED
**Scenario**: cascading-fix-trap-v2

## Summary

There is a clear dose-response relationship between hint specificity and pass rate on relational bug discovery. Vague nudges don't help at all; identifying the specific problem domain lifts pass rates to 27-47%; providing full root cause + fix reaches 100%.

## Results

| Arm | Hint Level | Pass Rate | N | Description |
|-----|-----------|-----------|---|-------------|
| baseline | None | 0% | 140 | No help |
| placebo | Unrelated hint | 0% | 10 | Control |
| nudge | "Check ordering" | 0% | 11 | Vague attention direction |
| moderate-f2 | F2-only (process guide) | 0% | 23 | Process without content doesn't help |
| f1f2 | Full F1 + F2 stacked | 7% | 15 | **Stacking degrades** (confirms KE-123) |
| paraphrase | Paraphrased hint | 20% | 10 | Modest lift |
| lexical | Lexical keyword hint | 27% | 26 | Keyword triggers partial recognition |
| f1 | Full expert analysis | 38% | 65 | Detailed analysis, variable adoption |
| moderate-hint | Problem identified | 47% | 19 | Sweet spot: problem domain without fix |
| symptoms | Symptom description | 75% | 20 | Describing what's wrong works better than explaining why |
| primary-full | Full root cause | 100% | 15 | Ceiling |
| rootcause | Root cause only | 100% | 15 | Ceiling |
| rootcause-fix | Root cause + fix code | 100% | 15 | Ceiling |

## Key Findings

### 1. The Discovery Gap is Real and Binary
Baseline is 0/140 (0%). Placebo is 0/10. Nudge ("check ordering") is 0/11. The agent literally cannot discover relational bugs without domain-relevant information. This isn't a "sometimes misses it" problem — it's a categorical inability.

### 2. Symptom Descriptions > Causal Explanations
"symptoms" (75%) dramatically outperforms "f1" (38%). Telling the agent WHAT is wrong works better than explaining WHY. This suggests the bottleneck is recognition/attention, not reasoning. Once the agent sees the right symptoms, it can reason its way to the fix.

### 3. Stacking Interventions Degrades Performance
f1f2 (7%) is dramatically worse than f1 alone (38%). This is the strongest confirmation yet of KE-123 (never stack interventions). The combined prompt likely overwhelms or confuses.

### 4. There's a Minimum Threshold
The response curve is: 0% (vague) → 20-27% (lexical/paraphrase) → 38-47% (specific) → 75% (symptoms) → 100% (full). The jump from vague to lexical is the critical threshold — you need to name the problem domain.

### 5. "moderate-hint" is the Training-Efficient Sweet Spot
At 47% with just problem identification (no fix), this is the most learning-relevant intervention. The agent still has to figure out HOW to fix it, but knows WHERE to look.

## Implications

1. **For skill design**: Skills should describe SYMPTOMS of failure patterns, not causal theories. "When tests pass but behavior is wrong, check component ordering" > "Pipeline ordering bugs occur when..."
2. **For the cascading-fix problem**: The agent needs symptom-based recognition training, not more reasoning scaffolding.
3. **New hypothesis**: A symptom-description skill could achieve 50%+ on cascading-fix-trap-v2 in production.

## Disposition

**COMPLETED**. Promote finding to knowledge entry. Design symptom-based skill experiment as follow-up.
