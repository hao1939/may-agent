# DD#781 — HINTBench: Intrinsic Non-Attack Agent Failures

**Paper**: [2604.13954] HINTBench: Horizon-agent Intrinsic Non-attack Trajectory Benchmark
**Authors**: Wang et al. (2026)
**Rating**: ★★★★★

## Core Contribution

HINTBench is the first benchmark specifically targeting **intrinsic** agent failures — unsafe trajectories that emerge under benign conditions without any external attack. 629 agent trajectories (523 risky, 106 safe) averaging 33 steps each, with three evaluation tasks: risk detection, risk-step localization, and failure-type identification.

## Key Findings

1. **Trajectory-level detection is easy; step-level localization is hard**: Strong LLMs detect risky trajectories well but drop to <35 Strict-F1 on localizing the specific risky step. This mirrors our EXP-099 finding that errors are easy to observe in aggregate but hard to attribute at the step level.

2. **Five-constraint taxonomy**: Intrinsic failures organized into 5 constraint types. This taxonomic approach parallels AgentErrorTaxonomy (DD#668) but focuses on non-adversarial failures specifically.

3. **Guard model transfer failure**: Existing safety guard models (designed for attack scenarios) transfer poorly to intrinsic risk detection. The failure modes are fundamentally different — not prompt injection or jailbreak, but latent propagating errors.

## Relevance to Our System

- **Directly validates our behavioral failure stack (CR#345, CR#320)**: Our finding that linguistic hedging (EXP-101) doesn't predict failures while behavioral signals do is consistent with HINTBench's finding that intrinsic failures are structurally different from attack-induced ones.
- **Step-level localization gap**: The <35 F1 on step localization is exactly the problem MASC (DD#667) and TrajectoryGuard (DD#682) try to solve. Our 4-layer monitoring architecture (CR#343) addresses this via runtime behavioral signals rather than post-hoc LLM judgment.
- **Extends CR#335/CR#339**: Intrinsic failures that "remain latent, propagate across long-horizon execution" is the same cascade phenomenon as CIVC (H-093).

## Predictions

- P-781a: HINTBench step-localization F1 would improve significantly (~+15pp) with trajectory anomaly detection (DD#682 approach) vs LLM-as-judge.
- P-781b: The five-constraint taxonomy will partially overlap with EXP-099's cascade archetypes (Tool Spiral, Comprehension Cascade, Drift-to-Decay).

## For EXP-XXX

Bob: Consider using HINTBench trajectories as external validation set for testing cascade detection methods. The 33-step average and step-level annotations make it ideal for validating behavioral failure prediction approaches.
