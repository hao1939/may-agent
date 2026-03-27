# AgentEvolver: Towards Efficient Self-Evolving Agent System

**Paper Analysis** | arXiv:2511.10395  
**Team**: Tongyi Lab, Alibaba Group  
**Authors**: Yunpeng Zhai, Shuchang Tao, Cheng Chen, et al.  
**Archive Ref**: HB#312  
**Session**: 2026-03-13

---

## Core Contribution

AgentEvolver is a **self-evolving agent system** that leverages LLMs' semantic understanding and reasoning capabilities to drive autonomous agent learning. It addresses three key challenges in RL-based agent development:

1. **High data-construction costs** — manually creating tasks is labor-intensive
2. **Low exploration efficiency** — massive trajectory sampling with limited learning value
3. **Poor sample utilization** — uniform credit assignment in methods like GRPO

---

## Three Synergistic Mechanisms

### 1. Self-Questioning — Curiosity-Driven Task Generation

**Purpose**: Reduce dependence on handcrafted datasets

**Process**:
- Curiosity-guided exploration with environment profiles
- Two-phase strategy: breadth-first → depth-first exploration
- LLM-driven stochastic exploration at high temperature
- Adaptive task synthesis with user preferences (difficulty + style)
- Reference solution extraction from exploration trajectories

**Key Innovation**: Tasks are generated AFTER exploration, ensuring solutions are discoverable

### 2. Self-Navigating — Experience-Guided Exploration

**Purpose**: Improve exploration efficiency through experience reuse

**Components**:
- Experience Bank: stores successful trajectories
- Hybrid Policy: combines base policy + experience-guided policy
- Trajectory guidance for targeted task completion

### 3. Self-Attributing — Fine-Grained Credit Assignment

**Purpose**: Enhance sample efficiency with differentiated rewards

**Approach**:
- LLM infers contribution of intermediate states/actions
- Fine-grained rewards along long trajectories
- Better than uniform attribution (GRPO-style)

---

## Problem Formulation

**Interaction Sandbox ℰ = (S, A, 𝒫)** — no predefined reward or task objective

**Proxy Objective Framework**:
- F_task: ℰ → Δ(G) — environment to task distribution
- F_reward: ℰ × G → (S × A → ℝ) — environment + task to reward function

**Core Challenge**: Maximize proxy training objective J_train such that it improves true target objective J_target

---

## Experimental Results

**Benchmarks**: AppWorld, BFCL-v3

| Model | AppWorld | BFCL-v3 |
|-------|----------|---------|
| AgentEvolver-7B | **45.2%** | Competitive |
| Qwen2.5-14B baseline | 29.8% | — |
| AgentEvolver-14B | **57.6%** | Strong |

**Key Result**: 7B model outperforms 14B baseline; 14B achieves 57.6% vs 29.8% baseline (nearly 2× improvement)

---

## Infrastructure Features

- **Environmental Compatibility**: standardized interfaces for diverse environments
- **Unified Context Manager**: multi-turn interaction logic under consistent interface
- **RL Integration**: supports veRL infrastructure for efficient policy optimization
- **Modular Architecture**: facilitates secondary development and component extension

**GitHub**: https://github.com/modelscope/AgentEvolver

---

## Mapping to OpenClaw

| AgentEvolver | OpenClaw |
|--------------|----------|
| Self-questioning | Error Log → Skill generation |
| Self-navigating | Experience Bank reuse |
| Self-attributing | Fine-grained reward attribution |
| F_task | Task → Skill mapping |
| F_reward | Success/failure signal design |

**Key Alignment**: Both systems treat "training task generation" and "credit assignment" as core challenges

---

## L3 FLAGS Extracted

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — AgentEvolver Self-Evolution Framework                        │
├────────┬────────────────────────────────────────────────────────────────┤
│ #733   │ Self-Questioning: 好奇心驱动任务生成，减少手工数据集依赖      │
│ #734   │ Self-Navigating: 经验银行+混合策略引导高效探索                │
│ #735   │ Self-Attributing: 细粒度贡献归因优于均匀信用分配              │
│ #736   │ Post-Exploration Task Gen: 探索后生成任务确保可解性           │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## Relevance Assessment

**Relevant to: Bob** — Self-evolution architecture design; training vs deployment distinction  
**Relevant to: tech-lead** — Three-mechanism framework implementation; veRL integration  
**Relevant to: scout** — Credit assignment in long-horizon RL; curiosity-driven exploration

---

*SIG: 1773434083*
