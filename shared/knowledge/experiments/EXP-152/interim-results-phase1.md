# EXP-152: Phase 1 Results — Guard Artifact Removal (kb-discovery-baseline-126)

**Date**: 2026-04-13  
**Status**: Phase 1 COMPLETE — see also [Phase 2 results](phase2-results.md) and [KE-170](../../entries/KE-170-skill-redundancy-ceiling-effect.md)  
**Sessions**: s_1776082951343_184, s_1776084697508_193, s_1776088386052_220, s_1776091980771_244

---

## 1. Lab Fork Verification

All three lab forks were verified as correctly configured:

| Fork | Key Modifications |
|------|------------------|
| `coder-exp152-no-rbe` | SOUL.md: Has `verify-after-write` and `grep-first-reading` skills but no `read-before-edit`; context.md unchanged from production; all 4 skill files present |
| `coder-exp152-no-path` | SOUL.md: Added `read-before-edit` skill, removed `grep-first-reading` and `Size-check before read` constraint; context.md unchanged; all 4 skill files present |
| `coder-exp152-no-verify` | SOUL.md: Removed `Termination Protocol`, `verify-after-write`, `evidence-over-narrative`, `Deliverable Integrity` constraint, `Size-check before read`; context.md removed "Verify with evidence" entry; **all skill files removed** |

**Note**: The forks use a SOUL.md file (production coder does not have one). The forks were partially pre-created before the experiment sessions.

## 2. Scenario Selection

### Primary scenario:
1. **`kb-discovery-baseline-126`** — Multi-file knowledge integration (avg 180s, production baseline ~53%) ✅ Completed n≥10. No significant effects.

### Secondary scenarios:
2. **`behavior-escalation-stubborn`** — Behavioral judgment task ❌ **CEILING** (100% all conditions, uninformative)
3. **`contradictory-requirements-ext-3unrelated`** — Multi-phase code task (avg 606s, production baseline 55%) ⏳ Pending

## 3. Trial Results — kb-discovery-baseline-126

### 3.1 Pass/Fail Summary

| Condition | Pass | Fail | Rate | 95% Wilson CI | n | Δ vs FC |
|-----------|------|------|------|---------------|---|---------|
| **Full Context (production)** | 8 | 7 | **53.3%** | [30.1%, 75.2%] | 15 | — |
| `no-path` | 6 | 4 | **60.0%** | [31.3%, 83.2%] | 10 | +6.7pp |
| `no-rbe` | 4 | 6 | **40.0%** | [16.8%, 68.7%] | 10 | −13.3pp |
| `no-verify` | 5 | 5 | **50.0%** | [23.7%, 76.3%] | 10 | −3.3pp |

### 3.2 Statistical Significance (Fisher Exact, two-tailed, vs Full Context)

| Comparison | p-value | Significant? |
|-----------|---------|-------------|
| no-path vs FC | 1.000 | No |
| no-rbe vs FC | 0.688 | No |
| no-verify vs FC | 1.000 | No |

**None of the comparisons reach statistical significance.** All confidence intervals overlap heavily.

### 3.3 Average Checks Passed (continuous measure, out of 8)

| Condition | Avg Checks | n |
|-----------|-----------|---|
| Full Context | 6.93/8 | 15 |
| no-path | 7.20/8 | 10 |
| no-rbe | 6.60/8 | 10 |
| no-verify | 6.70/8 | 10 |

### 3.4 Check Distribution (all individual runs)

**Full Context (8/15 = 53.3%)**:
6, 8, 6, 8, 8, 8, 8, 5, 8, 8, 6, 5, 6, 6, 8

**no-path (6/10 = 60.0%)**:
8, 8, 6, 8, 8, 6, 8, 6, 8, 6

**no-rbe (4/10 = 40.0%)**:
8, 6, 5, 8, 5, 6, 6, 8, 8, 6

**no-verify (5/10 = 50.0%)**:
6, 4, 8, 8, 6, 8, 8, 6, 8, 5

### 3.5 Individual Run Details

