# The Landscape of Agentic RL for LLMs: A Survey
- **Source**: arXiv:2509.02547 (v4, Jan 24, 2026)
- **Authors**: Guibin Zhang, Hejia Geng, Xiaohang Yu, et al. (Oxford, Shanghai AI Lab, NUS, UIUC, UCL, etc. - 16 institutions)
- **Citation Count**: 3 in Amy-Kimi archive
- **Archive Date**: 2026-03-13

## Executive Summary
This is a **foundational survey paper** that formalizes the paradigm shift from conventional LLM RL (PBRFT) to Agentic RL. The paper synthesizes 500+ works and provides the first unified theoretical framework through MDP/POMDP formalization.

## Core Contribution: Formal Distinction

### PBRFT (Preference-Based RFT) = Degenerate MDP
```
⟨S_trad, A_trad, P_trad, R_trad, T=1, γ=1⟩
```
- Single-step decision problem
- Static prompt → single response → episode ends
- Optimizes output sequences on fixed dataset

### Agentic RL = Temporally Extended POMDP
```
⟨S_agent, A_agent, P_agent, R_agent, γ, O⟩
```
- Multi-step sequential decision-making
- Partial observations: o_t = O(s_t)
- Dynamic environment transitions: s_{t+1} ~ P(s_{t+1}|s_t, a_t)
- Step-wise rewards combining sparse task + dense sub-rewards

## Key Formal Comparison

| Concept | PBRFT | Agentic RL |
|---------|-------|------------|
| State Space | {s_0} single prompt | s_t ∈ S_agent; o_t = O(s_t); T>1 |
| Action Space | Pure text | A_text ∪ A_action |
| Transition | Deterministic terminal | Dynamic P(s_{t+1}\|s_t, a_t) |
| Reward | Single scalar r(a) | Step-wise R(s_t, a_t) |
| Objective | E[r(a)] | E[∑γ^t R(s_t, a_t)] |

## Unified Action Space

**A_agent = A_text ∪ A_action**

- **A_text**: Free-form natural language (for human/machine interpretation)
- **A_action**: Environment-interactive behaviors delimited by `<action_start>` / `<action_end>`
  - Tool invocations: `call("search", "query")`
  - Environment interactions: `move("north")`
  - **Recursively composable**: Actions can be sequences (a_1, ..., a_k)

## Capability-Centered Taxonomy (Section 3)

1. **Planning** - Goal decomposition, plan generation/execution/refinement
2. **Tool Use** - API invocation, RAG, external tool integration
3. **Memory** - Working memory, long-term storage, retrieval mechanisms
4. **Reasoning** - Chain-of-thought, reflection, multi-step inference
5. **Self-Improvement** - Iterative refinement without human intervention
6. **Perception** - Multimodal input processing (visual, audio, etc.)

## Applications Surveyed (Section 4)

- Search agents
- GUI navigation
- Code generation
- Mathematical reasoning
- Multi-agent systems
- Visual & embodied interaction

## Consolidated Resources (Section 5)

- 50+ open-source environments
- RL frameworks and benchmarks
- Practical compendium for researchers

## Open Challenges (Section 6)

1. **Trustworthiness** - Reliable behavior in open-ended settings
2. **Scalable Training** - Sample-efficient RL for large action spaces
3. **Complex Environment Construction** - Realistic simulation
4. **Evaluation Frameworks** - Standardized metrics across domains

## Relevance to OpenClaw

### ✅ Validated Design Decisions
1. **POMDP framing**: OpenClaw's temporally extended formulation aligns with paper's theoretical foundation
2. **Main↔Sub-agent architecture**: Centralized topology aligns with "context constraint" optimal solution
3. **Unified action space**: Text + Tool invocation matches A_text ∪ A_action formalization
4. **Step-wise rewards**: Hierarchical reward design matches paper's sub-reward mechanism

### 🔗 Connections to Other Papers
- **Phase Transition** (arXiv:2601.17311): s>β condition for MA > SA under budget constraints
- **SkillRL** (arXiv:2602.08234): Recursive skill composition within A_action space
- **MemSkill** (arXiv:2602.02474): Self-improvement through training-time evolution
- **TDAD** (arXiv:2603.08806): Compile-time verification vs runtime execution

### 🎯 Strategic Implications
This survey **establishes the theoretical vocabulary** for the entire field. OpenClaw's architecture can now be precisely described using:
- POMDP semantics for the core loop
- Capability-centered taxonomy for feature prioritization
- Unified action space for tool design

## References
- arXiv: https://arxiv.org/abs/2509.02547
- GitHub: https://github.com/xhyumiracle/Awesome-AgenticLLM-RL-Papers
- HuggingFace: https://huggingface.co/papers/2509.02547
- Published: Transactions on Machine Learning Research

---
**L3 Flag**: #840 - Formal POMDP foundation for OpenClaw architecture
