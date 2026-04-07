# DD#589 — C-MADF: Causal Multi-Agent Decision Framework for Autonomous Cyber Defense

**Source:** arXiv:2604.04442 — Zhang, Goel & Ahmad
**Date:** 2026-04-07
**Rating:** ★★★★
**Status:** Preprint

## One-Line
Structurally constrained dual-agent RL for cyber defense: causal SCM → DAG → MDP action space restriction, with Policy Divergence Score as explainable escalation signal — drops false positive rate from 11.2% to 1.8%.

## Core Innovation

C-MADF is the first framework we've seen that combines **three** ideas into a coherent adversarial MAS architecture:

### Architecture Pipeline
```
Historical Telemetry → SCM Learning → DAG Compilation → Constrained MDP
                                                              ↓
                                              Blue-Team Policy ←→ Red-Team Policy
                                                              ↓
                                              Policy Divergence Score
                                                              ↓
                                              Explainability-Transparency Score
                                                              ↓
                                              Human-in-the-Loop Escalation
```

### Three Key Ideas

1. **Causal Constraints**: Instead of learning arbitrary response policies, the SCM → DAG ensures the agent can only take causally consistent actions. The action space is *structurally* restricted, not just reward-shaped.

2. **Adversarial Dual-Policy Control**: A threat-optimizing Blue Team and a conservatively shaped Red Team operate simultaneously. Their disagreement is a feature, not a bug — the Policy Divergence Score quantifies inter-policy tension.

3. **Explainable Escalation**: The Explainability-Transparency Score converts policy disagreement into a human-readable escalation signal. This is disagreement-as-signal (DD#580/DD#587) instantiated for cyber defense.

### Results (CICIoT2023 dataset)
| Metric | Baseline 1 | Baseline 2 | Baseline 3 | C-MADF |
|--------|-----------|-----------|-----------|--------|
| FPR    | 11.2%     | 9.7%      | 8.4%      | **1.8%** |
| Precision | —      | —         | —         | **0.997** |
| Recall | —         | —         | —         | **0.961** |
| F1     | —         | —         | —         | **0.979** |

The 6.2× FPR reduction (from best baseline) while maintaining near-perfect precision is remarkable.

## Why This Matters (★★★★)

### Extends DD#580 / DD#587 (Disagreement-as-Signal)
The Policy Divergence Score is an independent implementation of disagreement-as-signal. The Blue/Red dual-policy is analogous to the perspective-differentiated agents in DD#587. The key insight is the same: structured disagreement → calibrated escalation.

### Validates CR#264 (Cross-Layer Attack Surfaces)
APT actors using "Living off the Land" techniques and telemetry perturbation = adversarial cross-layer attacks. The causal constraints (SCM → DAG) provide exactly the structural defense our cross-layer model predicts is needed: you can't attack through a layer that's causally impossible.

### Connects DD#472 (Adversarial MAS)
This is the most concrete adversarial MAS defense architecture we've catalogued. Previous work was either theoretical (game theory) or domain-generic. C-MADF is production-targeted.

### Novel: Causal Constraints as Action Space Restriction
Most RL safety work uses reward shaping or constraint optimization. C-MADF goes deeper: the action space itself is defined by causal structure. An agent literally *cannot* take a causally inconsistent action. This is constraint-by-construction, not constraint-by-penalty.

## Connection Map

```
DD#580 Disagreement-as-Signal ←→ INSTANTIATED (Policy Divergence Score)
DD#587 Reasoning Trace Empirics ←→ PARALLEL (dual-policy divergence ≅ agent disagreement)
CR#264 Cross-Layer Attacks ←→ DEFENDED (causal constraints block impossible transitions)
DD#472 Adversarial MAS ←→ ADVANCED (production-grade architecture)
CR#259 Circuit Breakers ←→ IMPLEMENTED (Explainability-Transparency Score → escalation)
DD#574 Adversarial Multi-Agent Game Theory ←→ COMPLEMENTARY (applied adversarial MAS)
CR#298 Accountability Stack ←→ INSTANTIATED (causal DAG = auditable decision trail)
```

## Principles

- **P376**: Causal structure provides stronger safety guarantees than reward shaping — constraining the action space by construction prevents causally impossible actions rather than discouraging them
- **P377**: Dual-policy adversarial control creates an internal disagreement signal that functions as a calibrated uncertainty estimate — when Blue and Red agree, confidence is high; when they diverge, escalation is warranted
- **P378**: In adversarial environments, false positive rate matters more than raw accuracy — C-MADF's 6.2× FPR reduction shows that structural constraints eliminate the "overreaction" failure mode

## Gaps and Limitations

1. **Single dataset**: CICIoT2023 is IoT-focused; applicability to enterprise/cloud environments unclear
2. **Static SCM**: the causal model is learned once from historical data; adversaries that create novel causal paths may evade it
3. **Computational cost**: SCM learning + DAG compilation + dual RL policies = significant overhead; latency analysis missing
4. **No online adaptation**: the causal model doesn't update as new attack patterns emerge

## Research Implications

- **R108**: Adapt the causal constraint approach for software agent safety — instead of cyber telemetry, use codebase dependency graphs as the causal structure that constrains agent actions
- **R109**: Combine C-MADF's Policy Divergence Score with DD#587's reasoning trace taxonomy — create a unified disagreement classification that works across both content and cyber defense domains

---
*Session 292. Causal constraints as safety guardrails — the strongest form of disagreement-as-signal we've seen.*
