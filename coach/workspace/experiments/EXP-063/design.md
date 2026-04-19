# EXP-063: Training Sprint — Externalization Expansion + Fresh Baselines

**Date**: 2026-04-07
**Status**: COMPLETED
**Sprint**: 25

## Rationale

FM-3.3 thread closed (EXP-061). 20/21 tested scenarios are ceiling. The only proven training intervention is forced externalization (H-085: 84% pass rate, N=35). This sprint expands externalization to new scenario categories and baselines fresh judgment scenarios.

## Phase 1: Fresh Baselines (5 judgment/diagnosis scenarios)

These scenarios are untested and likely non-ceiling based on category:

| # | Scenario | Category | Why Selected |
|---|----------|----------|-------------|
| 1 | conflicting-evidence | judgment | Must weigh contradictory signals — model weakness |
| 2 | premature-optimization | judgment/restraint | Must resist urge to optimize — restraint scenario |
| 3 | regression-from-fix | bug-fixing | Must notice fix caused new regression |
| 4 | triage-ambiguous-cleanup | judgment | Must triage ambiguous work |
| 5 | red-herring-investigation | root-cause | Must avoid red herrings (similar to wrong-fix-recovery) |

**Method**: 1 baseline run each with production coder.

## Phase 2: Externalization Treatment (on non-ceiling from Phase 1)

For each non-ceiling scenario from Phase 1:
- Create `-ext` variant with forced ANALYSIS.md before implementation
- Run 2 treatment runs
- Compare with baseline

## Lab Forks Created

### 1. `exp-wrong-fix-skill` — Root Cause Diagnosis Skill
- **File**: `skills/root-cause-diagnosis.md` (48 lines)
- **Target**: wrong-fix-recovery (baseline 2/6)
- **Method**: Skill #4 — teaches trace-from-assertion diagnosis protocol
- **Status**: READY (created but already tested in EXP-021, scored 3/6 — marginal)

### 2. `exp-wrong-fix-workflow` — Workflow Enforcement
- **File**: `context.md` with two-phase diagnosis protocol
- **Target**: wrong-fix-recovery (baseline 2/6)
- **Method**: Workflow #15 — mandatory DIAGNOSE → FIX phases
- **Status**: READY (created but already tested in EXP-022, scored 3/6 — marginal)

### 3. `fm33-externalization` (pre-existing)
- **Target**: Any non-ceiling judgment scenario
- **Method**: Forced externalization (H-085)
- **Status**: READY

## Execution Order

1. Run Phase 1 baselines (5 runs)
2. Score results, identify non-ceiling
3. Create -ext variants for non-ceiling scenarios
4. Run Phase 2 treatments (2-4 runs)
5. Record results

## Phase 1 Results — ALL CEILING

| # | Scenario | Score | Duration | Result |
|---|----------|-------|----------|--------|
| 1 | conflicting-evidence | 7/7 | 102s | CEILING ✅ |
| 2 | premature-optimization | 5/5 | 180s | CEILING ✅ |
| 3 | regression-from-fix | 6/6 | 148s | CEILING ✅ |
| 4 | triage-ambiguous-cleanup | 9/9 | 121s | CEILING ✅ |
| 5 | red-herring-investigation | 5/5 | 109s | CEILING ✅ |

**Total: 32/32 criteria passed across 5 scenarios (100%)**

### Analysis

All 5 new scenarios hit ceiling on first run. This extends the ceiling count from 20/21 to **25/26** tested scenarios. Phase 2 (externalization treatment) is moot — there are no non-ceiling scenarios to treat.

### Key Evidence: KE-010 (Gym Scenario Saturation) — STRONGLY CONFIRMED

The gym is saturated. Every new scenario we add hits ceiling immediately. The coder's current skill set handles:
- Judgment/restraint (premature-optimization, triage-ambiguous-cleanup)
- Investigation/red-herrings (red-herring-investigation)
- Regression awareness (regression-from-fix)
- Conflicting evidence resolution (conflicting-evidence)

The remaining 1/26 failure is `wrong-fix-recovery` (2/6), which has resisted multiple interventions.

### Recommendation

1. **Stop adding standard gym scenarios** — they all hit ceiling
2. **Focus wrong-fix-recovery** — the only sub-ceiling scenario, likely needs scenario redesign not agent training
3. **Consider harder scenario design** — multi-step workflows, adversarial setups, longer horizon tasks
4. **Graduate the gym** — declare current gym scenarios as regression tests, not training exercises

## Notes

- The forks `exp-wrong-fix-skill` and `exp-wrong-fix-workflow` were created this session but their experiments (EXP-021, 022) already ran in Sprint 8. Keeping them for reference.
- The main NEW work is Phase 1 fresh baselines.
- If all 5 baselines are ceiling (consistent with KE-010), this confirms gym scenario saturation.
