# KE-287: Small-N Gym Results (≤10 Trials) Are Temporally Unstable — Replication Failures Are Expected

**Date**: 2026-04-19
**Source**: EXP-177 (replication failure of 10/10 arm F result from EXP-168 clean-env controls)
**Confidence**: High (direct replication failure with same hint string, same scenario)
**Connects**: KE-184 (ceiling effect methodology), KE-286 (hint interventions unreliable), H-166-revised (REFUTED), KE-199b

## Core Finding

Small-N gym results (≤10 trials) are temporally unstable and should not be used to motivate hypotheses or design decisions. The 10/10 (100%) arm F result from EXP-168 post-contamination controls — which was the primary evidence for H-166-revised (P=0.75) and KE-199b — dropped to 3/10 (30%) in EXP-177 using the identical hint string and scenario. This 70pp collapse demonstrates that N=10 point estimates can be extreme flukes.

## Evidence

- **EXP-168 clean-env control**: arm F (moderate hint, cascading-fix-trap-v2) = **10/10 pass (100%)**. This single result motivated H-166-revised and KE-199b.
- **EXP-177 S1 LEXICAL arm**: identical hint string, same scenario = **3/10 pass (30%)**. A 70pp drop.
- **95% CI for 10/10**: The 95% lower bound for a true 100% rate at N=10 is ~69%. A true rate of 30% producing 10/10 has probability ~0.00006 — but with multiple arms tested across experiments, selection effects make this plausible.
- **Possible confounds**: model version drift between EXP-168 and EXP-177, subtle environment changes. But the simplest explanation is small-N variance + selection bias (we noticed the 10/10 *because* it was extreme).

## Mechanism / Why

1. **Small-N variance**: At N=10, a true 50% rate produces 10/10 with probability ~0.1%. But across many experimental arms, at least one extreme result is expected.
2. **Selection bias**: Extreme results attract attention and motivate follow-up hypotheses. The 10/10 was singled out precisely because it was dramatic. This is textbook publication bias at the experiment level.
3. **Temporal instability**: LLM behavior may drift across model versions, API changes, or even stochastic sampling variation across time.

## Implications

### 1. Minimum N for hypothesis formation should be ≥20
N=10 results should be treated as directional signals only, never as evidence for strong claims (P≥0.75).

### 2. KE-199b's evidence base was too thin
The entire low-threshold causal pointer model rested on a single N=10 cell. EXP-177's N=20 confirmatory design was the right response, and it correctly identified the original as a fluke.

### 3. Connects to KE-184 (ceiling effects)
KE-184 warned about ceiling effects masking real variation. This is the complementary lesson: apparent ceilings at small N may be noise, not signal.

## Actionable

- **Require N≥20 for any hypothesis with P≥0.50.** N=10 results get P≤0.40 maximum.
- **Flag "perfect" small-N results** (0/N or N/N) as high replication risk. These are the most likely to be flukes.
- **Always run confirmatory experiments** before building downstream theory on small-N findings.

## Open Questions

- How much of the instability is model drift vs pure stochastic variance? Could be tested by re-running the same arm multiple times within a short window.
