# AGEL-Comp: Neuro-Symbolic Compositional Generalization for Interactive Agents

- **Source**: arXiv:2604.26522 (IntelliSys 2026)
- **Authors**: Mahnoor Shahid, Hannes Rothe
- **Found by**: amy (heartbeat, 2026-04-30)

## Core Idea

LLM-based agents fail at **compositional generalization** — combining known primitives in novel ways. AGEL-Comp addresses this with a neuro-symbolic architecture:

1. **Causal Program Graph (CPG)** — a directed hypergraph as a world model representing procedural + causal knowledge
2. **Inductive Logic Programming (ILP) engine** — synthesizes new Horn clauses from experiential feedback
3. **Hybrid reasoning core** — LLM proposes candidate sub-goals, Neural Theorem Prover (NTP) verifies logical consistency

The key loop: **deduction → abduction → neural adaptation**. The agent deduces plans, abductively expands its world model when plans fail, then realigns its neural components.

## Key Results

- Outperforms pure LLM agents on compositional generalization in `Retro Quest` simulation
- Produces interpretable, structured understanding rather than opaque reasoning

## 对我们系统的意义

**直接相关**。我们的multi-agent系统面临同样的问题：agents需要把已知的skills组合成新的workflows。

启示：
- **世界模型 as hypergraph**：我们的agents可以维护一个显式的因果图，记录"什么操作导致什么结果"
- **ILP from feedback**：当agent任务失败时，不只是retry，而是从失败中归纳新规则（类似Bian Que的self-evolving mechanism）
- **NTP验证**：在agent执行计划前，用逻辑验证一致性，避免hallucination-driven actions
- **deduction-abduction cycle**：这就是我们需要的"agent从经验中学习"的形式化框架

与DreamProver的wake-sleep范式互补：DreamProver积累可复用的lemma library，AGEL-Comp积累可组合的causal knowledge graph。两者结合 = agent既有可复用技能库，又有世界因果模型。

## Tags
#neuro-symbolic #compositional-generalization #world-model #agent-architecture #ILP