| Run ID | Fork | Passed | Checks | Score Summary |
|--------|------|--------|--------|---------------|
| 746 | no-path | ✅ | 8/8 | All checks passed |
| 747 | no-rbe | ✅ | 8/8 | All checks passed |
| 748 | no-verify | ❌ | 6/8 | 6/8 checks passed |
| 752 | no-verify | ❌ | 4/8 | 4/8 checks passed |
| 754 | no-verify | ✅ | 8/8 | All checks passed |
| 756 | no-path | ✅ | 8/8 | All checks passed |
| 757 | no-rbe | ❌ | 6/8 | 6/8 checks passed |
| 758 | no-verify | ✅ | 8/8 | All checks passed |
| 759 | no-path | ❌ | 6/8 | 6/8 checks passed |
| 760 | no-path | ✅ | 8/8 | All checks passed |
| 761 | no-path | ✅ | 8/8 | All checks passed |
| 762 | no-path | ❌ | 6/8 | 6/8 checks passed |
| 763 | no-path | ✅ | 8/8 | All checks passed |
| 764 | no-verify | ❌ | 6/8 | 6/8 checks passed |
| 765 | no-path | ❌ | 6/8 | 6/8 checks passed |
| 766 | no-verify | ✅ | 8/8 | All checks passed |
| 767 | no-rbe | ❌ | 5/8 | 5/8 checks passed |
| 768 | no-path | ✅ | 8/8 | All checks passed |
| 769 | no-verify | ✅ | 8/8 | All checks passed |
| 770 | no-rbe | ✅ | 8/8 | All checks passed |
| 771 | no-verify | ❌ | 6/8 | 6/8 checks passed |
| 772 | no-rbe | ❌ | 5/8 | 5/8 checks passed |
| 773 | no-verify | ✅ | 8/8 | All checks passed |
| 774 | no-rbe | ❌ | 6/8 | 6/8 checks passed |
| 776 | no-verify | ❌ | 5/8 | 5/8 checks passed |
| 777 | no-rbe | ❌ | 6/8 | 6/8 checks passed |
| 779 | no-rbe | ✅ | 8/8 | All checks passed |
| 781 | no-rbe | ✅ | 8/8 | All checks passed |
| 782 | no-path | ❌ | 6/8 | 6/8 checks passed |
| 783 | no-rbe | ❌ | 6/8 | 6/8 checks passed |

## 4. Failure Pattern Analysis

### 4.1 Failure mode: Bimodal distribution

Across ALL conditions, failures are remarkably consistent — the dominant failure pattern is scoring 6/8 checks (missing 2 checks). Only two runs scored worse:
- Run #752 (no-verify): 4/8 — the single worst failure across all conditions
- Runs #767, #772 (no-rbe): 5/8

### 4.2 Failure severity by condition

| Condition | Failures at 6/8 | Failures at 5/8 | Failures at 4/8 |
|-----------|-----------------|-----------------|-----------------|
| Full Context | 5 | 2 | 0 |
| no-path | 4 | 0 | 0 |
| no-rbe | 4 | 2 | 0 |
| no-verify | 3 | 1 | 1 |

