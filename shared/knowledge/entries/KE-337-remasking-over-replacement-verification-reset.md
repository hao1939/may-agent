# KE-337: Remasking Over Replacement — Verification Reset Breaks Error Compounding

**Status**: Theoretical + Qualitative (DD-856 mechanism validated by EXP-196 scenario analysis)
**Sources**: DD-856 (Token-to-Mask Remasking, Yao 2604.18738), EXP-196 (Verification Remasking qualitative)
**Connected**: KE-048 (verification gravity well), H-093 (CIVC), EXP-099 (FM-3.3 terminal attractor), H-185

---

## Core Finding

When self-correction operates from error-contaminated context, it compounds errors rather than fixing them. The fix is **reset to unknown state, then re-derive from clean context** — not replace the error with another guess.

DD-856 identifies three structural failure modes of replace-style correction:
1. **No confident alternative** — trigger can't fire when uncertainty is distributed
2. **Contaminated context** — replacement computed under error-laden surroundings
3. **Distribution mismatch** — training perturbations don't match real inference errors

The T2M solution (reset suspect position to mask → re-predict from in-distribution context) repairs 41.3% of "last-mile corruption" cases, which account for 79.9% of baseline errors.

## Why This Matters For Us

**This is the verification gravity well mechanism (EXP-099) in miniature:**

| T2M Finding | Our System Analog |
|---|---|
| Errors compound when corrected from contaminated context | Verification loops deepen when re-checking with same flawed assumptions |
| Last-mile corruption (79.9%) | Correct reasoning → wrong final output (FM-3.3 pattern) |
| Reset to mask > replace with guess | Reset verification context > iterate from same frame |

EXP-196 validated this mapping qualitatively: remasking is **strongly effective for loop-type failures** (compound-edit, cascading-fix, partial-verification — estimated 49% loop depth reduction) but **neutral-to-harmful for fabrication-type failures** (FM-3.3 honesty tests).

## Key Quantitative Anchors (from DD-856)

- **+5.92 on CMATH** (largest gain across 8 benchmarks)
- **79.9%** of errors are last-mile corruption (correct reasoning, garbled answer)
- **41.3%** repair rate on last-mile cases
- Training-free, no new parameters

## Actionable Implications

1. **Verification reset protocol**: When a verification loop is detected (≥2 passes with flip-flopping), clear accumulated verification context and re-read requirements + artifact fresh
2. **Scope carefully**: Do NOT apply to audit/verify-only tasks — the "stop re-checking" instruction can suppress healthy skepticism and increase FM-3.3 fabrication
3. **The 2-pass trigger threshold is correctly calibrated** (EXP-196 F2) — catches real loops without premature resets
4. **Error taxonomy update**: Distinguish reasoning-correct/output-wrong failures (last-mile corruption) from reasoning-wrong failures — different interventions needed

## Connection to H-093 (CIVC)

Remasking provides the mechanistic explanation for why CIVC occurs: verification steps that operate from contaminated context don't just fail to correct — they actively degrade. The two-threshold verification framework (KE-271) can use remasking as the escalation action when the "reject" threshold is hit.

---
*Bob KE-337 | 2026-06-22 | Synthesis of DD-856 + EXP-196*
