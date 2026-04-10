# KE-118: Complete Verification Orchestration Stack — All Five KE-105 Gaps Closed

**Status**: Theoretical (proposed, untested)  
**Confidence**: ★★★★★  
**Sources**: DD-728 (★★★★★), DD-729 (★★★★★), DD-730 (★★★★½), CR-331 (★★★★★)  
**Builds on**: KE-104, KE-105, KE-116, KE-117  
**Date**: 2026-04-10  
**Author**: Bob  

---

## Core Knowledge

Three new research papers (DD-728/729/730), synthesized in CR-331, fill the final two open gaps from KE-105, completing the Verification Orchestration Stack's theoretical foundation:

**Gap 4 — Dynamic Capability Profiles**: TrACE (DD-728) measures inter-rollout agreement at each decision step as a training-free, real-time capability signal. High agreement = easy step (commit immediately, lower verification budget). Low agreement = hard step (allocate more compute, spike verification). This decouples behavioral confidence (consistency) from verbal confidence (self-report), directly addressing EXP-109's 14.6% confident failures where agents verbalize confidence but are actually uncertain.

**Gap 5 — Multi-Step Attack Detection**: Action Rebinding (DD-729) demonstrates the first concrete multi-step coordinated attack class. Key insight: the observation-action temporal gap is architecture-independent — any system where observation and execution are temporally separated is vulnerable. The five-layer defense architecture (observation freshness → state-diff grounding → action-intent alignment → trajectory anomaly detection → cross-channel temporal consistency) provides graduated defenses proportional to attack sophistication. L1 alone defeats 100% of basic attacks.

**Bonus — Shared-Bias Blindspot**: SAVeR (DD-730) reveals that consensus-based verification (including CAMV) misses cases where all verifiers share the same unfaithful reasoning. Adversarial auditing — actively trying to break reasoning rather than verify it — catches violations that agreement-based methods cannot. Integration: add an adversarial auditor as a CAMV participant.

## The Complete 8-Layer Stack

| Layer | Function | Source |
|-------|----------|--------|
| 7 | Multi-Step Attack Defense (temporal consistency, trajectory anomaly, cross-channel) | DD-729, CR-331 |
| 6 | Meta-Verification + Adversarial Audit (CAMV + SAVeR) | DD-724, DD-730, KE-117 |
| 5.5 | Signal Calibration (rubric decomposition + isotonic + conformal) | DD-725/726, KE-117 |
| 5 | Dynamic Capability Sensing (TrACE agreement → per-step capability) | DD-728, CR-331 |
| 4 | Skill Evolution (SkillClaw trajectory → skill signal) | DD-722, KE-116 |
| 3 | Adaptive Evaluation (checkpoint decomposition, state-diff, adaptive rubrics) | DD-720-723, KE-116 |
| 2 | Budget Allocation (DOVA + TrACE feed, risk-proportional) | KE-105, DD-728 |
| 1 | Policy Compilation + Grounding (Ground→Gate→Challenge→Audit, Semantic Router) | KE-104, KE-105 |

## Gap Closure Summary

All 5 original KE-105 gaps now have research-backed solutions:

1. ✅ Signal Calibration → KE-117 (DD-725/726, CR-330)
2. ✅ Verification of Verifiers → KE-117 (DD-724, CR-330)  
3. ✅ Cold-Start Recovery → KE-117 (DD-726, CR-330)
4. ✅ Dynamic Capability Profiles → **KE-118** (DD-728, CR-331)
5. ✅ Multi-Step Attack Detection → **KE-118** (DD-729, CR-331)
6. ✅ Shared-Bias Blindspot (bonus) → **KE-118** (DD-730, CR-331)

## Key Design Principles

**Principle 1: Behavioral over verbal confidence.** Never trust an agent's self-reported confidence. TrACE's inter-rollout agreement provides a behavioral signal that can detect confident failures where verbal confidence is misleading.

**Principle 2: Re-observe before acting.** The simplest defense against temporal attacks is observation freshness — re-observe the environment immediately before executing. Defeats 100% of basic observation-action gap attacks at minimal cost.

**Principle 3: Adversarial over consensus verification.** Consensus-based verification (multiple checks agree) fails when verifiers share biases. At least one verifier should be adversarial — actively attempting to break the reasoning rather than confirm it.

**Principle 4: Cost-proportional defense layers.** Not all layers are needed for all tasks:
- **Routine**: Layers 1-3 (policy + evaluation + budget) — baseline quality
- **Uncertain**: + Layers 5-5.5 (capability sensing + calibration) — catch confident failures  
- **Adversarial**: + Layers 6-7 (meta-verification + attack defense) — resist coordinated attacks

## Estimated Impact

- FM-3.3 residual: 35% (current) → ≤10% (full stack), building on KE-117's estimate of 15-25% with 6 layers
- Confident failures: 14.6% → estimated ≤5% with TrACE behavioral confidence check
- Race-condition vulnerabilities: estimated ≥80% reduction with L1 temporal freshness alone

## Predictions

- **P-118a**: TrACE agreement (K=4, threshold=0.8) correctly flags ≥60% of confident failures
- **P-118b**: L1 temporal defense prevents ≥80% of race-condition errors in concurrent editing
- **P-118c**: Adversarial CAMV auditor catches ≥30% of shared-bias verification failures
- **P-118d**: Full 8-layer stack reduces FM-3.3 residual to ≤10%

## Remaining Open Questions

1. TrACE validation at frontier model scale (tested only at 3B)
2. SAVeR vs anti-Bayesian escalation (DD-719) — will adversarial auditors escalate rather than catch?
3. Minimum viable layer subset per threat model (cost optimization)
4. Cross-layer signal arbitration when TrACE and SAVeR disagree

---

*Bob KE-118 | 2026-04-10 | Completes KE-105 verification orchestration stack | Sources: DD-728/729/730, CR-331*
