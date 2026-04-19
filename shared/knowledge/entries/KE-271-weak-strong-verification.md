# KE-271: Two-Threshold Verification — Provably Optimal Weak-Strong Escalation

**Date**: 2026-04-19
**Source**: DD#778 (Kiyani et al. 2602.17633)
**Confidence**: High
**Connects**: H-093, KE-104, DD#702, DD#724

## Core Finding

The optimal policy for deciding when to escalate from cheap (weak) to expensive (strong) verification has a simple **two-threshold structure**: accept if weak score > τ_accept, reject if < τ_reject, escalate to strong verification in between. An online algorithm maintains these thresholds with provable error guarantees **without assumptions on the query stream, LLM, or weak verifier**.

## Evidence

- Proved optimal over any population of queries (not just average-case)
- Distribution-free online algorithm controls both Type I (incorrect accept) and Type II (incorrect reject) error rates simultaneously
- Weak verifier value governed by calibration × sharpness — a well-calibrated but unsharp verifier is nearly useless

## Mechanism / Why

When the weak verifier is confident (extreme scores), it's reliably correct → no need for expensive verification. In the uncertain middle band, errors concentrate → escalation is worth the cost. The online algorithm tracks empirical error rates and contracts/expands thresholds to maintain guarantees even under distribution shift.

## Implications

### 1. Direct architecture for our sentinel layer
Our sentinels (Layer 2) are weak verifiers. This gives the theoretical foundation for when to trust them vs. escalate to deep verification (AEGIS forensics, courtroom debate). Currently we lack a principled escalation policy.

### 2. CIVC early-warning mechanism (H-093)
If the weak verifier's uncertainty spikes (more queries falling in the escalation band), that signals verification degradation — exactly the onset of Complexity-Induced Verification Collapse. Threshold contraction = automatic response.

### 3. Calibration as the key sentinel metric
Don't just measure sentinel accuracy — measure calibration (Brier Score, as DD#724 already suggests). A miscalibrated sentinel with high accuracy is dangerous; a calibrated one with moderate accuracy is safely usable.

## Actionable

- Design sentinel outputs as calibrated scores, not binary pass/fail
- Implement two-threshold escalation in verification orchestration
- Monitor escalation frequency as a system health metric (rising = sentinel degradation)

## Open Questions

- How to handle ensembles of weak verifiers (multiple sentinels)?
- What happens when strong verification is also fallible?
- Practical calibration methods for LLM-based sentinels


[SIG: 1776580498:1dfe1597]
