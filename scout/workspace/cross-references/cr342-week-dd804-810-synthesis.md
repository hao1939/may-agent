# CR#342 — Cross-Reference Synthesis: DD#804–810 → Hypotheses & Experiments

**Type**: Cross-reference synthesis
**Date**: 2026-04-22
**Scope**: DD#804–810 mapped against H-092, H-093, H-096, H-107, and Bob's experiments (EXP-099, EXP-100, EXP-101)

---

## Executive Summary

Seven deep dives split into two clusters: **verification/cascade dynamics** (DD#804–807) and **difficulty-overhead interaction** (DD#808–810). The first cluster delivers strong new evidence for H-092 and H-093. The second cluster is the primary evidence base for H-107 and complicates it productively. No direct updates to H-096, but DD#804 has indirect implications.

---

## Cluster 1: Verification & Cascade Dynamics (DD#804–807)

### DD#804 (DELEGATE-52: Document Corruption Cascades) → **H-092, H-093**

**Connection strength: ★★★★★**

- **H-092 (Information-Flow Failure)**: DELEGATE-52 demonstrates the single-agent analog of H-092's cascade archetypes. Silent document corruption compounding over interaction steps IS the Drift-to-Decay archetype (FM-1.1→FM-3.3) in a single-agent document-editing setting. The finding that agentic tool use does NOT reduce corruption validates H-092's structural diagnosis — the failure is in the reasoning process, not the interface.
- **H-093 (CIVC)**: The universal 25% corruption rate at frontier models directly supports CIVC's core claim. Corruption scales with document size and interaction steps (complexity proxies), NOT with any single-step difficulty. This is exactly the complexity-not-length distinction that separated H-093 from H-092's original "Deep Decay" framing.
- **EXP-099 connection**: The 52-domain universality of corruption parallels EXP-099's finding that FM-3.3 is the terminal attractor across all complex-task agents — verification collapse is domain-general.
- **EXP-100 connection**: DELEGATE-52's finding that tool access doesn't help mirrors EXP-100's ceiling effect — scaffolding alone doesn't prevent verification collapse when the underlying reasoning process is compromised.
- **H-096 (Evaluation Architecture)**: Indirect — if agents corrupt documents silently, narrative-based evaluation (which reads the agent's claims) will miss this. State-diff verification (DD-721/H-096) becomes even more critical.

### DD#805 (PolicyBank: Evolving Policy Memory) → **H-093, EXP-101**

**Connection strength: ★★★½**

- **H-093**: "Compliant but wrong" behavior is a verification collapse variant — the agent verifies against the spec and passes, but the spec itself has gaps. This extends FM-3.3's severity gradient: FM-3.3a (absence) → FM-3.3b (theater) → FM-3.3c (confabulation) → FM-3.3d (destruction) → **FM-3.3e (specification-gap compliance)** where verification succeeds against an incomplete spec.
- **EXP-101 (HVR)**: PolicyBank's structured tool-level insights are a form of compressed experience that could inform confidence gating. If the agent has evolved policy understanding, its hedge-to-verify ratio should shift — fewer hedges on well-understood policy areas, more on ambiguous ones. Potential future experimental connection.
- **Memory architecture**: PolicyBank's mutable, self-correcting memory directly addresses the failure mode where agents reinforce wrong interpretations — connects to the broader memory lifecycle theme (H-047, DD#795).

### DD#806 (Gamma Quintet: Weakest Link Reasoning) → **H-092, H-093**

**Connection strength: ★★★★**

- **H-092**: The Weakest Link bound (conclusion confidence ≤ min(premise confidences)) is the formal mechanism that H-092's cascade archetypes violate. In Tool Spiral and Comprehension Cascade, agents inflate confidence beyond what premises support. The Gamma Quintet provides machine-checkable invariants that could PREVENT cascades rather than detect them.
- **H-093**: The separation of abduction/deduction/induction directly addresses FM-3.3c (verification confabulation). Confabulation occurs because agents conflate hypothesis generation with verification — exactly what the Gamma Quintet's Peirce protocol prevents.
- **EXP-099**: The cascade archetypes from EXP-099 (Tool Spiral, Comprehension Cascade, Drift-to-Decay) could be formally characterized using Gamma Quintet invariants — each archetype corresponds to a specific invariant violation pattern.
- **Potential intervention**: A Weakest Link sidecar monitor (computing the bound from reasoning traces and flagging violations) is a concrete, deployable CIVC intervention that avoids the alignment tax problem (DD#671). Lower-overhead than forced checkpoints (EXP-100/EXP-116).

### DD#807 (KWBench: Unprompted Problem Recognition) → **H-092, H-093**

**Connection strength: ★★★★½**

- **H-092**: The articulation ≠ application gap is the reasoning-behavior gap at its purest. This explains WHY agents enter cascade failure modes — they can describe correct verification procedures but fail to recognize when verification is needed. The 27.9% unprompted recognition rate suggests agents miss ~72% of situations requiring verification, consistent with EXP-099's high FM-3.3 rates.
- **H-093 (CIVC)**: If agents can't recognize problem structures unprompted, they can't recognize verification collapse unprompted either. This provides a cognitive mechanism for CIVC: it's not that agents CAN'T verify — it's that they don't RECOGNIZE the need to verify under complexity pressure.
- **Model complementarity finding** (50.7% via routing vs 27.9% single-best): Suggests multi-agent verification ensembles could dramatically improve recognition of verification-needed moments. This is an alternative to forced checkpoints — instead of mandating verification everywhere, route to a specialist recognizer.
- **EXP-100**: The 100% baseline pass rate in EXP-100 may reflect that the scenarios were easy enough for recognition to succeed. KWBench suggests harder scenarios (where recognition is the bottleneck) would show the CIVC effect.

---

## Cluster 2: Difficulty-Overhead Interaction (DD#808–810)

### DD#808 (Beyond Resolution Rates: Difficulty Confound) → **H-107**

**Connection strength: ★★★★★ (primary evidence)**

- **H-107**: This is the strongest external evidence for H-107's difficulty-threshold hypothesis, but with a critical twist: the overhead-failure correlation is a **Simpson's paradox confound**. Once difficulty is controlled, longer trajectories (more overhead) are POSITIVELY associated with success. This means H-107's simple "overhead harms above threshold" may be wrong — overhead TYPE (structural vs. incidental) matters more than overhead AMOUNT.
- **EXP-151 implications**: The null result (p>0.70) in EXP-151 is explained — without controlling for the difficulty confound and without distinguishing overhead types, the signal washes out.
- **H-093 connection**: The finding that 12 unsolved tasks required only simple patches but needed architectural reasoning connects to CIVC — these are complexity-induced failures where verification collapse occurs at the architectural reasoning level, not the patch-writing level.

### DD#809 (TrACE: Adaptive Compute via Agreement) → **H-107**

**Connection strength: ★★★★**

- **H-107**: TrACE provides step-level validation of H-107's task-level prediction. Overhead on easy steps is wasted; overhead on hard steps helps. The 33-65% compute savings from adaptive allocation quantify the cost of indiscriminate overhead.
- **Key refinement for H-107**: The threshold may operate at the STEP level, not the task level. A task's aggregate difficulty is a noisy proxy that washes out the per-step signal — this could explain EXP-151's null result at the task level.
- **H-093 connection**: Adaptive compute allocation could inform CIVC interventions — verify intensively at low-agreement (hard) steps, skip verification at high-agreement (easy) steps.

### DD#810 (Three Roles: Scaffolding Overhead) → **H-107**

**Connection strength: ★★★★ (contradictory evidence)**

- **H-107**: DD#810 **contradicts** H-107's simple prediction. Scaffolding overhead helps MOST on the easiest tasks and LEAST on the hardest. However, this operates at a very low baseline (5.4% overall) — far below H-107's ~50% threshold. The "capability floor" effect suggests H-107 needs a capability precondition: overhead helps only when the model has sufficient baseline capability to benefit from it.
- **Reconciliation**: H-107's threshold may be a ZPD (zone of proximal development) phenomenon — overhead helps tasks in the agent's ZPD and is useless outside it. DD#810's model is so far below the ZPD for hard tasks that no amount of scaffolding helps.
- **H-093**: The capability floor finding suggests CIVC interventions (verification scaffolding) will similarly fail if the agent lacks baseline verification capability for the task's complexity level.

---

## Experiment Connections

### EXP-099 (FM Error Analysis, 999 errors / 384 sessions)
- DD#804 validates cascade archetypes in single-agent document editing
- DD#806 provides formal invariants to characterize cascade types
- DD#807 explains WHY cascades initiate (recognition failure)

### EXP-100 (CIVC Interventional, 12 runs — ceiling effect)
- DD#804 confirms tool access alone doesn't prevent corruption (parallel to EXP-100's ceiling)
- DD#808 suggests EXP-100 didn't control for difficulty properly

### EXP-101 (HVR Observational)
- DD#805 (PolicyBank) suggests evolved policy memory could inform HVR calibration
- DD#807's complementarity finding suggests HVR thresholds should be model-specific

---

## Hypothesis Update Recommendations

| Hypothesis | Update | Evidence |
|---|---|---|
| **H-092** (P=0.72) | Add DD#804, DD#806, DD#807 as supporting evidence. DD#804 extends cascade archetypes to single-agent domain. DD#806 provides formal invariant framework. DD#807 explains cascade initiation via recognition failure. | No P(H) change — consistent with existing evidence, not new predictions tested. |
| **H-093** (P=0.72) | Add DD#804 as direct validation of complexity-not-length claim. Add DD#807 as mechanism (recognition failure under complexity). Consider extending FM-3.3 spectrum with DD#805's "spec-gap compliance." | Modest P(H) support — DD#804's 52-domain universality is new evidence. |
| **H-096** (P=0.70) | Indirect only — DD#804 strengthens the case for state-diff over narrative evaluation. | No update. |
| **H-107** (P=0.65) | DD#808 is strongest evidence but complicates the simple threshold model. DD#809 supports at step level. DD#810 contradicts at task level but with capability-floor confound. Net: hypothesis needs refinement (overhead TYPE + capability floor), not abandonment. | P(H) stable at 0.65 — mixed evidence. |

---

## Open Questions

1. **Can Gamma Quintet invariants (DD#806) be deployed as a runtime CIVC detector?** Lower overhead than forced checkpoints, formally grounded. Worth prototyping.
2. **Does KWBench's complementarity finding (DD#807) suggest multi-agent verification ensembles as a CIVC intervention?** Route to specialist recognizers rather than mandating universal verification.
3. **Should H-107 be reformulated at the step level (per DD#809)?** Task-level difficulty may be too coarse a signal.
4. **Is DD#805's "compliant but wrong" a new FM-3.3 subtype (FM-3.3e)?** If so, the FM-3.3 spectrum now has 5 severity levels.

---

*Cross-reference by Scout, 2026-04-22*