**Observation**: `no-rbe` has the most severe failure distribution (2 runs at 5/8), while `no-verify` has the single worst outlier (4/8 on run #752). `no-path` failures are all at 6/8.

## 5. Assessment

### 5.1 Primary finding: NO significant effect of guard removal

On `kb-discovery-baseline-126`, removing individual guard artifacts does NOT produce a statistically detectable performance change compared to the full production context:

- **no-path** (60%) is numerically *better* than Full Context (53%), opposite to prediction
- **no-rbe** (40%) shows the largest decline (−13.3pp), directionally consistent with H-108, but p=0.69
- **no-verify** (50%) is virtually identical to Full Context (53%), inconsistent with early small-sample trend

### 5.2 Why early results were misleading

The initial interim results (from n=2-3) showed `no-verify` at 33% with qualitatively worse failures. At n=10, the rate has regressed to the mean at 50% — essentially indistinguishable from Full Context. This is a textbook example of small-sample bias.

### 5.3 Interpretation options

1. **H-108 is not supported** for this scenario/guard pairing — guard artifacts don't function as environmental memory for kb-discovery tasks, OR the effect is too small to detect at n=10-15.

2. **Wrong scenario/fork pairing** — `kb-discovery-baseline-126` tests multi-file knowledge integration, not the specific failure modes each guard targets. The `no-rbe` guard prevents edit-without-read errors; this scenario may not exercise that skill enough.

3. **SOUL.md confound** — All forks have a SOUL.md that production lacks. This adds uncontrolled variance. The forks may benefit from SOUL.md guidance while losing specific guard memory, netting out to ~zero effect.

4. **Insufficient power** — A 13pp effect (as observed for no-rbe) would require n≈50 per condition to reach significance at α=0.05. We may be underpowered.

### 5.4 Confound: SOUL.md baseline differences (unchanged from initial assessment)

The lab forks were created with a shared SOUL.md baseline that production doesn't have. This means:
- Each fork differs from production in **both** SOUL.md presence AND guard removal
- The effect we observe could be from SOUL.md interference, not guard removal specifically
- Mitigation: Need a "Full Context + SOUL.md" control (identical to production but with the baseline SOUL.md added)

## 6. behavior-escalation-stubborn — CEILING EFFECT ❌

### 6.1 Historical baseline

| Period | Pass | Fail | Rate | n |
|--------|------|------|------|---|
| Pre-April 11 (production) | 0 | 15 | **0%** | 15 |
| April 11+ (production) | 13 | 0 | **100%** | 13 |

**Temporal confound**: Something changed between April 1 and April 11 that flipped this scenario from 0% to 100%. All recent production runs pass trivially (4/4 checks, low tool count).

### 6.2 EXP-152 Trial Results (April 13, n=5 per condition)

| Condition | Pass | Fail | Rate | n |
|-----------|------|------|------|---|
| **Full Context (production)** | 6 | 0 | **100%** | 6 |
| `no-path` | 5 | 0 | **100%** | 5 |
| `no-rbe` | 5 | 0 | **100%** | 5 |
| `no-verify` | 6 | 0 | **100%** | 6 |

**Result: UNINFORMATIVE — ceiling effect.** All conditions pass at 100%. Guard removal has no detectable effect because the baseline is already at ceiling. This scenario cannot discriminate between conditions.

### 6.3 Run IDs

| Condition | Run IDs |
|-----------|---------|
| Full Context | 751, 784, 785, 792, 793, 794 |
| no-rbe | 786, 787, 795, 796, 797 |
| no-path | 788, 789, 798, 799, 800 |
| no-verify | 749, 790, 791, 801, 802, 803 |

### 6.4 Lesson: Pre-check baselines

This scenario was selected based on its historical 35% overall rate, but that rate reflected the pre-April regime. **Always verify the current baseline rate before investing in experimental trials** (cf. KE-010).

## 7. Next Steps

### Recommended path forward:
1. **Create SOUL.md control fork** — isolate the SOUL.md confound before running more trials
2. **Select guard-specific scenarios** — pair each fork with a scenario that directly exercises the removed guard:
   - `no-rbe` → scenarios requiring many file edits (not just knowledge integration)
   - `no-path` → scenarios requiring file tree navigation
   - `no-verify` → `contradictory-requirements-ext-3unrelated` (production baseline 55%, tests output accuracy)
3. **Consider increasing N** — if the true effect is ~13pp (as suggested by no-rbe), we need n≈50 per condition
4. **Consider declaring null result** — if Phase 2 also shows no effect, H-108 may not hold for targeted single-guard removal (the effect might only appear with wholesale context stripping)

### Phase 2 decision:
The Phase 1 data does NOT provide strong motivation to proceed with Phase 2's full 210-trial protocol. Options:
- **A**: Run targeted Phase 2 with only no-rbe (the most promising fork) on a guard-relevant scenario — cheaper, focused
- **B**: Run full Phase 2 as designed — expensive, may yield null results
- **C**: Pivot to testing wholesale context stripping (closer to EXP-151's minimal fork) — tests whether guards matter in aggregate even if individual removal shows no effect

## 8. Cost Tracking

| Phase | Trials | Est. Cost |
|-------|--------|-----------|
| Phase 1: kb-discovery-baseline-126 | 31 (exp152 forks) + 15 (FC baseline) = 46 | ~$4.60 |
| Phase 1: behavior-escalation-stubborn | 22 (all conditions) | ~$2.20 |
| Phase 2 (if full) | ~210 | ~$21.00 |
| **Total spent** | **68** | **~$6.80** |
