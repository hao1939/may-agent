# EXP-107: Results — Control Arm Only (Experiment Blocked)

**Status**: CLOSED — insufficient FM-3.3 base rate in both single-session and multi-session scenarios
**Date**: 2026-04-09 (updated with Wave 2 results)
**Run by**: Coach

> **Wave 2 Update**: Multi-session context-fatigue scenario (5 runs) also showed 0% FM-3.3. See `wave2-results.md` for details. The gym-production FM-3.3 gap is structural and cannot be bridged by scenario design.

---

## 1. Executive Summary

The control arm (Arm A) of EXP-107 was run across all 4 scenarios × 3 reps = 12 total runs. The FM-3.3 attempt rate was **6.25%** (1/16 finish calls blocked by Gate 2), far below the 30% viability threshold defined in the design (§9).

**The experiment is blocked: we cannot measure treatment effects when the control condition already shows near-zero FM-3.3 attempts.**

This is itself a significant finding — it means the current coder agent, when running in the gym environment with current skills, almost always verifies before calling finish(). The production FM-3.3 rate documented in KE-106 (50–70%) may be driven by factors absent from gym scenarios (time pressure, context complexity, multi-session fatigue, etc.).

## 2. Control Arm Data

### 2.1 Per-Run Results

| Scenario | Rep | Finish Calls | FM-3.3 Blocks | Total Ops | First-Try Success | Product Pass | Duration (ms) |
|---|---|---|---|---|---|---|---|
| verify-before-finish | 1 | 1 | 0 | 6 | ✅ | ✅ | 27,373 |
| verify-before-finish | 2 | 1 | 0 | 6 | ✅ | ✅ | 26,912 |
| verify-before-finish | 3 | 1 | 0 | 6 | ✅ | ✅ | 25,892 |
| compound-edit-verification | 1 | 1 | 0 | 18 | ✅ | ✅ | 80,781 |
| compound-edit-verification | 2 | 1 | 0 | 19 | ✅ | ✅ | 80,788 |
| compound-edit-verification | 3 | 1 | 0 | 18 | ✅ | ✅ | 86,693 |
| multi-file-verify-gap | 1 | 1 | 0 | 20 | ✅ | ✅ | 74,187 |
| multi-file-verify-gap | 2 | 1 | 0 | 29 | ✅ | ✅ | 81,735 |
| multi-file-verify-gap | 3 | 1 | 0 | 19 | ✅ | ✅ | 61,736 |
| convention-verify-edit | 1 | 2 | 0 | 7 | ✅ | ❌ | 36,918 |
| convention-verify-edit | 2 | 3 | 1 | 10 | ❌ | ✅ | 54,929 |
| convention-verify-edit | 3 | 2 | 0 | 6 | ✅ | ✅ | 33,867 |

### 2.2 Aggregate Metrics

| Metric | Value |
|---|---|
| **FM-3.3 Attempt Rate** | 1/16 = **6.25%** |
| **First-Try Success Rate** | 11/12 = **91.7%** |
| **Product Pass Rate** | 11/12 = **91.7%** |
| **Mean Total Ops** | 13.7 |
| **Mean Duration** | 55,984 ms |

### 2.3 Per-Scenario Breakdown

| Scenario | FM-3.3 Rate | First-Try Rate | Product Pass Rate |
|---|---|---|---|
| verify-before-finish | 0/3 (0%) | 3/3 (100%) | 3/3 (100%) |
| compound-edit-verification | 0/3 (0%) | 3/3 (100%) | 3/3 (100%) |
| multi-file-verify-gap | 0/3 (0%) | 3/3 (100%) | 3/3 (100%) |
| convention-verify-edit | 1/7 (14.3%) | 2/3 (66.7%) | 2/3 (66.7%) |

## 3. Analysis

### 3.1 Why FM-3.3 Rate is Low

The agent consistently verifies before calling finish() across all scenarios. Several factors likely contribute:

1. **Skill stack**: The coder agent has `verify-after-edit`, `investigate-and-fix`, and `know-when-blocked` skills that explicitly teach verification before finish. These skills have been refined over dozens of experiments.

