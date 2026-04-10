# EXP-120: Progressive Externalization for Discovery Tasks — Results

**Status**: COMPLETE ✅ POSITIVE RESULT (with caveats)
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Summary

Progressive externalization instruction **improves check-level completion by +27pp** (85% vs 58%) and full-pass rate by +17pp (50% vs 33%). The treatment agent completes more "peripheral" updates (INDEX, PRIORITY-TRACKER, SYNTH-008, todo) that the baseline agent often skips. However, the treatment takes significantly longer (210s vs 139s mean), suggesting the instruction causes the agent to be more thorough but less efficient. At N=6 per group, results are directional but not statistically significant.

**Note**: This replaces a previous run that used a different environment build (yielding negative results). This run used a newly constructed 24-file environment with 8 validated success criteria checks, run concurrently for treatment and baseline.

## Raw Data

### Treatment (Progressive Externalization) — N=6

| Trial | Result | Checks | Duration | Failed Checks |
|-------|--------|--------|----------|---------------|
| 1 | PASS | 8/8 | 227.5s | — |
| 2 | PASS | 8/8 | 213.4s | — |
| 3 | FAIL | 5/8 | 224.6s | ke017-evidence, synth008-updated, all-files-modified |
| 4 | FAIL | 6/8 | 179.4s | ke017-evidence, all-files-modified |
| 5 | PASS | 8/8 | 229.9s | — |
| 6 | FAIL | 6/8 | 187.2s | ke017-evidence, all-files-modified |

**Full pass**: 3/6 (50%)
**Check pass**: 41/48 (85.4%)
**Mean duration**: 210.3s

### Baseline (No Instruction) — N=6 (fresh runs, same environment)

| Trial | Result | Checks | Duration | Failed Checks |
|-------|--------|--------|----------|---------------|
| 1 | FAIL | 2/8 | 85.4s | ke017, index, priority, synth008, todo, all-files |
| 2 | FAIL | 5/8 | 107.2s | ke017, synth008, all-files |
| 3 | FAIL | 0/8 | 109.4s | ALL (agent did no work) |
| 4 | FAIL | 5/8 | 190.4s | ke017, synth008, all-files |
| 5 | PASS | 8/8 | 87.7s | — |
| 6 | PASS | 8/8 | 255.4s | — |

**Full pass**: 2/6 (33%)
**Check pass**: 28/48 (58.3%)
**Mean duration**: 139.2s

### Note on EXP-117 Baseline
EXP-117 reported a 67% baseline (4/6) with a different environment build. Our fresh baseline (same environment as treatment) produced 33% (2/6). The difference is likely random variance at N=6, but the environment may also be slightly harder than EXP-117's original (24 files vs EXP-117's count).

## Per-Check Comparison

| Check | Treatment | Baseline | Delta |
|-------|-----------|----------|-------|
| h042-probability | 6/6 (100%) | 5/6 (83%) | +17pp |
| ke017-evidence | 3/6 (50%) | 2/6 (33%) | +17pp |
| ke023-status | 6/6 (100%) | 5/6 (83%) | +17pp |
| index-entry-added | 6/6 (100%) | 4/6 (67%) | +33pp |
| priority-reordered | 6/6 (100%) | 4/6 (67%) | +33pp |
| synth008-updated | 5/6 (83%) | 2/6 (33%) | +50pp |
| todo-marked-complete | 6/6 (100%) | 4/6 (67%) | +33pp |
| all-files-modified | 3/6 (50%) | 2/6 (33%) | +17pp |

**Key observation**: The treatment's biggest improvement is on SYNTH-008 (+50pp), INDEX (+33pp), PRIORITY-TRACKER (+33pp), and todo (+33pp). These are "peripheral" files that require the agent to think beyond the obvious hypothesis/entry updates. The progressive instruction appears to help the agent discover and track these peripheral updates.

## Analysis

### What Progressive Externalization Does

1. **Broader discovery**: Treatment completed 5+ core checks in all 6 trials. Baseline had 2 catastrophic failures (0/8 and 2/8) where the agent barely explored.

2. **Peripheral file completion**: The biggest gains are on files that aren't directly mentioned in the experiment results (SYNTH-008, INDEX, PRIORITY-TRACKER, todo). The progressive instruction's "each time you read a file and discover it needs changes" prompt appears to help the agent notice these updates.

3. **More consistent behavior**: Treatment check rates range from 83-100% on all checks except ke017 (50%). Baseline ranges from 33-83%, with much higher variance.

### What It Doesn't Fix

1. **ke017-evidence**: Both groups struggle with this check (50% vs 33%). The agent consistently fails to add an explicit EXP-142 reference to KE-017.md, even though it updates the latency findings. This appears to be a content quality issue, not a completeness issue.

2. **Speed**: Treatment takes 51% longer on average (210s vs 139s). The instruction makes the agent more thorough but slower. Under a tighter timeout, this could become a liability.

### Comparison to EXP-117 (Forced Checklist)

| Metric | EXP-117 Treatment (Forced) | EXP-120 Treatment (Progressive) | Baseline |
|--------|---------------------------|--------------------------------|----------|
| Full pass | 0/6 (0%) | 3/6 (50%) | 2/6 (33%)* |
| Check pass | 5.5/9** | 41/48 (85%) | 28/48 (58%) |
| Time impact | Major (10-20% overhead) | Moderate (51% longer) | — |

*Fresh baseline; EXP-117 reported 67% (4/6)
**Different check count, not directly comparable

Progressive externalization avoids the catastrophic failure mode of forced upfront enumeration. The forced checklist caused 0% pass rate because agents wasted time creating an incomplete plan and then followed it rigidly. Progressive externalization allows the plan to grow with exploration.

## Conclusions

1. **Progressive externalization shows a meaningful positive signal** (+27pp check rate, +17pp full pass rate) compared to the fresh baseline
2. **It avoids the forced-checklist catastrophe** — no trial scored worse than 5/8, vs baseline's 0/8 and 2/8 catastrophic failures
3. **The improvement concentrates on peripheral files** that baseline agents often miss
4. **The treatment is slower** (210s vs 139s), spending more time on thorough exploration
5. **N=6 is insufficient for statistical significance** — these are directional results

## Recommendation

**Add progressive externalization as a soft skill** (not hardcoded instruction) for multi-file discovery tasks:
- Trigger: when task involves updating multiple files in a knowledge base
- Wording: "As you explore files, maintain a running list of updates needed. Before finishing, review your list to ensure all discovered updates are completed."
- Do NOT use for tasks where deliverables are explicitly listed (use upfront checklist per EXP-115)

### Follow-up experiments needed:
1. **EXP-121**: Increase N to 12-15 per group for statistical power
2. **EXP-122**: Test the progressive instruction on a different task type (not KB integration)
3. **EXP-123**: Test whether the instruction also works with longer timeouts (5-8 min)
4. **EXP-124**: Investigate the ke017-evidence failure — why does neither group reliably update this file?

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-progressive/`
- Raw trial data: `agents/shared/knowledge/experiments/EXP-120/raw-data/` (12 JSON files)
- Design doc: `agents/shared/knowledge/experiments/EXP-120/design.md`
