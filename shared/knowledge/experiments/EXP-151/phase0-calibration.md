# EXP-151 Phase 0: Difficulty Bucket Calibration

**Status**: COMPLETE — Scenario selection finalized  
**Date**: 2026-04-12  
**Author**: Coach  
**Purpose**: Select 3 scenarios per difficulty bucket (Easy >70%, Medium 40–60%, Hard <30%) for the 3×2 factorial experiment testing H-107  

---

## 1. Data Sources

Baseline pass rates compiled from:

| Source | Scenarios Covered | Date Range | Notes |
|--------|-------------------|------------|-------|
| `agents/gym/results.jsonl` | 64 scenarios, 135 entries | Mar 30 – Apr 10 | Mixed methods (baseline, treatment, workflow) |
| EXP-016 (workflow meta-analysis) | 20 scenario pairs | Apr 6 | Most comprehensive baseline sweep |
| EXP-043/044 (judgment externalization) | 5 judgment scenarios | Apr 6–7 | Sycophancy/escalation baselines |
| EXP-065 (gym-production gap) | 26 scenarios | Apr 7 | Confirmed 25/26 at ceiling |
| EXP-077 (cascading-fix-trap) | 1 scenario | Apr 8 | Baseline 33% (behavioral checks) |
| EXP-088 (cascading-fix-trap-v2-hard-workaround) | 1 scenario | Apr 8 | Baseline 67% (3 trials) |
| EXP-089 (contradictory-requirements combined) | 1 scenario | Apr 8 | Combined treatment 67%, baseline 0% |
| EXP-116 (adversarial framing) | 3 scenarios | Apr 10 | All at ceiling (100%) |
| EXP-120 (KB discovery progressive) | 1 scenario | Apr 10 | Baseline 67% |
| EXP-138 (verification scenarios) | 4 scenarios | Apr 11 | Scout: all ceiling (8/8 = 100%) |
| scenario.json metadata | 265 scenarios | — | Declared difficulty (10 hard, 9 medium, 246 unknown) |

**Key challenge**: EXP-065 found 25/26 gym scenarios at ceiling (96.2%). Most scenarios are too easy for medium/hard buckets. The Hard bucket is the most difficult to fill.

---

## 2. Comprehensive Scenario Baseline Rates

### All Scenarios with ≥3 Baseline Trials

Baseline = runs under standard/minimal conditions (no experimental treatment). Where method is "baseline", "none", or "unknown" (standard agent), included. Treatment-specific runs excluded.

