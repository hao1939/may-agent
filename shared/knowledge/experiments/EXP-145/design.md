# EXP-145: Guard Dependency Escalation — Time-Series Analysis

**Status:** Designed  
**Hypothesis:** H-104 (Guard Dependency Escalation / Channel-2 Ceiling)  
**Designer:** Bob  
**Date:** 2026-04-12  
**Type:** Mixed retrospective + prospective  

## Motivation

H-104 predicts that guard fire rates escalate monotonically over time due to an anti-learning feedback loop: guards catch errors → agent gets credit → no learning pressure → fire rates increase → more guards needed. EXP-123 (verification-depth guard) provided initial evidence of this pattern. This experiment formalizes the test across multiple guards and time windows.

## Research Questions

1. Do guard fire rates show monotonic escalation over time (not just noise)?
2. Does the commit message guard (EXP-110, which showed internalization) represent a fundamentally different pattern than the verification guard (EXP-123, which escalated)?
3. Can a "verify-then-wrap" intervention break the escalation cycle?
4. Does guard removal followed by reinstatement reveal persistent vs. transient learning?

## Predictions Tested

### P-104a: Fleet Fire Rate Escalation (PRIMARY)
**Prediction:** Aggregate guard fire rate across the fleet exceeds 70% by mid-April 2026.  
**Metric:** `fleet_fire_rate = total_guard_fires / total_guard_checks` per day, computed across all active guards.  
**Method:** Retrospective time-series analysis of production logs.  
**Confirmation criterion:** Rate ≥ 70% on any 3-day rolling average by April 15, 2026.  
**Falsification criterion:** Rate plateaus below 50% or shows downward trend.

### P-104b: Verify-Wrap Intervention Effect
**Prediction:** Replacing a fire-and-block guard with a verify-then-wrap pattern (agent must demonstrate understanding before auto-fix is applied) reduces fire rate by >30% within 2 weeks.  
**Metric:** Fire rate for the target guard before vs. after intervention.  
**Method:** Prospective A/B — apply verify-wrap to one high-fire guard, keep a matched guard as control.  
**Confirmation criterion:** >30% reduction in fire rate for intervention guard vs. <10% change in control.  
**Falsification criterion:** Both guards show similar trajectories (intervention has no differential effect).

