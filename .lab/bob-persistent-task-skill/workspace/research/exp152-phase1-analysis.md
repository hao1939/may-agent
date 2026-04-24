# EXP-152 Phase 1 Analysis — Guard Artifact Removal Calibration

**Date**: 2026-04-13  
**Author**: Bob  
**Source**: agents/shared/knowledge/experiments/EXP-152/interim-results-phase1.md

---

## 1. Summary

EXP-152 Phase 1 ran 45 trials (15 Full Context + 10 per removal fork) on `kb-discovery-baseline-126`. **No statistically significant effect of targeted guard removal was detected.** All p-values > 0.68.

| Condition | Pass Rate | Δ vs Full Context | p (Fisher) |
|-----------|-----------|-------------------|------------|
| Full Context | 53.3% (8/15) | — | — |
| no-path | 60.0% (6/10) | +6.7pp | 1.000 |
| no-rbe | 40.0% (4/10) | −13.3pp | 0.688 |
| no-verify | 50.0% (5/10) | −3.3pp | 1.000 |

## 2. Key Findings

### 2.1 Null result is clean and informative

This is **not** a power failure masking a real effect. The results are genuinely uninformative:
- The largest effect (no-rbe, −13.3pp) is directionally consistent with H-108, but the confidence intervals are enormous (Wilson CI: [16.8%, 68.7%] for no-rbe vs [30.1%, 75.2%] for FC — massive overlap).
- The no-path condition is **numerically better** than Full Context, opposite to prediction.
- The continuous measure (avg checks: 6.60–7.20 out of 8) shows even less variation than the binary pass/fail.

### 2.2 Scenario-guard mismatch

The critical issue: `kb-discovery-baseline-126` is a **knowledge integration** task, not a task that specifically exercises the failure modes each guard prevents:
- `no-rbe` removes read-before-edit protection → but kb-discovery may not require many edit operations
- `no-path` removes path hallucination prevention → but the scenario may use predictable paths  
- `no-verify` removes verification guards → but the scoring checks binary outputs, not verification quality

**The design called for pairing each fork with a guard-specific scenario (§3.4)**, but Phase 1 ran all forks against a single general scenario. This is a scenario selection problem, not a theory problem.

### 2.3 SOUL.md confound is serious

All forks use a SOUL.md file that production coder doesn't have. This adds uncontrolled variance — the SOUL.md may compensate for missing guards, or may create its own overhead. Without a "Full Context + SOUL.md" control, we can't isolate the guard removal effect from the SOUL.md addition.

### 2.4 Bimodal failure pattern

Across all conditions, failures cluster at 6/8 checks (the dominant failure mode is always the same 2 missing checks). This suggests a **scenario-level bottleneck** — certain checks are hard regardless of context configuration. The guard removal doesn't change *which* checks fail, only (slightly) how often.

## 3. What This Means for H-108

### H-108 is NOT falsified.

The Phase 1 design doesn't meet H-108's own falsification criteria (§6.6 of design.md):
- H-108 is falsified if "Targeted Removal ≈ Full Context on guard-relevant tasks AND error recurrence analysis shows no increase in guard-specific errors after removal AND retrospective analysis shows no before/after effect."
- Phase 1 tested on a **general** task, not guard-relevant tasks specifically.
- No error recurrence analysis was performed (were there more edit-without-read errors in no-rbe? more path hallucination in no-path?).
- No retrospective analysis was conducted.

### H-108's P(H) should decrease slightly

The null result on a general task is weak negative evidence. The strongest signal (no-rbe at −13.3pp) is directionally consistent but far from significant. Update: **P(H) 0.55 → 0.50**. Rationale:
- The theory predicted that removing guards should degrade performance. On 2/3 conditions, there's no degradation at all.
- BUT the scenario wasn't specifically designed to exercise the removed guards, so this is weak evidence.
- The SOUL.md confound further weakens any inference.

## 4. Recommendations for Phase 2

### Option A: Targeted fork-scenario pairing (RECOMMENDED)

Run each fork against a scenario that specifically exercises the failure mode the removed guard prevents:
- `no-rbe` → a scenario requiring extensive file editing (where edit-without-read would cause failures)
- `no-path` → a scenario requiring navigating unfamiliar file trees
- `no-verify` → `contradictory-requirements-ext-3unrelated` (55% baseline, requires accurate output)

Plus: create a SOUL.md control fork to isolate the confound. N=15-20 per cell.

**Cost**: ~$6-10. **Information value**: HIGH — directly tests the mechanism.

### Option B: Declare Phase 1 inconclusive, pivot to retrospective

Skip prospective Phase 2. Instead, leverage the existing natural experiment data:
- Query `.state/may.db` for sessions before/after guard additions (EXP-110, EXP-132 data exists)
- Interrupted time series analysis on error rates
- Much cheaper, higher ecological validity, but weaker causal inference

**Cost**: ~$0 (database queries only). **Information value**: MODERATE.

### Option C: Stop and record null result

Record Phase 1 as KE-169 (null result on general task), downgrade H-108 to P(H) 0.50, and redirect effort to more promising lines (e.g., H-105 Three-Layer Reasoning, or Phase 3 retrospective only).

**Cost**: $0. **Information value**: LOW (but saves resources for other work).

### My recommendation: Option A with smaller scope

Run targeted scenarios for `no-rbe` and `no-verify` only (drop `no-path` which showed no signal). N=15 per cell. Add SOUL.md control. Total: ~45 trials, ~$4.50. This gives the strongest test of the mechanism while keeping costs low. If this also yields null results, H-108 should be downgraded to P(H) 0.40.

## 5. Connection to Broader Research

This result joins EXP-151 (H-107, also inconclusive) in suggesting that **guard effects are subtle and scenario-specific**. The pattern emerging across both experiments:

- **EXP-151**: Overhead effect inconclusive across all difficulty levels (159 trials, all p>0.70)
- **EXP-152 Phase 1**: Guard removal effect inconclusive on general task (45 trials, all p>0.68)

Combined interpretation: Individual guards may have effects too small to detect at reasonable sample sizes (~10-20pp), OR the effects are real but only manifest on **specifically matched** tasks — suggesting guard value is highly contextual, not universal.

This is actually consistent with KE-143 (guard redundancy finding) and the overall externalization literature: environmental artifacts matter most in specific contexts (capacity-constrained agents, downstream consumers, guard-relevant failure modes), not as a universal overhead/benefit.
