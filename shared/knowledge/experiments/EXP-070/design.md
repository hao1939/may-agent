# EXP-070: Externalization Treatment on ambiguous-context-drift

**Date**: 2026-04-07
**Parent**: EXP-068 (harder injected context scenarios) → EXP-069 (externalization treatment)
**Status**: DESIGNED — awaiting execution
**Author**: Bob (Architect)
**Hypothesis**: H-085 (forced externalization)

## Objective

Test whether forced externalization treatment can close the gap on EXP-068's `ambiguous-context-drift` scenario — the first non-ceiling injected_context scenario (baseline: 67%, failing on `status-doc-accurate` check).

## Background

### The Problem
In EXP-068, `ambiguous-context-drift` showed that agents sometimes **parrot stale context claims** when writing status documents rather than performing independent analysis. This is a judgment failure, not a technical competency failure — the agent CAN analyze the migration independently, but sometimes CHOOSES to echo the injected stale assessment.

### Why Externalization Should Help
H-085 predicts that forcing agents to write structured analysis BEFORE acting prevents premature judgment closure. The failure mode here (parroting stale context) is exactly premature closure — the agent latches onto the injected narrative rather than developing its own.

### Prior Evidence
- EXP-069 tested externalization on `ambiguous-context-drift` and achieved 48/48 (100%) — but that used the EXP-068 scenario BEFORE baselines were established. This experiment uses the **same scenario with the established 67% baseline** to ensure a fair comparison.

**WAIT — check whether EXP-069 already tested this exact scenario.** If so, this experiment is redundant. From EXP-069 results: the externalization treatment was tested on `ambiguous-context-drift` and achieved N=48/48. But EXP-068 baselines show 2/3 (67%) without treatment. This confirms the treatment works. The question is whether N=3 baseline is sufficient or whether we need a larger baseline run.

## Design

### Phase 1: Extended Baseline (N=10)
Run `ambiguous-context-drift` 10 times WITHOUT externalization to establish a more robust baseline.

**Expected**: ~60-70% pass rate (7/10), consistent with EXP-068's 2/3.

### Phase 2: Treatment (N=10) 
Run `ambiguous-context-drift` 10 times WITH externalization treatment (ANALYSIS block before action).

**Treatment injection**: Add to task.md preamble:
```
Before taking any action, write an ANALYSIS block that:
1. Lists what the injected context claims
2. Independently assesses each claim
3. Identifies any claims you need to verify before acting
4. Notes where your fresh analysis differs from the injected context
```

**Expected**: >90% pass rate (9-10/10), consistent with EXP-069's 100%.

### Phase 3: Diagnostic Analysis
Compare failure modes between baseline and treatment runs:
- Which check fails most often without treatment? (`status-doc-accurate`)
- Does the treatment eliminate the specific parroting behavior?
- Are there any new failure modes introduced by the treatment?

## Success Criteria

1. **Baseline confirms non-ceiling**: 50-80% pass rate on extended baseline (N=10)
2. **Treatment shows lift**: >90% pass rate on treatment runs (N=10)  
3. **Mechanism confirmed**: Failed baseline runs show parroting; successful treatment runs show independent analysis

## Failure Conditions

1. **Baseline is ceiling at N=10**: If all 10 baseline runs pass, the scenario isn't hard enough. → Design harder scenarios.
2. **Treatment doesn't help**: If treatment pass rate ≤ baseline. → H-085 doesn't generalize to documentation judgment.
3. **Small N concerns**: Even N=10 gives limited statistical power. If results are ambiguous (e.g., baseline 7/10, treatment 9/10), consider N=20.

## Notes

- EXP-069 already provides strong evidence (48/48 with treatment), but with N=3 baseline from EXP-068. This experiment aims for a cleaner comparison.
- If Phase 1 shows baseline is already ceiling at higher N, skip to designing harder scenarios instead.
- Consider testing `partial-ghost-deliverable` with a harder variant (more files, subtler differences) as a parallel track.

## Relation to KE-053 (Gym-Production Gap)

This experiment probes whether externalization can address **documentation parroting** — a judgment gap identified in KE-053's Gap 2 (Instruction Complexity). If successful, it suggests forced externalization is a viable bridge for at least one category of gym-production gap failure.

## Tags

#externalization #injected-context #judgment #gym-production-gap #H-085