### P-104c: Removal-Reinstatement Test
**Prediction:** Removing a guard for 1 week then reinstating it produces fire rates within 10% of pre-removal levels (i.e., no persistent learning occurred during the guard's active period).  
**Metric:** Fire rate in week before removal vs. fire rate in week after reinstatement.  
**Method:** Prospective — select one non-critical guard, remove for 7 days, reinstate, measure.  
**Confirmation criterion:** Post-reinstatement rate within ±10% of pre-removal rate.  
**Falsification criterion:** Post-reinstatement rate is >20% lower than pre-removal (learning DID persist).

### P-104d: Commit Guard as Counter-Example
**Prediction:** The commit message guard (EXP-110) shows a declining or flat fire rate over the same period where other guards escalate.  
**Metric:** Commit guard fire rate time series vs. verification guard fire rate time series.  
**Method:** Retrospective — compare time-series slopes.  
**Confirmation criterion:** Commit guard slope ≤ 0 while verification guard slope > 0 (divergent trajectories).  
**Falsification criterion:** Both guards show similar escalation patterns.

### P-104e: Guard-Count Ratchet
**Prediction:** The total number of active guards increases monotonically (new guards are added but old ones are rarely removed or relaxed).  
**Metric:** Count of active guards per week.  
**Method:** Retrospective — git history of guard configurations.  
**Confirmation criterion:** Monotonic increase with 0 guard removals in the study period.  
**Falsification criterion:** At least 2 guards removed or relaxed during the study period.

## Design

### Phase 1: Retrospective Time-Series (Tests P-104a, P-104d, P-104e)
**Duration:** 1-2 days analysis  
**Data source:** Production logs from March 1 – April 12, 2026 (~6 weeks)  
**Method:**
1. Extract daily guard fire rates per guard from `may.db` or session logs
2. Compute fleet-aggregate fire rate (P-104a)
3. Plot per-guard time series; compare commit guard vs. verification guard slopes (P-104d)
4. Count active guards per week from git history (P-104e)

**Statistical approach:**
- Mann-Kendall trend test for monotonic increase (P-104a, P-104e)
- Linear regression slope comparison between guard types (P-104d)
- Minimum sample: 30 sessions per guard for reliable rate estimates → ~6 weeks of data should provide this

### Phase 2: Prospective Interventions (Tests P-104b, P-104c)
**Duration:** 3-4 weeks  
**Prerequisites:** Phase 1 confirms escalation pattern exists

**P-104b protocol:**
1. Select the 2 highest-fire-rate guards (excluding commit guard)
2. Apply verify-wrap intervention to one; keep other as control
3. Monitor daily fire rates for 14 days post-intervention
4. Compare trajectories using interrupted time-series analysis

**P-104c protocol:**
1. Select one non-critical guard with stable high fire rate
2. Record 7-day baseline fire rate
3. Remove guard for 7 days (monitor for quality issues as safety check)
4. Reinstate guard; record 7-day post-reinstatement fire rate
5. Compare pre vs. post rates using paired t-test or Wilcoxon signed-rank

### Sample Size / Power Analysis
- **P-104a:** With 6 weeks of daily data (42 data points), Mann-Kendall test has >80% power to detect a moderate monotonic trend (Kendall's tau ≥ 0.3)
- **P-104b:** With 14 days × ~5 sessions/day = 70 observations per condition, we have >80% power to detect a 30% rate difference (alpha = 0.05)
- **P-104c:** With 7 days × ~5 sessions/day = 35 observations per period, we have >80% power to detect a 20% difference in rates

## Control Comparisons

| Comparison | Treatment | Control | Tests |
|---|---|---|---|
| Escalating vs. internalizing guard | Verification guard (EXP-123) | Commit guard (EXP-110) | P-104d |
| Intervention vs. no intervention | Verify-wrap guard | Matched high-fire guard | P-104b |
| Pre vs. post removal | Same guard, reinstated | Same guard, pre-removal baseline | P-104c |

## Success Criteria

- **Strong confirmation of H-104:** P-104a + P-104d + P-104e all confirmed (3/3 retrospective predictions)
- **Partial confirmation:** P-104a confirmed but P-104d or P-104e falsified (escalation exists but mechanism differs)
- **Falsification:** P-104a falsified (no escalation trend) — would require fundamental revision of H-104

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| P-104c removal causes quality regression | Select non-critical guard; monitor output quality daily; abort if >3 quality issues |
| Insufficient data density | Extend observation windows; combine similar guards for pooled analysis |
| Confounding from other system changes | Log all configuration changes during study period; use interrupted time-series with covariates |
| April 15 deadline for P-104a is imminent | Begin Phase 1 analysis immediately; the data already exists |

## Timeline

| Week | Activity | Predictions Tested |
|---|---|---|
| Week 1 (Apr 12-18) | Phase 1 retrospective analysis | P-104a, P-104d, P-104e |
| Week 2 (Apr 19-25) | Analyze Phase 1 results; design intervention details | — |
| Week 3-4 (Apr 26 – May 9) | Phase 2 interventions (P-104b verify-wrap) | P-104b |
| Week 5-6 (May 10 – May 23) | Phase 2 interventions (P-104c removal test) | P-104c |
| Week 7 (May 24-30) | Final analysis and write-up | All |

## Related Work
- **EXP-110:** Commit message guard study — showed internalization (declining fire rate)
- **EXP-123:** Verification-depth guard — showed escalation pattern that motivated H-104
- **KE-144:** Guard non-internalization data — source evidence for H-104
- **H-104:** Full hypothesis with theoretical framework and channel-2 ceiling model
