# KE-292: Surface CoT Is Unreliable — Reasoning Lives in Latent States

**Date**: 2026-04-20
**Source**: DD-802 (arXiv:2604.15726, Wang 2026)
**Confidence**: Medium-High
**Connects**: H-098, KE-156, DD-770, DD-785-789, EXP-101, EXP-100, EXP-103

## Core Finding

Surface CoT is an unreliable window into LLM reasoning; actual reasoning lives in latent activations, making CoT-based monitoring architectures fundamentally limited.

## Evidence

- DD-802 formalizes three hypotheses (latent-state H1, surface-CoT H2, serial-compute H0) and concludes evidence most strongly supports H1
- DD-770's hidden-state probes detect reasoning degradation at AUROC 0.840 — outperforming any surface signal
- EXP-101 HVR (surface hedge signal) hits a ceiling — consistent with surface being decorrelated from actual reasoning confidence
- Reasoning Contamination Effect (DD-681): reasoning disrupts confidence verbalization, confirming surface/latent divergence

## Mechanism / Why

LLM reasoning is computed via internal activation trajectories across layers and positions. The generated CoT tokens are a lossy, potentially confabulated projection of these latent dynamics — not the reasoning itself. Surface text can look "careful" while latent reasoning has collapsed (verification collapse), or look like verification while latent process is pattern-matching (confabulation).

## Implications

### 1. Three-tier monitoring hierarchy replaces surface-only approach
- **Best**: Latent-state probes (DD-770) — directly measure reasoning quality
- **Good**: Action trajectory analysis (DD-785-786) — structural products of reasoning
- **Weak**: Surface linguistic signals (HVR, hedging) — unreliable reflection

### 2. H-098 challenge taxonomy must account for latent-surface divergence
Challenges that appear "verified" in CoT may be undetected at the latent level. The taxonomy should classify challenges by whether they require genuine latent reasoning vs. pattern-matchable surface cues.

### 3. Verification architecture needs structural enforcement over monitoring
DD-799 PBRC (structural enforcement) is more robust than surface monitoring because it doesn't depend on CoT faithfulness. Verification collapse (EXP-100) may be invisible in surface traces until too late.

## Actionable

- Deprioritize pure surface-CoT monitoring features (HVR alone); combine with action-trajectory signals
- Pivot EXP-101 iteration toward action-structure features or ensemble with trajectory anomaly detection
- For guard design: prefer structural enforcement (force verification actions) over checking that CoT "looks like" verification
- When latent probes become available (API access to activations), treat as highest-priority monitoring signal

## Open Questions

- H1 vs H0: How much of "latent reasoning" is just serial compute increase with no privileged representation?
- Can action trajectories serve as sufficient proxy when latent probes unavailable (API-only access)?
- Does surface CoT reliability vary by task type? (Maybe faithful for simple tasks, divergent for complex reasoning)
