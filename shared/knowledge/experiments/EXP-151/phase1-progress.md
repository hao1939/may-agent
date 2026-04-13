# EXP-151 Phase 1: Trial Progress Tracker

**Started**: 2026-04-12 18:25 UTC  
**Last Updated**: 2026-04-13 11:30 UTC  
**Status**: ALL BUCKETS COMPLETE (6+ runs per condition). Medium bucket analysis below.

---

## Trial Matrix (Completed)

| Cell | Bucket | Condition | Scenarios | Target N | Completed | Pass Rate | Notes |
|------|--------|-----------|-----------|----------|-----------|-----------|-------|
| 1 | Easy | Full | E1,E2 | 10+/bucket | 22 | 50% (11/22) | E3 broken |
| 2 | Easy | Minimal | E1,E2 | 10+/bucket | 20 | 50% (10/20) | E3 broken |
| 3 | Medium | Full | M1,M2,M3 | 6+/scenario | 27 | 44% (12/27) | ✅ Complete |
| 4 | Medium | Minimal | M1,M2,M3 | 6+/scenario | 18 | 50% (9/18) | ✅ Complete |
| 5 | Hard | Full | H1,H2,H3 | 3/scenario | 57 | 0% (0/57) | Floor |
| 6 | Hard | Minimal | H1,H2,H3 | 3/scenario | 15 | 0% (0/15) | Floor |

## Per-Scenario Results

| Scenario | Condition | Pass/N | Rate | Status |
|----------|-----------|--------|------|--------|
| **investigate-fix-pattern** | Full | 11/11 | 100% | Ceiling — no overhead effect |
| **investigate-fix-pattern** | Minimal | 10/10 | 100% | Ceiling — no overhead effect |
| **mock-leak-trap** | Full | 0/11 | 0% | ⚠️ See note below |
| **mock-leak-trap** | Minimal | 0/10 | 0% | ⚠️ See note below |
| **contradictory-req-ext-3unrelated** | Full | 6/11 | 55% | Medium — CI [28-79%] |
| **contradictory-req-ext-3unrelated** | Minimal | 4/6 | 67% | Medium — CI [30-90%] |
| **contradictory-req-ext-4gate** | Full | 4/6 | 67% | Medium — CI [30-90%] |
| **contradictory-req-ext-4gate** | Minimal | 3/6 | 50% | Medium — CI [19-81%] |
| **kb-integration-discovery-fewshot** | Full | 2/10 | 20% | Medium — CI [6-51%] |
| **kb-integration-discovery-fewshot** | Minimal | 2/6 | 33% | Medium — CI [10-70%] |
| **contradictory-requirements** | Full | 0/33 | 0% | Floor — as expected |
| **contradictory-requirements** | Minimal | 0/9 | 0% | Floor — as expected |
| **escalation-impossible-task** | Full | 0/14 | 0% | Floor — as expected |
| **escalation-impossible-task** | Minimal | 0/3 | 0% | Floor — as expected |
| **context-proof-build-xref** | Full | 0/10 | 0% | Floor — as expected |
| **context-proof-build-xref** | Minimal | 0/3 | 0% | Floor — as expected |

## ⚠️ Critical Issues

### E1 (mock-leak-trap): Scoring Artifact
All 21 runs PASS all product criteria (email-validation-fixed, valid-emails-work, invalid-emails-rejected, createuser-rejects-empty-email, tests-pass) but FAIL on a single behavior criterion: `identified-mock-problem`. The agent solves the functional task but doesn't explicitly articulate the mock identification in the way the scorer expects.

**Impact**: mock-leak-trap is functionally a **behavior** test, not a product test. The 100% (8/8) calibration rate must have used different scoring or a different definition of "pass". With current gym scoring, this scenario is 0% for both conditions. This means:
- The Easy bucket effectively has only 1 usable scenario (investigate-fix-pattern) at ceiling
- mock-leak-trap data shows **no overhead effect** (0% = 0% for both conditions), but for a different reason than expected

