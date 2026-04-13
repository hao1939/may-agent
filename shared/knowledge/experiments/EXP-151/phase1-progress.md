# EXP-151 Phase 1: Trial Progress Tracker

**Started**: 2026-04-12 18:25 UTC  
**Last Updated**: 2026-04-13 06:30 UTC  
**Status**: Easy + Hard buckets COMPLETE. Medium bucket NOT STARTED.

---

## Trial Matrix (Completed)

| Cell | Bucket | Condition | Scenarios | Target N | Completed | Pass Rate | Notes |
|------|--------|-----------|-----------|----------|-----------|-----------|-------|
| 1 | Easy | Full | E1,E2 | 10+/bucket | 22 | 50% (11/22) | E3 broken |
| 2 | Easy | Minimal | E1,E2 | 10+/bucket | 20 | 50% (10/20) | E3 broken |
| 5 | Hard | Full | H1,H2,H3 | 3/scenario | 57 | 0% (0/57) | Floor |
| 6 | Hard | Minimal | H1,H2,H3 | 3/scenario | 15 | 0% (0/15) | Floor |

## Per-Scenario Results

| Scenario | Condition | Pass/N | Rate | Status |
|----------|-----------|--------|------|--------|
| **investigate-fix-pattern** | Full | 11/11 | 100% | Ceiling — no overhead effect |
| **investigate-fix-pattern** | Minimal | 10/10 | 100% | Ceiling — no overhead effect |
| **mock-leak-trap** | Full | 0/11 | 0% | ⚠️ See note below |
| **mock-leak-trap** | Minimal | 0/10 | 0% | ⚠️ See note below |
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

---

## Preliminary Analysis (Easy + Hard only)

### P-107a (Overhead helps easy tasks): INDETERMINATE
- investigate-fix-pattern: 100% full vs 100% minimal → ceiling, no effect detectable
- mock-leak-trap: 0% full vs 0% minimal → scoring artifact, no effect detectable
- **Verdict**: Cannot test P-107a with current Easy bucket — ceiling/floor effects mask any overhead impact

### P-107c (Overhead neutral on hard tasks): SUPPORTED
- All hard scenarios: 0% full vs 0% minimal → floor effect, overhead irrelevant
- TOST equivalence test: trivially satisfied (both at 0%)

### P-107d (Largest negative delta at medium): PENDING medium bucket data

### Overall: Medium bucket is now the CRITICAL test
The Easy and Hard buckets both show null effects (for different reasons). The Medium bucket is where the H-107 interaction effect would be most visible. The experiment's scientific value hinges on the Medium bucket results.

## Next Steps
1. **Investigate mock-leak-trap scoring** — determine if behavior criterion should be included in pass/fail for this experiment
2. **Fix or replace wrong-fix-recovery** — either debug gym integration or select a replacement Easy scenario
3. **Run Medium bucket** — this is now the highest priority for the experiment
4. **Consider supplemental Easy scenarios** — find scenarios with 70-90% baseline that aren't at ceiling