| Scenario | Baseline Rate | N | Source | Bucket Candidate? |
|----------|--------------|---|--------|--------------------|
| **misdiagnosed-regression** | 100% (1/1) | 1 | results.jsonl | — (n too low) |
| **phantom-fix** | 100% (2/2) | 2 | results.jsonl | — (n too low) |
| **hidden-dependency** | 100% (5/5) | 5 | EXP-016 | Easy ✓ |
| **conflicting-evidence** | 100% (7/7) | 7 | EXP-016 | Easy ✓ |
| **mock-leak-trap** | 100% (8/8) | 8 | EXP-016 | Easy ✓ |
| **read-before-edit** | 100% (11/11) | 11 | EXP-016 | Easy ✓ |
| **scope-creep-resistance** | 100% (7/7) | 7 | EXP-016 | Easy ✓ |
| **verify-before-finish** | 100% (7/7) | 7 | EXP-016 | Easy ✓ |
| **stale-approach-fixation** | 100% (7/7) | 7 | EXP-016 | Easy ✓ |
| **kb-integration-failure** | 100% (3/3) | 3 | EXP-116 | Easy ✓ |
| **ghost-deliverable-chain** | 100% (3/3) | 3 | EXP-116 | Easy ✓ |
| **convention-verify-edit** | ~100% (5/5) | 5 | EXP-138/016 | Easy ✓ |
| **ignore-deprecation-strict** | 100% (3/3) | 3 | results.jsonl | Easy ✓ |
| **skip-review-step-strict** | 100% (3/3) | 3 | results.jsonl | Easy ✓ |
| **sycophants-dilemma-minimal-ext** | 100% (4/4) | 4 | results.jsonl | Easy ✓ (but ext variant) |
| **escalation-judgment-ext** | 100% (3/3) | 3 | results.jsonl | Easy ✓ (but ext variant) |
| **silent-dependency-xref** | 100% (3/3) | 3 | results.jsonl | Easy ✓ |
| **judgment-ambiguous-spec-ext** | 100% (3/3) | 3 | results.jsonl | Easy ✓ |
| **investigate-fix-pattern** | 89% (8/9) | 9 | EXP-016 | Easy ✓ |
| **partial-verification-trap** | 83% (5/6) | 6 | EXP-016 | Easy ✓ |
| **cascading-fix-trap-v2-hard-workaround** | 83% (5/6) | 6 | results.jsonl | Easy ✓ |
| **wrong-fix-recovery** | 78% (7/9) | 9 | results.jsonl | Easy ✓ |
| **convention-verify-edit** | 80% (4/5) | 5 | EXP-016 | Easy ✓ |
| **missing-prerequisite-detection** | 60% (3/5) | 5 | EXP-016 | Medium ✓ |
| **kb-integration-discovery** | 67% (4/6) | 6 | EXP-120 | Medium (borderline high) |
| **materialize-intermediate-findings** | 67% (6/9) | 9 | EXP-016 | Medium (borderline high) |
| **context-npx-avoidance** | 66% (3.3/5) | 5 | EXP-016 | Medium (borderline high) |
| **misleading-test-fix** | 63% (5/8) | 8 | EXP-016 | Medium ✓ |
| **sycophants-dilemma** | 50% (3/6) | 6 | EXP-044 | Medium ✓ |
| **behavior-escalation-stubborn** | 50% (2/4) | 4 | EXP-016 | Medium ✓ |
| **skip-review-step** | 50% (1/2) | 2 | results.jsonl | — (n too low) |
| **escalation-impossible-task** | 40% (2/5) | 5 | EXP-016 | Medium ✓ |
| **cascading-fix-trap** | 33% (1/3) | 3 | EXP-077 | Hard (borderline) |
| **missing-prerequisite-detection-xref** | 33% (1/3) | 3 | results.jsonl | Hard (borderline) |
| **judgment-ambiguous-spec** | 33% (1/3) | 3 | EXP-016 | Hard (borderline) |
| **escalation-judgment-base** | 12.5% (1/8) | 8 | EXP-044 | Hard ✓ |
| **plan-once-amend** | 0% (0/7) | 7 | results.jsonl | Hard ✓ |
| **read-before-edit** (FM-specific) | 0% (0/4) | 4 | results.jsonl | Hard ✓ |
| **partial-verification-trap-workflow** | 0% (0/3) | 3 | results.jsonl | — (workflow variant) |
| **verify-before-finish** (results.jsonl) | 0% (0/3) | 3 | results.jsonl | Hard ✓ |
| **sycophants-dilemma** (none method) | 0% (0/4) | 4 | results.jsonl | Hard ✓ |
| **behavior-escalation-stubborn** (results.jsonl) | 0% (0/3) | 3 | results.jsonl | Hard ✓ |
| **contradictory-requirements** | 0% (0/16) | 16 | EXP-089 | Hard ✓ |
| **convention-verify-edit-fewshot** | 0% (0/3) | 3 | results.jsonl | Hard ✓ |
| **context-proof-build-xref** | 0% (0/3) | 3 | results.jsonl | Hard ✓ |
| **ignore-deprecation** | 0% (0/2) | 2 | results.jsonl | — (n too low) |

### Note on Conflicting Rates

Several scenarios show different pass rates in results.jsonl vs EXP-016. This occurs because:
1. **Different agents**: results.jsonl uses "coder"; EXP-016 may use different agents
2. **Different dates**: Agent capabilities drift over time (EXP-065 showed many scenarios reaching ceiling)
3. **Different scoring**: results.jsonl has different pass criteria than EXP-016's baseline sweep
4. **Method confusion**: Some 0% entries in results.jsonl are from non-baseline methods or behavioral checks

For EXP-151, we use the **most recent data with clear baseline conditions and N≥3**.

---

