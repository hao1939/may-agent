# EXP-200: Belief Externalization for Verification Gravity Well Reduction

**Date**: 2026-06-22
**Status**: DEPLOYED
**Hypothesis**: H-072 (Belief-State Externalization Reduces Verification Gravity Wells)
**Source**: Scout DD#860 (ABBEL) + EXP-099 (FM-3.3 verification gravity wells, 20.3% of errors)

---

## Research Question

Does forcing agents to externalize their beliefs before verification actions reduce verification gravity wells?

## Background

EXP-099 identified that 20.3% of agent errors are "verification gravity wells" (FM-3.3) — agents get stuck in error-compounding loops where each verification step reinforces a wrong belief. The ABBEL paper (Lidayan et al.) shows that explicit belief bottlenecks improve performance when beliefs are graded and externalized.

**Key insight**: Verification gravity wells may form because the agent's implicit belief state becomes corrupted, and no mechanism forces the agent to examine its beliefs before acting on them.

## Design

### Intervention

Add to `buildReviewPrompt()` in `agents/shared/workflows/project.ts`, a belief-externalization requirement:

```
Before evaluating the worker's output, state:
1. BELIEVE: What I believe is true about the current project state (3 bullets max)
2. UNCERTAIN: What I'm uncertain about (1-2 bullets)  
3. FALSIFY: What evidence would change my mind about the current approach
Then proceed with your review.
```

### Arms

- **Arm A (control)**: Current reviewer prompt (stall-detection + pre-check, no belief externalization)
- **Arm B (treatment)**: Current reviewer prompt + belief externalization block above

### Measurement

This is a **qualitative pilot**, not a gym experiment:

1. Deploy Arm B to 2-3 active projects
2. After 10 iterations per project, manually review:
   - Did the reviewer's BELIEVE/UNCERTAIN/FALSIFY statements catch any incorrect beliefs?
   - Did any verification gravity well form? (Compare to historical ~20% rate)
   - Did the belief statements lead to earlier PIVOT decisions?
3. Success: Any case where externalized beliefs revealed a wrong assumption before it cascaded

### Predictions

- **H-200a (optimistic)**: Belief externalization reduces gravity wells from ~20% to <10% 
- **H-200b (moderate)**: At least 1 in 10 iterations shows belief externalization catching a wrong assumption
- **H-200-null**: Agents state beliefs that are always correct (no detection value) or always wrong in uninformative ways

### Cost

Zero incremental cost — prompt-only intervention (~50 extra tokens per review).

### Risk

Low. Worst case: adds 50 tokens of noise to reviewer output. Can be removed trivially.

## Implementation

Edit `buildReviewPrompt()` in `agents/shared/workflows/project.ts` to add the belief block after the existing pre-check section but before the response format instructions.

## Success Criteria

- [ ] Arm B deployed to ≥2 active projects
- [ ] ≥10 iterations observed with belief externalization
- [ ] Qualitative analysis written: did belief statements catch any incorrect assumptions?
- [ ] Decision: scale up to gym experiment (EXP-200b) or abandon
