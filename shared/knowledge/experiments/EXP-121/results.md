# EXP-121: Time Budget as Primary Limiter on Discovery Task Completion — Results

**Status**: COMPLETE — INCONCLUSIVE (trending positive, not significant)
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Summary

Extending the time budget from 3→5 minutes raised the pass rate from 67% to 83% (4/6 → 5/6), but this difference is **not statistically significant** (Fisher's exact p=1.0, n=6 per arm). More notably, the **failure mode shifted entirely**: the baseline's consistent failure (missing `index-entry-added` — creating new KE-071) never appeared in treatment. The treatment's single failure was a different check (`ke017-evidence` — updating an existing entry). This suggests extra time may help the agent reach the creative-inference step but n=6 is too small to confirm.

## Experimental Setup

### Baseline (reused from EXP-117)
- Scenario: `kb-integration-discovery` (timeout: 3 min)
- 6 trials with `--agent bob`
- **Result**: 4/6 PASS (67%)
- Failure mode: both failures missed ONLY `index-entry-added`

### Treatment: Extended Time Budget
- Scenario: `kb-integration-discovery-5min` (timeout: 5 min)
- Identical environment, task, and success criteria — only timeout differs
- 6 trials with `--agent bob`

### Note: Gym Runner Scoring Bug
The gym runner's built-in `runCriteria` function consistently reported 0/8 for all trials despite the agent correctly modifying files. This was diagnosed as a scoring bug (the runner evaluates success criteria before the agent's filesystem writes are visible, or evaluates a stale copy). All results below were obtained by running `--keep` to preserve working directories, then manually evaluating `success_criteria.js` against the kept directories.

## Results

### Treatment: 5/6 PASS (83%)

| Trial | Duration | Result | Checks | Missed |
|-------|----------|--------|--------|--------|
| 1 | 163s | FAIL | 6/8 | ke017-evidence, all-files-modified |
| 2 | ~300s | PASS | 8/8 | — |
| 3 | 84s | PASS | 8/8 | — |
| 4 | 152s | PASS | 8/8 | — |
| 5 | 200s | PASS | 8/8 | — |
| 6 | 172s | PASS | 8/8 | — |

**Average duration**: ~179s (2m59s) — well under the 5-minute timeout
**All trials completed before timeout** (no timeout failures)

### Comparison to Baseline

| Metric | Baseline (3 min) | Treatment (5 min) | Δ |
|--------|------------------|--------------------|----|
| Pass rate | 4/6 (67%) | 5/6 (83%) | +17pp |
| Avg checks passed | 7.67/8 | 7.67/8 | 0 |
| Failure mode | index-entry-added | ke017-evidence | **Different** |

### Statistical Analysis
- **Fisher's exact test (two-sided)**: p = 1.000 (not significant)
- **Fisher's exact test (one-sided)**: p = 0.500
- **Cohen's h**: 0.39 (small effect)
- **Power**: Very low at n=6 — would need ~80 trials per arm to detect this effect size at 80% power

## Analysis

### Key Finding: Failure Mode Shift

The most interesting result is not the pass rate change (which is inconclusive) but the **complete shift in failure mode**:

- **Baseline failures** (2/6): Both missed `index-entry-added` — the agent never conceptualized "create new KE-071 entry." This is the creative-inference step requiring the agent to go beyond updating existing files and generate a new knowledge entry.

- **Treatment failure** (1/6): Missed `ke017-evidence` — the agent forgot to update an existing file (KE-017) with EXP-142 reference. This is a simple omission, not a creative gap. Notably, this trial DID pass `index-entry-added` (created KE-071 successfully).

**Interpretation**: With more time, the agent reliably reaches the creative-inference step (creating KE-071). The baseline's time pressure may cause the agent to rush through straightforward updates and skip the step-back-and-think moment. However, n=6 is too small to be confident in this interpretation.

### Time Utilization

Average treatment duration was ~179s (3 minutes), meaning the agent rarely used the full 5-minute budget. This suggests the extra time helps not because agents need more wall-clock time, but because **the absence of time pressure changes the agent's prioritization**. With a generous budget, the agent may take a more thorough exploration approach rather than rushing to edit files.

### Does This Support the Time-Budget Hypothesis?

**Weakly yes.** The data trends in the predicted direction:
- Pass rate improved (67% → 83%)
- The specific failure mode predicted to improve (index-entry-added) was eliminated
- A new, different failure mode appeared (simple omission rather than creative gap)

But at p=1.0, we cannot reject the null hypothesis. The improvement could be random variation.

## Implications

1. **Time budget has a small positive effect on discovery tasks** — not enough to justify running all experiments at 5 min (the 3-min baseline is adequate for most purposes)
2. **The index-entry-added failure is genuinely a reasoning gap** — it appeared in 2/6 baseline trials and 0/6 treatment trials, but time alone doesn't reliably fix it
3. **Future experiments should consider n=12+ per arm** for detecting effect sizes this small
4. **The gym runner scoring bug needs investigation** — `runCriteria` reported 0/8 on all trials despite correct agent work (filed as infrastructure issue)

## Conclusion

EXP-121 is **inconclusive**. The 67% → 83% improvement is directionally consistent with the time-budget hypothesis but not statistically significant. The failure-mode shift from creative-inference gaps (index-entry-added) to simple omissions (ke017-evidence) provides weak qualitative evidence that time helps the agent reach higher-order reasoning steps. However, the primary bottleneck for this task remains the agent's ability to consistently make creative inferences, not wall-clock time.

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-5min/`
- Baseline data: `agents/shared/knowledge/experiments/EXP-117/results.md`
- Design doc: `agents/shared/knowledge/experiments/EXP-121/design.md`