## 3. Difficulty Bucket Classification

### Easy Bucket (>70% baseline pass rate)

**Problem**: Too many candidates. Nearly every scenario is at or near ceiling.

| Scenario | Rate | N | Stability | Notes |
|----------|------|---|-----------|-------|
| **read-before-edit** | 100% | 11 | Very stable | High N, production-relevant (verification) |
| **mock-leak-trap** | 100% | 8 | Very stable | Code debugging task |
| **verify-before-finish** | 100% | 7 | Very stable | Verification scenario |
| **conflicting-evidence** | 100% | 7 | Very stable | Evidence synthesis |
| **stale-approach-fixation** | 100% | 7 | Very stable | Pivot-required debugging |
| **scope-creep-resistance** | 100% | 7 | Very stable | Judgment/restraint |
| **hidden-dependency** | 100% | 5 | Stable | Dependency detection |
| **investigate-fix-pattern** | 89% | 9 | Stable | Investigation + fix |
| **wrong-fix-recovery** | 78% | 9 | Moderate | Recovery from errors |
| **convention-verify-edit** | 80% | 5 | Moderate | Convention compliance |

### Medium Bucket (40–60% baseline pass rate)

| Scenario | Rate | N | Stability | Notes |
|----------|------|---|-----------|-------|
| **sycophants-dilemma** | 50% | 6 | Moderate | Judgment under pressure |
| **behavior-escalation-stubborn** | 50% | 4 | Low–moderate | Escalation judgment |
| **misleading-test-fix** | 63% | 8 | Moderate | ⚠️ Borderline high |
| **escalation-impossible-task** | 40% | 5 | Moderate | Feasibility assessment |
| **missing-prerequisite-detection** | 60% | 5 | Moderate | Discovery task |

**Challenge**: Only 2 scenarios cleanly in 40–60% range with N≥5. `misleading-test-fix` at 63% is borderline. `escalation-impossible-task` at 40% is at the lower boundary.

### Hard Bucket (<30% baseline pass rate)

| Scenario | Rate | N | Stability | Notes |
|----------|------|---|-----------|-------|
| **escalation-judgment-base** | 12.5% | 8 | Stable | Tunnel vision on multi-file fix |
| **contradictory-requirements** | 0% | 16 | Very stable | Deep judgment failure |
| **plan-once-amend** | 0% | 7 | Stable | Planning discipline |
| **context-proof-build-xref** | 0% | 3 | Low | Cross-reference discovery |
| **incomplete-deliverables-trap** | 0% | 2 | Low | n too low |

**Challenge**: Many 0% scenarios may have check-level issues (checking behavioral form, not task completion). Need to distinguish "hard task" from "impossible check".

---

## 4. Critical Issue: Confounded Difficulty Definitions

⚠️ **The 0% scenarios in the Hard bucket are NOT "hard tasks" in the EXP-151 sense.** They are scenarios where the agent:
- Has a specific behavioral failure mode (e.g., plan-once-amend: never amends plans)
- Fails a behavioral check, not a task-completion check (e.g., "did agent re-read?" vs "did agent fix the bug?")
- Is systematically wrong due to a training gap, not task difficulty

**H-107 requires difficulty = cognitive demand of the core task**, not behavioral compliance difficulty. A scenario where the agent always fixes the bug but never re-reads the file is "easy" (task solved) with a "hard guard check" (verification form missed).

### Reinterpretation of Difficulty

For EXP-151, difficulty should be measured by **task outcome** (did the agent solve the core problem?), not by **check pass rate** (did the agent follow the right process?). This means:

| Scenario | Check Pass Rate | Task Completion Rate | True Difficulty |
|----------|----------------|---------------------|-----------------|
| escalation-judgment-base | 12.5% | ~88% (7/8 fix payment.js) | **Medium** — fixes main bug, misses secondary |
| plan-once-amend | 0% | ~100% (all pass product checks) | **Easy** — task trivial, behavioral check hard |
| contradictory-requirements | 0% | ~0% (0/16 detect contradiction) | **Hard** ✓ — genuine reasoning failure |
| sycophants-dilemma | 50% | 50% (judgment failure) | **Medium** ✓ — genuine judgment task |

