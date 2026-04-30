# arXiv Triage — Apr 28-30, 2026 (cs.MA)

*Triaged: 2026-04-30*

## ★★★★★ High Relevance

### [2604.26561] Preserving Disagreement: Architectural Heterogeneity in Multi-Agent Policy Simulation
- **Key insight**: Assigning different LLM models to different agent perspectives significantly reduces artificial consensus (70.9% → 46.1% first-choice concentration). Architectural heterogeneity operates differently in value-laden vs accuracy-oriented tasks.
- **Relevance**: Directly applicable to our multi-agent system — if all agents use the same model, they'll converge artificially. Model diversity = opinion diversity when no ground truth exists.
- **Actionable**: Consider heterogeneous model assignment for adversarial verification (different verifiers using different models).
- **Metric**: "Trustworthy tension rate" as diagnostic for small-model deliberation.

### [2604.25899] Pythia: Predictability-Driven Agent-Native LLM Serving
- **Key insight**: Multi-agent workflows have structural predictability that current serving systems waste. Key bottlenecks: low prefix cache hit rates, resource contention from long-context, queuing delays from bad scaling.
- **Relevance**: Infrastructure-level optimization for multi-agent systems. Our system could benefit from workflow-aware serving.
- **Actionable**: Capture workflow topology at serving layer → better prefix caching + scheduling.

## ★★★★ Notable

### [2604.24905] MultiHedge: Adaptive Coordination via Retrieval-Augmented Control
- **Key insight**: Memory-augmented retrieval > model scale for robustness in modular decision systems. LLM produces structured decisions conditioned on retrieved historical precedents.
- **Relevance**: Validates our hypothesis that context/memory matters more than model size for agent coordination.

### [2604.26805] Bian Que: Agentic Framework with Flexible Skill Arrangement
- Flexible skill arrangement for online system operations. Worth tracking for skill-composition patterns.

### [2604.12067] Frontier Coding Agents Implement AlphaZero Pipeline
- Coding agents can now implement full ML pipelines (AlphaZero for Connect Four). Capability milestone.

## ★★★ Lower Priority

- [2604.26220] AI shopping agents — role coherence in markets
- [2604.26522] AGEL-Comp — neuro-symbolic compositional generalization
- [2604.25567] MAPF replanning — when to replan in multi-agent pathfinding
- [2604.25161] Failure attribution for VLN agents (ACL 2026)
- [2604.24808] ITAS — multi-agent tutoring architecture
- [2604.25972] Survey: MADRL with GNN communication

## Hypotheses Generated

1. **H: Heterogeneous models reduce groupthink** — Using different model families for different verification perspectives should produce more genuine disagreement and better adversarial coverage.
2. **H: Workflow-aware serving can improve latency 2-5x** — Exploiting structural predictability of agent DAGs for prefix caching and scheduling.
