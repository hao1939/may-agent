# EXP-126: Environmental Hints Replication — Results

**Status**: COMPLETE  
**Date**: 2026-04-10  
**Design**: [design.md](./design.md)

## Summary

Environmental hints (HTML comment in INDEX.md) showed **no significant effect** on KB discovery task pass rate. The treatment arm (50%) performed slightly worse than baseline (58%), with p = 1.00 (Fisher's exact, two-sided). **However, a timeout confound compromises the treatment data**, making the primary comparison unreliable.

**Verdict: NULL RESULT** — consistent with the original EXP-122 first-run finding.

## Final Results

| Arm | N | Pass | Fail | Rate | 95% CI (Wilson) |
|-----|---|------|------|------|-----------------|
| Baseline (no hint) | 12 | 7 | 5 | 58.3% | 32.0% – 80.7% |
| Treatment (hint) | 12 | 6 | 6 | 50.0% | 25.4% – 74.6% |

### Statistical Tests

| Metric | Value |
|--------|-------|
| Fisher's exact p (two-sided) | 1.000 |
| Cohen's h | 0.167 (negligible) |
| Difference | −8.3 pp (treatment worse) |

**Not statistically significant** (p >> 0.05). Effect size is negligible.

## ⚠️ Critical Confound: Timeout Mismatch

The scenario's configured timeout is **3 minutes** (`scenario.json: "timeout": 3`). However, the last 4 treatment runs were executed with `--timeout 5` (5-minute override), which superseded the scenario default. This creates a non-trivial confound:

| Subset | Baseline | Treatment | p (Fisher) | Cohen's h |
|--------|----------|-----------|------------|-----------|
| All runs (N=24) | 7/12 (58%) | 6/12 (50%) | 1.000 | 0.167 |
| 3-min timeout only (N=20) | 7/12 (58%) | 2/8 (25%) | 0.197 | 0.691 |
| 5-min timeout only (N=4) | — | 4/4 (100%) | — | — |

**Key observation**: All 4 runs with the 5-minute timeout passed, while only 2/8 (25%) of the 3-minute timeout treatment runs passed. The 4 passing runs consumed 202–291 seconds — well beyond the 3-minute limit.

This means:
1. The **apples-to-apples comparison** (3-min only) shows treatment at 25% vs baseline at 58% — treatment may actually *hurt* performance (Cohen's h = 0.69, medium-large), though still not significant at p = 0.197 with these sample sizes.
2. The **pooled analysis** (all 24 runs) is contaminated by the timeout difference and should not be interpreted as a clean hint-vs-no-hint comparison.

## Temporal Analysis

Run order reveals a striking temporal pattern:

```
B1:F  B2:P  B3:F  B4:P  B5:P  B6:P  (Block 1: Baseline 4/6)
T1:P                                   (Block 1: Treatment 1/1 — only 1 run before interruption)
B7:P  B8:F  B9:P  B10:P B11:F B12:F   (Block 2: Baseline 3/6)
T2:F  T3:P  T4:F  T5:F  T6:F  T7:F  T8:F  (Treatment 3min: 1/7)
T9:P  T10:P T11:P T12:P                (Treatment 5min: 4/4) ← confounded
```

The treatment runs show an unusual bimodal pattern: mostly failures in the 3-min block, then all passes in the 5-min block. This is almost certainly a timeout effect, not a learning or ordering effect.

## Check-Level Analysis

| Check | Baseline | Treatment | Notes |
|-------|----------|-----------|-------|
| h042-probability-updated | 12/12 (100%) | 12/12 (100%) | Both perfect |
| ke017-evidence-appended | 12/12 (100%) | 12/12 (100%) | Both perfect |
| index-entry-added | 11/12 (92%) | 12/12 (100%) | Treatment slightly better |
| ke023-status-validated | 11/12 (92%) | 12/12 (100%) | Treatment slightly better |
| priority-reordered | 12/12 (100%) | 11/12 (92%) | |
| synth008-updated | 10/12 (83%) | 12/12 (100%) | Treatment better |
| todo-marked-complete | 9/12 (75%) | 7/12 (58%) | Treatment worse |
| all-files-modified | 7/12 (58%) | 6/12 (50%) | Composite — drives overall rate |

The `all-files-modified` check (requiring ALL files to be updated) is the binding constraint for both arms. Every failed run failed this check. Common co-failures:
- **Baseline failures**: `todo-marked-complete` (3/5), `synth008-updated` (2/5), `index-entry-added` (1/5)
- **Treatment failures**: `todo-marked-complete` (5/6) — strongly concentrated on one check

### Treatment-Specific Failure Pattern

In the 3-min treatment runs, 5 of 6 failures involved `todo-marked-complete` — the agent ran out of time before completing the todo update. The hint may be causing the agent to spend additional time processing the HTML comment cue, leaving insufficient time for the final task step.

## Conclusions

1. **Primary result**: Environmental hints show no significant positive effect (p = 1.00). The original EXP-122 "100% pass rate" claim remains debunked — it was an artifact of a corrupted environment.

2. **Suggestive (not significant) negative trend**: In the clean 3-minute comparison, treatment (25%) underperformed baseline (58%) with a medium-large effect size (h = 0.69, p = 0.197). This raises the possibility that the hint *hurts* by consuming agent attention/time, but the sample is too small for confidence.

3. **Timeout confound invalidates pooled analysis**: The last 4 treatment runs used a 5-minute timeout, making the 50% pooled treatment rate artificially high. The uncontaminated treatment rate is 25% (2/8).

4. **Task is timeout-sensitive**: Both arms show many runs hitting exactly 180 seconds. The task requires updating 7+ files in 3 minutes — marginal for the agent. Small perturbations (like processing a hint) may push the agent past the timeout.

## Recommendations

1. **Accept the null result** for environmental hints on this task. The mechanism does not improve pass rates and may hurt them.
2. **Future replications** should ensure timeout consistency between arms — either use the scenario default for all runs or override consistently.
3. **Consider increasing the scenario timeout** to 5 minutes if the goal is to test hint effectiveness rather than time pressure.
4. **The "hints hurt" hypothesis** (H-new) could be tested with a properly powered study at N=30+ per arm, but given the null/negative trend, this is low priority.

## Raw Data

### All Runs (chronological)

| Run ID | Arm | Result | Duration | Timestamp |
|--------|-----|--------|----------|-----------|
| 185 | Baseline | FAIL | 180s | 2026-04-10 18:29:35 |
| 186 | Baseline | PASS | 180s | 2026-04-10 18:33:41 |
| 187 | Baseline | FAIL | 166s | 2026-04-10 18:36:36 |
| 188 | Baseline | PASS | 180s | 2026-04-10 18:36:51 |
| 189 | Baseline | PASS | 175s | 2026-04-10 18:40:40 |
| 190 | Baseline | PASS | 177s | 2026-04-10 18:40:42 |
| 191 | Treatment | PASS | 180s | 2026-04-10 18:43:59 |
| 192 | Baseline | PASS | 164s | 2026-04-10 18:58:31 |
| 193 | Baseline | FAIL | 180s | 2026-04-10 19:01:35 |
| 194 | Baseline | PASS | 180s | 2026-04-10 19:04:40 |
| 195 | Baseline | PASS | 177s | 2026-04-10 19:07:41 |
| 196 | Baseline | FAIL | 180s | 2026-04-10 19:27:29 |
| 197 | Baseline | FAIL | 180s | 2026-04-10 19:30:33 |
| 198 | Treatment | FAIL | 180s | 2026-04-10 19:33:39 |
| 199 | Treatment | PASS | 180s | 2026-04-10 19:36:44 |
| 202 | Treatment | FAIL | 180s | 2026-04-10 19:59:45 |
| 203 | Treatment | FAIL | 180s | 2026-04-10 20:02:51 |
| 206 | Treatment | FAIL | 180s | 2026-04-10 20:05:55 |
| 209 | Treatment | FAIL | 180s | 2026-04-10 20:09:19 |
| 211 | Treatment | FAIL | 176s | 2026-04-10 20:12:19 |
| 219 | Treatment | PASS | 238s | 2026-04-10 20:30:30 |
| 221 | Treatment | PASS | 202s | 2026-04-10 20:33:56 |
| 223 | Treatment | PASS | 291s | 2026-04-10 20:39:20 |
| 225 | Treatment | PASS | 234s | 2026-04-10 20:43:18 |

### Failed Run Details

| Run ID | Arm | Failed Checks |
|--------|-----|---------------|
| 185 | B | all-files-modified, index-entry-added |
| 187 | B | all-files-modified, todo-marked-complete |
| 193 | B | all-files-modified, ke023-status-validated, synth008-updated |
| 196 | B | all-files-modified, todo-marked-complete |
| 197 | B | all-files-modified, synth008-updated, todo-marked-complete |
| 198 | T | all-files-modified, todo-marked-complete |
| 202 | T | all-files-modified, todo-marked-complete |
| 203 | T | all-files-modified, priority-reordered |
| 206 | T | all-files-modified, todo-marked-complete |
| 209 | T | all-files-modified, todo-marked-complete |
| 211 | T | all-files-modified, todo-marked-complete |
