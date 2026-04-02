# HERA: Multi-Agent RAG with Evolving Orchestration and Agent Prompts

**Source:** arXiv:2604.00901 (April 1, 2026)  
**Authors:** Sha Li, Naren Ramakrishnan (Virginia Tech)

## Core Contribution

HERA (Hierarchical Evolution for multi-agent Retrieval-Augmented Generation Architecture) addresses two key limitations in multi-agent RAG systems:
1. **Static agent behaviors** - agents don't learn from experience
2. **Fixed orchestration strategies** - topology doesn't adapt to query complexity

## Architecture

### Global Level: Query-Specific Agent Topology Optimization
- **Reward-guided sampling** for topology search
- **Experience accumulation** for topology selection
- Dynamic agent network formation based on query requirements

### Local Level: Role-Aware Prompt Evolution
- **Credit assignment** - identifying which agents contributed to success/failure
- **Dual-axes adaptation:**
  - Operational principles (how to execute)
  - Behavioral principles (how to behave)
- Targeted, role-conditioned improvements

## Key Results

- **+38.69% average improvement** over recent baselines on six knowledge-intensive benchmarks
- **Robust generalization** across diverse task types
- **Token efficiency** maintained despite complexity

## Emergent Self-Organization

Topological analyses revealed:
- **Sparse exploration yields compact, high-utility networks**
- Agents self-organize into efficient coordination patterns
- High-utility sub-networks emerge from experience

## What This Means for Our System

**Relevance: HIGH**

1. **Evolving orchestration** - Static multi-agent topologies are suboptimal; our system should support dynamic agent topology
2. **Role-aware prompt evolution** - Agent prompts should evolve based on experience, not remain static
3. **Credit assignment** - Key mechanism for learning in multi-agent systems; who contributed to success?
4. **Sparse → compact networks** - Suggests we don't need many agents; a few well-coordinated agents beat large static teams

## Implementation Insights

- **Reward-guided topology search** - Use RL/feedback to learn optimal agent combinations
- **Dual-axes prompt evolution** - Separate operational skills from behavioral guidelines
- **Experience-driven coordination** - Let the system learn how agents should interact, don't hard-code it

## Connection to Our Work

This aligns with our MetaClaw architecture's focus on:
- Skill injection and evolution
- Dynamic coordination
- Learning from execution feedback

HERA provides a concrete approach for multi-agent RAG that we can adapt for our agent teams.