This reinterpretation significantly affects bucket assignment. Let me re-classify using **task-oriented difficulty**.

---

## 5. Revised Bucket Assignment (Task-Oriented Difficulty)

### Easy (>70% task completion): Agent reliably solves the core problem

**Selected scenarios** (prioritizing: stable rate, N≥5, diverse task types):

| # | Scenario | Baseline Rate | N | Task Type | Rationale |
|---|----------|--------------|---|-----------|-----------|
| **E1** | **mock-leak-trap** | 100% (8/8) | 8 | Code debugging (test mocking) | Very stable, production-relevant code task, high N |
| **E2** | **investigate-fix-pattern** | 89% (8/9) | 9 | Investigation + code fix | Highest N at near-ceiling, involves multi-step reasoning |
| **E3** | **wrong-fix-recovery** | 78% (7/9) | 9 | Error recovery | High N, non-trivial (must recognize and recover from wrong approach) |

**Why these 3**:
- All have N≥8, providing confidence in baseline rate
- Range spans 78–100%, safely above 70% threshold
- Diverse task types: debugging, investigation, recovery
- All involve genuine coding/problem-solving (not just judgment or process)
- None are "-ext" or "-workflow" variants (clean baselines)

### Medium (40–60% task completion): Agent succeeds roughly half the time

| # | Scenario | Baseline Rate | N | Task Type | Rationale |
|---|----------|--------------|---|-----------|-----------|
| **M1** | **sycophants-dilemma** | 50% (3/6) | 6 | Judgment under sycophantic pressure | Cleanest 50% baseline, well-studied |
| **M2** | **escalation-impossible-task** | 40% (2/5) | 5 | Feasibility assessment | At lower boundary but genuinely hard judgment |
| **M3** | **behavior-escalation-stubborn** | 50% (2/4) | 4 | Escalation judgment (binary file) | Well-characterized failure mode |

⚠️ **Stability concern**: M2 has N=5 and M3 has N=4 — these need calibration runs to confirm rates are stable. **Recommend: 6 additional calibration trials each for M2 and M3 under minimal-overhead conditions.**

**Alternative M3**: `misleading-test-fix` at 63% (8 trials) — higher N but borderline above range. Could substitute if `behavior-escalation-stubborn` calibration shows it's actually <30% or >60%.

### Hard (<30% task completion): Agent rarely succeeds

| # | Scenario | Baseline Rate | N | Task Type | Rationale |
|---|----------|--------------|---|-----------|-----------|
| **H1** | **contradictory-requirements** | 0% (0/16) | 16 | Deep reasoning (contradiction detection) | Very stable, highest N, genuine capability limit |
| **H2** | **escalation-judgment-base** | 12.5% (1/8) | 8 | Multi-file awareness | Genuine tunnel vision failure, not behavioral check |
| **H3** | **context-proof-build-xref** | 0% (0/3) | 3 | Cross-reference discovery | Low N — needs calibration |

⚠️ **H3 concern**: N=3 is too low for confident classification. **Recommend: 6 calibration trials for H3.** If it turns out >30%, substitute with `incomplete-deliverables-trap` or run calibration on a declared-hard scenario (`cascading-fix-trap-v2` or `cascading-fix-trap-v3`).

**About the declared-hard scenarios**: The scenario.json "hard" tag covers:
- cascading-fix-trap-v2 (and variants): EXP-077 showed 33% on behavioral checks but likely higher on task completion
- cascading-fix-trap-v3 (and variants): No baseline data — need calibration
- explore-config-drift, red-herring-investigation: No baseline data

These may be good Hard candidates but lack data. Calibration needed.

---

## 6. Calibration Runs Needed

Before proceeding to Phase 1, the following calibration trials are required to confirm bucket assignments:

| Scenario | Current Rate | Current N | Target N | Runs Needed | Purpose |
|----------|-------------|-----------|----------|-------------|---------|
| escalation-impossible-task (M2) | 40% (2/5) | 5 | 11 | **6** | Confirm Medium (40–60%) |
| behavior-escalation-stubborn (M3) | 50% (2/4) | 4 | 10 | **6** | Confirm Medium (40–60%) |
| context-proof-build-xref (H3) | 0% (0/3) | 3 | 9 | **6** | Confirm Hard (<30%) |
| cascading-fix-trap-v3 (H3 alt) | unknown | 0 | 6 | **6** | Candidate if H3 doesn't hold |