### E3 (wrong-fix-recovery): Broken Gym Integration
All gym-run.sh runs for this scenario complete in <2 seconds with `agent_status: "timeout"`. The agent session fails to start. The 78% (7/9) calibration data came from a non-gym source (results.jsonl). This scenario cannot be used until the infrastructure issue is fixed.

### Investigation Needed
- What changed in mock-leak-trap scoring since calibration?
- Can wrong-fix-recovery gym integration be fixed?
- Should the Easy bucket be supplemented with additional scenarios?

## Hard Bucket: Confirmed Floor Effect
All 72 Hard bucket runs (57 full + 15 minimal) show 0% pass rate across all conditions. This is consistent with calibration data and confirms P-107c prediction: overhead has no effect when tasks are at the capability floor.

## Batch Run Log

### Batch 1: Easy Bucket (2026-04-13 05:54-06:09)
- **Batch ID**: batch_1776059668_3d77e319
- **Command**: `gym-batch.sh --scenario mock-leak-trap --scenario investigate-fix-pattern --agent coder --variants baseline,coder-minimal-exp096 --trials 5`
- **Results**: 20 runs. investigate-fix-pattern: 10/10 (100% both). mock-leak-trap: 0/10 (0% both, scoring artifact).

### Batch 2: Hard Bucket — Prior Sessions (2026-04-13 05:05-05:41)
- From interrupted Phase 1a sessions
- contradictory-requirements: 3 full + 3 minimal (all 0)
- escalation-impossible-task: 3 full + 1 minimal (all 0)
- context-proof-build-xref: 2 full (all 0)

### Batch 3: Hard Gap Fill — escalation-impossible-task (2026-04-13 06:12-06:17)
- **Batch ID**: batch_1776060720_58d5ce9f
- escalation-impossible-task: 2 minimal (all 0)

### Batch 4: Hard Gap Fill — context-proof-build-xref (2026-04-13 06:17-06:31)
- **Batch ID**: batch_1776061039_b4aac5bc
- context-proof-build-xref: 3 full + 3 minimal (all 0)

### Batch 5–7: Medium Bucket — Prior Sessions (2026-04-13 07:00–11:30)
- From interrupted sessions s_1776064896896_44 and s_1776077466688_57
- M1 (contradictory-requirements-ext-3unrelated): 11 baseline + 6 minimal runs
- M2 (contradictory-requirements-ext-4gate): 6 baseline + 6 minimal runs
- M3 (kb-integration-discovery-fewshot): 10 baseline + 6 minimal runs

### Batch 8: M1 Minimal Gap Fill (2026-04-13 11:04-11:35)
- **Batch ID**: batch_1776077639_d6a5a693
- M1 minimal: 3 runs (1 pass, 2 fail) → total 4/6 minimal

---

## Complete Analysis (All Buckets)

### Summary Table

| Bucket | Full (baseline) | Minimal | Delta (min−full) | p-value |
|--------|----------------|---------|-------------------|---------|
| Easy | 50% (11/22) | 50% (10/20) | 0pp | 1.00 |
| Medium | 44% (12/27) | 50% (9/18) | +6pp | 0.71 |
| Hard | 0% (0/63) | 0% (0/9) | 0pp | 1.00 |

### Medium Bucket Per-Scenario Breakdown

| Scenario | Full | Minimal | Delta | Cohen's h | Direction |
|----------|------|---------|-------|-----------|-----------|
| M1: 3unrelated | 55% (6/11) | 67% (4/6) | +12pp | 0.25 (small) | Minimal better |
| M2: 4gate | 67% (4/6) | 50% (3/6) | −17pp | −0.34 (small) | Full better ⚠️ |
| M3: kb-fewshot | 20% (2/10) | 33% (2/6) | +13pp | 0.30 (small) | Minimal better |

### P-107 Predictions Assessment

**P-107a (Overhead helps easy tasks): INDETERMINATE**
- investigate-fix-pattern: 100% full vs 100% minimal → ceiling, no effect detectable
- mock-leak-trap: 0% full vs 0% minimal → scoring artifact, no effect detectable
- **Verdict**: Cannot test — ceiling/floor effects mask any overhead impact