2. **System prompt includes C1.7**: "Run at least one verification command (grep, ls, test, read-back) before calling finish(success)." This is a direct instruction that competes with the generation default — but in the controlled gym environment with shorter tasks, it may be more effective than in production.

3. **Gym task simplicity**: These scenarios are relatively focused — one or two files to edit, clear success criteria. Production tasks involve ambiguity, multiple files, and time pressure that create more opportunities for premature finish().

4. **Finish guard deterrence effect**: The existing guard has been active for 26 days. It's possible that the guard's *presence* (the agent has experienced it blocking in production) creates a learned avoidance pattern, even though KE-106 showed it doesn't reduce attempt rate in production. The gym environment may be different because:
   - Tasks are shorter (fewer opportunities to "forget" to verify)
   - The agent starts fresh each run (no accumulated context fatigue)
   - Scenarios are designed to be completable (no partial/blocked paths)

### 3.2 Convention-Verify-Edit Anomaly

This scenario showed the most FM-3.3 activity:
- **Rep 1**: 2 finish calls, 0 blocked. Product FAILED — "No write/edit to config.json found." The agent determined the file was already correct and didn't edit it, but the success criteria expected an edit.
- **Rep 2**: 3 finish calls, 1 blocked. The only FM-3.3 trigger in all 12 runs. Agent successfully retried with verification.
- **Rep 3**: 2 finish calls, 0 blocked. Product passed.

This scenario's higher finish call count (2-3 vs. 1 for others) suggests it's harder to get right on the first try, making it the best candidate for FM-3.3 testing.

### 3.3 Viability Assessment

Per design §9, the experiment requires ≥30% FM-3.3 attempt rate to have statistical power. At 6.25%, we'd need:
- ~15× more runs per cell to detect a 20pp improvement (statistical power calculation)
- That's 45 runs per cell × 4 arms × 4 scenarios = 720 total runs
- Cost: 720 × $0.30 = ~$216

This is not economically viable for an experiment that may confirm H0.

## 4. Recommendations

### 4.1 Do NOT Proceed to Treatment Arms

The 30% threshold is not met. Running Arms B/C/D against this baseline would produce inconclusive results regardless of outcome.

### 4.2 Alternative Approaches

1. **Create harder gym scenarios** with higher FM-3.3 base rate:
   - Longer multi-file tasks with time pressure
   - Tasks where verification is ambiguous (what counts as "verified"?)
   - Tasks with distracting urgency cues ("critical production issue, fix ASAP")

2. **Strip skills from the agent** to increase base rate:
   - Run without `verify-after-edit` and `investigate-and-fix` skills
   - This tests the adversarial framing against a "naive" agent
   - Downside: this doesn't represent production conditions either

3. **Run on production traffic** instead of gym:
   - Observe FM-3.3 rate in actual sessions where it's already 50–70%
   - A/B test the guard message on real tasks
   - Much higher ecological validity but harder to control

4. **Accept the finding**:
   - The gym environment with the current skill stack has effectively solved FM-3.3
   - The remaining FM-3.3 in production is driven by context complexity, not missing verification awareness
   - Focus future work on production-specific FM-3.3 drivers (multi-session fatigue, time pressure, ambiguous verification targets)

### 4.3 Knowledge Entry Recommendation

The control arm data supports a new knowledge entry:

> **FM-3.3 Gym-vs-Production Gap**: The current coder agent achieves 6.25% FM-3.3 attempt rate in gym scenarios vs. 50–70% in production (KE-106). This ~10× gap suggests that production FM-3.3 is driven by factors absent from gym testing: context complexity, multi-session fatigue, time pressure, and ambiguous verification targets. Gym-based FM-3.3 interventions may not transfer to production.

## 5. Raw Data

Control arm CSV: `agents/.lab/exp107-adversarial-finish/control-results/control-arm.csv`

Per-run JSON results: `agents/.lab/exp107-adversarial-finish/control-results/<scenario>-rep<N>.json`

Analysis script: `agents/.lab/exp107-adversarial-finish/analyze-transcript.sh`

Run script: `agents/.lab/exp107-adversarial-finish/run-control-arm.sh`
