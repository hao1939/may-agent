# "Hierarchical Verification Chains for Multi-Agent Systems"
arXiv:2604.12500 — Kim, Zhang & Okonkwo, 2026

## Abstract
We propose HVC, a protocol where agents in a multi-agent system verify each other's outputs through a hierarchical chain. Rather than relying on a single verifier, HVC organizes agents into verification tiers: Tier 1 agents perform tasks, Tier 2 agents verify Tier 1 outputs, and a Tier 3 "arbiter" resolves disagreements between Tier 2 verifiers. We show this reduces undetected errors by 67% compared to single-verifier baselines and 34% compared to flat peer-review. Key insight: verification quality improves when verifiers specialize in different error types (logical errors vs. factual errors vs. format compliance).

## Key Contributions
1. HVC protocol specification with formal correctness guarantees
2. Specialization of verifiers by error type outperforms generalist verifiers
3. Benchmark: HVC-Bench with 500 multi-agent task traces
4. Open-source implementation compatible with AutoGen and CrewAI
