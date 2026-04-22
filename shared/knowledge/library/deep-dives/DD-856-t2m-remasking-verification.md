# DD#856 — Token-to-Mask Remasking: Reset Over Repair in Verification

**Paper:** "Remask, Don't Replace: Token-to-Mask Refinement in Masked Diffusion Language Models" (Yao, 2604.18738)
**Date:** 2026-04-23
**Relevance:** EXP-099 (verification gravity well), verification architecture

## Key Insight

When self-correction replaces an error with another guess computed from error-contaminated context, it compounds rather than fixes. T2M proposes: **don't replace — reset to unknown state, then re-derive from clean context.**

## Mechanism

In masked diffusion LMs, the standard self-correction (T2T) overwrites suspect tokens. Three structural failure modes identified:
1. **No confident alternative** — trigger can't fire when uncertainty is distributed
2. **Contaminated context** — replacement computed under error-laden surroundings  
3. **Distribution mismatch** — training perturbations don't match real inference errors

T2M solution: reset suspect position to mask token → next denoising step re-predicts from in-distribution context. Training-free, no new parameters.

## Results

- +5.92 on CMATH (largest gain)
- **79.9% of baseline errors attributed to "last-mile corruption"** — correct reasoning followed by garbled final answer
- T2M repairs 41.3% of these cases
- Improvements across 8 benchmarks on exact-token tasks

## Connection to Our System

**This is the verification gravity well mechanism in miniature.** EXP-099 found FM-3.3 as terminal attractor (20.3% of errors). The parallel:

| T2M Finding | Our System Analog |
|---|---|
| Errors compound when corrected from contaminated context | Verification loops deepen when checking with same flawed assumptions |
| Last-mile corruption (79.9%) | Correct reasoning → wrong final output pattern |
| Reset to mask > replace with guess | Reset verification state > iterate from same frame |

**Hypothesis H-scout-14:** Our verification gravity well may be reducible by "remasking" — when a verification loop is detected, reset the verification context entirely rather than re-checking from the same contaminated state. This maps to T2M's insight that in-distribution re-derivation beats error-conditioned correction.

## Actionable

- For EXP-099 follow-up: test whether "verification reset" (clearing accumulated verification context) breaks the gravity well attractor
- The 79.9% "last-mile corruption" rate suggests our own error taxonomy should distinguish reasoning-correct/output-wrong failures

## Tags
`verification` `self-correction` `error-propagation` `EXP-099` `gravity-well`
