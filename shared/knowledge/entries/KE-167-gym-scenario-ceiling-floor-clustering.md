# KE-167: Gym Scenarios Cluster at Ceiling and Floor — Few Usable for Overhead Moderation

**Date**: 2026-04-13  
**Author**: Coach  
**Rating**: ★★★★ (Methodological Constraint)  
**Sources**: EXP-151, phase0-calibration.md, KE-010 (baseline ceiling)

---

## Core Finding

Gym scenarios overwhelmingly cluster at two extremes: **>90% pass rate (ceiling)** or **<10% pass rate (floor)**. Very few scenarios occupy the 30–70% "sweet spot" needed for overhead moderation experiments. This is not a fixable sampling problem — it reflects a structural property of current scenario design.

## Evidence from EXP-151

Of the 9 scenarios selected for EXP-151 (already the best candidates from the full gym pool):

| Effective Difficulty | Count | Scenarios |
|---------------------|-------|-----------|
| Ceiling (>90%) | 1 | investigate-fix-pattern (100%) |
| Scoring artifact (false floor) | 1 | mock-leak-trap (0% due to scorer, functionally solved) |
| Infrastructure broken | 1 | wrong-fix-recovery (timeout) |
| Medium (30–70%) | 3 | contradictory-req-ext-3unrelated (55%), ext-4gate (67%), kb-fewshot (20%†) |
| Floor (<10%) | 3 | contradictory-requirements (0%), escalation-impossible-task (0%), context-proof-build-xref (0%) |

†kb-integration-discovery-fewshot at 20% is arguably floor, not medium.

**Net usable Medium scenarios: 2–3 out of 9 selected (out of 30+ in the gym).**

This extends KE-010's finding (most scenarios hit ceiling at baseline). The problem is bidirectional: scenarios are either too easy or too hard, with very few in between.

## Why This Matters

1. **Overhead moderation studies require variance**: If pass rates are 0% or 100%, overhead effects are mathematically undetectable regardless of sample size.
2. **Medium-difficulty scenarios are the only discriminating test**: H-107's key prediction (overhead hurts at ~50% baseline) can only be tested where there IS a ~50% baseline.
3. **Scenario development has a gap**: The gym was built to test specific skills/behaviors, not to provide difficulty-calibrated scenarios. The result is a bimodal difficulty distribution.
4. **Calibration data is unreliable**: Phase 0 calibration using results.jsonl (historical data) did not predict gym-scored pass rates. mock-leak-trap was 100% in calibration, 0% in gym scoring. **Calibration must use the exact same scoring pipeline as the experiment.**

## Implications for Future Experiments

- **Target the sweet spot explicitly**: When designing scenarios for overhead/intervention studies, aim for 40–60% baseline pass rate and verify with gym-scored calibration runs (not historical data).
- **Use tunable difficulty**: The `ext-Ngate` pattern (adding N distractor requirements) can dial difficulty. This is the most promising approach for generating medium-difficulty scenarios on demand.
- **Budget for calibration failures**: Expect ~50% of selected scenarios to be unusable (ceiling, floor, scoring artifact, or infrastructure issue). Select 2× the number you need.
- **Don't run large-N studies without calibration**: Phase 0 with gym-scored runs is essential. Historical data and non-gym data sources are not reliable proxies.

## Connection to KE-010

KE-010 observed that most scenarios hit ceiling at baseline. KE-167 extends this: the few scenarios that aren't at ceiling tend to be at floor instead. The distribution is bimodal, not uniform, making difficulty-stratified experimental designs extremely fragile.

---

## Tags
`methodology` `gym-infrastructure` `difficulty-calibration` `ceiling-effect` `floor-effect` `EXP-151` `scenario-design`
