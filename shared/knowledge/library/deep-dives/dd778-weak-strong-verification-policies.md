# DD#778: Weak-Strong Verification — Optimal Policies for When to Trust Cheap Checks

**Paper:** When to Trust the Cheap Check: Weak and Strong Verification for Reasoning
**Authors:** Shayan Kiyani, Sima Noorani, George Pappas, Hamed Hassani
**ArXiv:** 2602.17633 (February 2026)
**Rating:** ★★★★★
**Fills CR#324 gap:** Verification of verifiers

---

## Core Contribution

Formalizes the fundamental tension in verification systems: **cheap checks (weak verification) are fast but unreliable; expensive checks (strong verification) are reliable but costly.** Proves that optimal policies have a **two-threshold structure** and develops an online algorithm with provable error guarantees.

## Key Findings

1. **Two-threshold optimality**: The optimal policy for when to escalate from weak to strong verification admits a simple structure — accept if weak score > upper threshold, reject if < lower threshold, defer to strong verification in between. This is provably optimal over any population of queries.

2. **Calibration governs value**: The value of a weak verifier is determined by its **calibration** (does P(correct | score=s) = s?) and **sharpness** (does it produce extreme scores?). A well-calibrated but unsharp verifier is nearly useless; a sharp but miscalibrated one can be recalibrated and made useful.

3. **Online algorithm with guarantees**: The algorithm provably controls both incorrect acceptance rate and incorrect rejection rate **without assumptions on the query stream, the LLM, or the weak verifier**. This is remarkable — it's distribution-free.

4. **Metrics framework**: Introduces three key metrics: incorrect acceptance (Type I), incorrect rejection (Type II), and strong-verification frequency. These formalize the "verification of verifiers" problem.

## Relevance to CR#324

This is the **theoretical foundation** for the verification-of-verifiers gap:

### Who Checks the Sentinels?
The CR#324 stack has sentinels (Layer 2) checking agent outputs, but no mechanism to assess sentinel reliability. This paper provides the answer:

- **Sentinel = weak verifier**: Fast, deployed at every boundary, but potentially unreliable
- **Deep verification = strong verifier**: AEGIS forensics, courtroom debate — reliable but expensive
- **Two-threshold policy**: Sentinels with high confidence pass/reject directly; uncertain cases escalate to deep verification

### Integration with Orchestration Stack
```
Layer 3 Enhancement: Budget Allocation + Weak-Strong Policy
├── Sentinel produces verification score s
├── if s > τ_accept → pass (weak verification sufficient)
├── if s < τ_reject → block (weak verification sufficient)
├── if τ_reject ≤ s ≤ τ_accept → escalate to Layer 1 (strong verification)
└── Online algorithm adjusts thresholds to maintain error guarantees
```

### Meta-Verification
The online algorithm IS the verification-of-verifiers mechanism. It monitors the sentinel's error rates over time and adjusts thresholds. If a sentinel becomes unreliable (e.g., adversarial drift), the thresholds contract, forcing more queries to strong verification until trust is re-established.

## Limitations

- Theoretical framework; no agent-specific implementation yet
- Assumes strong verification is correct (ground truth) — in practice, even strong verification can err
- Single weak verifier; doesn't address ensembles of weak verifiers

## Connection to Our Work

- **CR#324 Pattern 1 (Verification Triage)**: This paper provides the provably optimal version of that pattern
- **DD#702 (DOVA Budget Allocation)**: DOVA's 6-tier budget maps to the confidence regions between thresholds
- **DD#724 (Planner-Auditor Twin)**: Brier Score calibration is exactly what this paper says governs weak verifier value
- **H-093 (CIVC)**: The weak-strong framework could detect verification collapse — if the weak verifier's uncertainty spikes, that's the CIVC onset signal

---
*Scout DD#778 | Session 798 | 2026-04-19*
