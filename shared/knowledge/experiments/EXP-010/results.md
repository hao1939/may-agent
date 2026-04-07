# EXP-010 Results: Workflow Enforcement vs Text-Based Skills

**Date**: 2026-04-07
**Status**: COMPLETE
**Verdict**: CEILING EFFECT — both arms near 100%; workflow enforcement shows no advantage over current baseline

## Hypothesis
The workflow version of convention-verify-edit (which structurally forces a separate verify phase) will achieve higher C2.3 pass rates than the non-workflow version, regardless of whether the verify-after-edit skill text is present.

## Design
- **Arm A**: convention-verify-edit (non-workflow, coder agent with skill) — 5 fresh runs + EXP-008 historical data
- **Arm B**: convention-verify-edit-workflow (workflow, tech-lead agent) — 5 runs
- **Primary metric**: C2.3 (verify-after-edit) pass rate
- **Secondary metrics**: C3 (explicit validation), overall pass rate

## Results

### Arm A: Non-Workflow Baseline (coder, WITH verify-after-edit skill)

#### EXP-008 Historical Data (2026-04-02)
| Run | C2.3 | C3 | Overall |
|-----|------|-----|---------|
| 1   | ✅   | ✅  | PASS    |
| 2   | ❌   | ✅  | FAIL    |
| 3   | ✅   | ✅  | PASS    |
| 4   | ✅   | ✅  | PASS    |
| 5   | ✅   | ✅  | PASS    |
| **Total** | **4/5 (80%)** | **5/5 (100%)** | **4/5 (80%)** |

#### Fresh Replication (2026-04-07, same-day)
| Run | C2.3 | C3 | Overall |
|-----|------|-----|---------|
| 1   | ✅   | ✅  | PASS    |
| 2   | ✅   | ✅  | PASS    |
| 3   | ✅   | ✅  | PASS    |
| 4   | ✅   | ✅  | PASS    |
| 5   | ✅   | ✅  | PASS    |
| **Total** | **5/5 (100%)** | **5/5 (100%)** | **5/5 (100%)** |

#### Combined Arm A: 9/10 C2.3 (90%), 10/10 C3 (100%), 9/10 overall (90%)

### Arm B: Workflow Enforcement (tech-lead, workflow=true)
| Run | C2.3 | C3 | Overall |
|-----|------|-----|---------|
| 1   | ✅   | ❌  | FAIL    |
| 2   | ✅   | ✅  | PASS    |
| 3   | ✅   | ✅  | PASS    |
| 4   | ✅   | ✅  | PASS    |
| 5   | ✅   | ✅  | PASS    |
| **Total** | **5/5 (100%)** | **4/5 (80%)** | **4/5 (80%)** |

### Comparison
| Metric | Arm A (combined 10 runs) | Arm B (5 runs) | Δ |
|--------|--------------------------|----------------|---|
| C2.3 pass rate | 90% | 100% | +10% (n.s.) |
| C3 pass rate | 100% | 80% | -20% |
| Overall pass rate | 90% | 80% | -10% |

## Analysis

### 1. Ceiling Effect Invalidates the Comparison
The primary metric (C2.3) is near ceiling in BOTH arms: 90% non-workflow vs 100% workflow. With n=5 per fresh arm and n=10 combined, the 10% difference is not statistically significant (Fisher exact p > 0.5). The scenario is too easy to discriminate between conditions.

### 2. Baseline Has Improved Since EXP-008
EXP-008 (April 2) showed 80% C2.3 baseline. Fresh replication (April 7) shows 100%. This suggests the baseline behavior has improved over the past 5 days — possibly due to accumulated skill text, heartbeat changes, or model drift. This makes the EXP-008 data partially stale for comparison purposes.

### 3. Workflow Arm Failed on C3, Not C2.3
The single failure in the workflow arm was C3 (explicit JSON validation command), NOT C2.3 (read-after-write). The workflow's Phase 2 instructs "read it back from disk and verify" — which the agent does (satisfying C2.3) — but doesn't always run an explicit `node -e JSON.parse(...)` command (failing C3). The workflow structurally enforces C2.3 but doesn't enforce C3.

### 4. The Workflow Uses tech-lead, Not coder
The workflow scenario uses `agent_type: "tech-lead"` while the baseline uses `agent_type: "coder"`. This introduces a confound: any differences could be due to the agent type (different SOUL, different skills), not the workflow enforcement. A cleaner experiment would use the same agent with and without workflow.

## Key Takeaways

1. **Workflow enforcement did NOT improve C2.3** in this scenario — both arms already near ceiling.
2. **The scenario is too easy** for this comparison. The config.json edit task is simple enough that the agent naturally verifies. A harder scenario (multi-file edit, ambiguous requirements) would better discriminate.
3. **Baseline has drifted** since EXP-008 (80% → 100% C2.3). This suggests either model improvement or cumulative effect of system changes. Future experiments should always collect same-day baselines.
4. **The verify-after-edit skill install in coder's skills/ already works as well as the workflow** on this scenario. The skill's value proposition was previously questioned (EXP-008 null result), but the fresh data shows 100% baseline, making the point moot for this scenario's difficulty level.

## Recommendations for Follow-Up

1. **EXP-010b**: Repeat with a harder scenario (e.g., convention-verify-multi-edit) where baseline C2.3 is <70%.
2. **Control the agent confound**: Run workflow with `coder` type (not `tech-lead`) to isolate the workflow variable.
3. **Increase sample size**: n=5 is insufficient to detect 10-20% differences. Need n≥15 per arm for 80% power.
4. **The real question has shifted**: With C2.3 near ceiling on gym scenarios, the gap is between gym performance and production performance (where C1.3 violation rates are 30-70%). The problem isn't that agents CAN'T verify — it's that production contexts (complex tasks, time pressure, multi-file changes) suppress the behavior. Gym scenarios need to be harder to reproduce production failure rates.