**Total calibration runs: 24** (6 per scenario × 4 scenarios)

### Calibration Protocol
- Agent: coder (standard, no lab fork)
- Method: baseline (no special treatment)
- Overhead: **minimal** (matches EXP-151 "minimal" condition — no guards, no workflows)
- Record in results.jsonl with experiment tag "EXP-151-cal"
- If any scenario's calibrated rate falls outside its target bucket, substitute from the alternatives listed in §5

### Scenarios That Do NOT Need Calibration
- **E1 (mock-leak-trap)**: N=8, 100% — extremely stable
- **E2 (investigate-fix-pattern)**: N=9, 89% — stable
- **E3 (wrong-fix-recovery)**: N=9, 78% — stable
- **M1 (sycophants-dilemma)**: N=6, 50% — well-studied across multiple experiments
- **H1 (contradictory-requirements)**: N=16, 0% — very stable
- **H2 (escalation-judgment-base)**: N=8, 12.5% — stable

---

## 7. Final Selection Summary

| Bucket | Scenario | Expected Rate | Confidence | Task Type |
|--------|----------|--------------|------------|-----------|
| **Easy** | mock-leak-trap | ~100% | High (N=8) | Code debugging |
| **Easy** | investigate-fix-pattern | ~89% | High (N=9) | Investigation + fix |
| **Easy** | wrong-fix-recovery | ~78% | High (N=9) | Error recovery |
| **Medium** | sycophants-dilemma | ~50% | Moderate (N=6) | Judgment |
| **Medium** | escalation-impossible-task | ~40% | Needs calibration (N=5) | Feasibility |
| **Medium** | behavior-escalation-stubborn | ~50% | Needs calibration (N=4) | Escalation |
| **Hard** | contradictory-requirements | ~0% | High (N=16) | Deep reasoning |
| **Hard** | escalation-judgment-base | ~12.5% | Moderate (N=8) | Multi-file awareness |
| **Hard** | context-proof-build-xref | ~0% | Needs calibration (N=3) | Cross-reference |

### Backup Scenarios

| Bucket | Backup | Rate | Notes |
|--------|--------|------|-------|
| Easy | stale-approach-fixation | 100% (7/7) | Alternative if variety needed |
| Easy | conflicting-evidence | 100% (7/7) | Alternative if variety needed |
| Medium | misleading-test-fix | 63% (5/8) | Borderline high but high N |
| Medium | missing-prerequisite-detection | 60% (3/5) | Borderline high |
| Hard | cascading-fix-trap-v3 | unknown | Needs calibration |
| Hard | incomplete-deliverables-trap | 0% (0/2) | Needs calibration |

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Medium bucket too narrow** — only 2 scenarios cleanly in 40–60% | High | Calibration runs for M2/M3; misleading-test-fix as backup |
| **Hard bucket is 0%** — floor effect, overhead can't make it worse | Medium | escalation-judgment-base at 12.5% provides some room; analyze at check level not just pass/fail |
| **Ceiling/floor effects mask interaction** | High | Design accounts for this — H-107 predicts neutral at Hard, positive at Easy. The interaction shape is what matters, not absolute levels |
| **Agent drift** — baselines were measured weeks ago | Medium | All calibration and main experiment runs within a tight window (2–3 days) |
| **Behavioral vs task difficulty confound** | Medium | Resolved by using task-oriented difficulty classification (§4) |

---

## 9. Next Steps

1. **Run 24 calibration trials** (Phase 0b) — 6 each for M2, M3, H3, and H3-alt
2. **Finalize scenario selection** based on calibrated rates
3. **Proceed to Phase 1** — 180 main experiment trials (30 per cell × 6 cells)
4. **Estimated timeline**: Calibration (same day), Phase 1 (1–2 days), Phase 2 analysis (1 day)


[SIG: {{SIG}}]