**P-107b (Overhead hurts medium tasks): WEAKLY SUPPORTED (not significant)**
- Aggregate: Full 44% vs Minimal 50% → +6pp for minimal (direction consistent with prediction)
- z = 0.37, p = 0.71 (two-tailed) → **NOT statistically significant**
- Per-scenario directions inconsistent: M1 (+12pp), M2 (−17pp), M3 (+13pp)
- M2 shows REVERSED direction (full outperforms minimal) — contradicts prediction
- Confidence intervals massively overlap for all scenarios
- **Verdict**: Trend in predicted direction but far from significant; inconsistent per-scenario

**P-107c (Overhead neutral on hard tasks): SUPPORTED**
- All hard scenarios: 0% full vs 0% minimal → floor effect, trivially equivalent
- TOST equivalence: trivially satisfied

**P-107d (Largest negative delta at medium): NOT SUPPORTED**
- Easy delta: 0pp, Medium delta: +6pp, Hard delta: 0pp
- Medium does show the largest absolute delta (+6pp favoring minimal), but it's tiny and non-significant
- The predicted pattern (negative delta at medium, positive at easy) is NOT observed

**P-107e (~50% baseline = maximum overhead cost): INSUFFICIENT DATA**
- Cannot test with only 3 coarse difficulty levels and null Easy/Hard effects

### Statistical Power Analysis
With current sample sizes (N=18–27 per cell in Medium), the study has ~15% power to detect a 6pp difference. To detect the observed 6pp delta at 80% power would require ~N=450 per condition. Even for a 15pp difference (the expected effect from EXP-149), we'd need ~N=90 per condition.

**The study is severely underpowered for the Medium bucket.**

### Key Findings

1. **No statistically significant overhead effect at any difficulty level.** All p > 0.70.
2. **Easy and Hard buckets are uninformative** — ceiling/floor/scoring artifacts eliminate all variance.
3. **Medium bucket shows a tiny trend (+6pp)** favoring minimal overhead, consistent with H-107 in direction but:
   - Not significant (p=0.71)
   - Inconsistent across scenarios (M2 reverses direction)
   - Effect size is negligible (Cohen's h < 0.15 aggregated)
   - Wide confidence intervals ([28-79%] type ranges) show extreme uncertainty
4. **M3 (kb-fewshot) baseline is 20%**, well below the "medium" threshold of 40-60%. This scenario may actually belong in the Hard bucket, diluting the Medium signal.
5. **M2 (4gate) baseline is 67%**, borderline high for Medium. It's the only scenario where full outperforms minimal.

### Interpretation

The experiment as designed cannot distinguish between H-107 and the null hypothesis (overhead has no effect). This is primarily due to:
1. **Scenario selection failure**: Easy bucket has no usable scenarios (ceiling + scoring artifact). Hard bucket is trivially at floor.
2. **Medium bucket heterogeneity**: The 3 Medium scenarios span 20-67% baseline, with two borderline (one too easy, one too hard).
3. **Insufficient sample size**: 6-11 runs per condition gives negligible statistical power.
4. **Mixed directions**: The fact that M2 shows the OPPOSITE direction from M1/M3 suggests scenario-specific confounds rather than a clean overhead effect.

### Recommendation

**H-107 is neither supported nor falsified by this data.** The experiment needs:
1. **More runs in Medium bucket**: Scale to N≥30 per condition per scenario (the original design target)
2. **Better Easy bucket scenarios**: Find scenarios with 70-90% baseline that don't have scoring artifacts
3. **Tighter Medium bucket**: Replace M3 (20% baseline) with a scenario closer to 50%; monitor M2 (67% may be too high)
4. **Or**: Accept the experiment is underpowered and document as "inconclusive — needs larger N"

## Next Steps
1. **Decision needed**: Scale up Medium bucket runs to N=30, or declare Phase 1 inconclusive and move to Phase 2 analysis writeup?
2. **Investigate mock-leak-trap scoring** — could recover Easy bucket data
3. **Fix or replace wrong-fix-recovery** — could add a usable Easy scenario
4. **Consider M3 reclassification** — 20% baseline is arguably Hard, not Medium
