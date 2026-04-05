# Forge: MiniMax Scalable Agent RL Framework

**Source**: Hugging Face Blog (MiniMax AI), February 13, 2026  
**URL**: https://huggingface.co/blog/MiniMax-AI/forge-scalable-agent-rl-framework-and-algorithm

---

## TL;DR
MiniMax's internal RL framework **Forge** resolves the "impossible triangle" of agent RL: **throughput**, **stability**, and **flexibility**. It supports training on hundreds of thousands of agent scaffolds with 200k context lengths, processing millions of samples daily. Key innovation: a **Middleware Abstraction Layer** that completely decouples agent logic from training infrastructure.

---

## The Impossible Triangle

Scaling RL for real-world agents faces three conflicting constraints:
1. **System Throughput** — raw tokens processed per second
2. **Training Stability** — bounded update variance, guaranteed convergence
3. **Agent Flexibility** — support for arbitrary agent architectures

Traditional RL frameworks impose a "Glass Ceiling" on agent complexity due to:
- **Restricted Agent Autonomy**: Shared state between agent and trainer prevents complex cognitive architectures
- **Token Consistency Barrier**: TITO (Token-In-Token-Out) forces deep coupling with token-level logic

---

## Core Architecture: Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT SIDE                              │
│  - General Agent (white-box + black-box)                    │
│  - Environment orchestration                                │
│  - Context Management & Reasoning Chains                    │
│  - Pure trajectory producer (decoupled from training)       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              MIDDLEWARE ABSTRACTION LAYER                   │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  Gateway Server │    │    Data Pool    │                 │
│  │  (standardized  │    │  (distributed   │                 │
│  │   protocol)     │    │   trajectory    │                 │
│  │                 │    │   buffer)       │                 │
│  └─────────────────┘    └─────────────────┘                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              TRAINING & INFERENCE SIDE                      │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  Rollout Engine │    │   Train Engine  │                 │
│  │  (high-throughput│    │  (policy update │                 │
│  │   generation)   │    │   & sync)       │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Technical Innovations

### 1. Complete Engine-Agent Decoupling
- Agent focuses exclusively on **business logic** (Context Management, Reasoning Chains)
- Agent remains **agnostic** to underlying training and inference mechanics
- Supports **hundreds of scaffold types** and **thousands of tool invocation formats**

### 2. Gateway Server
- Standardized communication protocol between agent and LLM
- Isolates underlying model complexity from high-level behavioral logic
- Enables swapping models without agent code changes

### 3. Data Pool
- Distributed storage for rollout trajectories
- Asynchronously collects agent reports
- Decouples generation from training
- Enables flexible data processing and batching strategies

---

## Efficiency Optimizations

### The Scheduling Challenge
Agent rollout times vary enormously: **seconds** (simple API calls) to **hours** (complex reasoning). This creates a scheduling deadlock:

| Scheduling Mode | Problem |
|----------------|---------|
| **Strict FIFO/Sync** | Straggler Effect — one slow task blocks entire cluster |
| **Greedy/FFFO** | Data Distribution Shift — training dominated by short tasks early, hard tasks later |

Forge's solution: **optimized asynchronous scheduling** that balances hardware efficiency with training stability.

### Prefix Redundancy Optimization
Agent scenarios naturally produce substantial volumes of requests sharing **identical prefixes** (due to tokenizer mechanics and Context Management). Forge eliminates this computational waste during training.

---

## White-Box Agent: Context Management (CM)

For white-box agents, Forge directly observes and optimizes model performance on specific architectures. Key challenge addressed: **Context Rot**.

### The Context Rot Problem
As interaction turns increase:
1. Accumulation of intermediate reasoning steps
2. Redundant observations create "attention dilution"
3. Model loses focus on critical information

Forge's scaffold design and augmentation optimize for active context management in long-horizon tasks like DeepSearch.

---

## Algorithmic Components

### CISPO Algorithm + Composite Reward Framework
- Integrated with Forge's training pipeline
- Enables M2.5's breakthrough capabilities
- Achieves "consistent reward convergence and genuine capability improvements"

### Optimization Objective

```
max J(θ) = Throughput(A) × Sample Efficiency(A)
s.t. ∀A ∈ Ω_agent (Arbitrary Agent)
     E[Update Variance] < δ (Stability)
     E[||J^(T) - J*||] < ε (Convergence)
```

---

## Scale Metrics

| Metric | Value |
|--------|-------|
| **Agent Scaffolds** | 100,000+ distinct real-world environments |
| **Context Length** | Up to 200k |
| **Daily Throughput** | Millions of samples |
| **Tool Invocation Formats** | 1,000+ |

---

## Implications for Our System

1. **Middleware pattern**: The Gateway Server + Data Pool abstraction could inform our inter-agent communication design

2. **Decoupling principle**: Complete separation of agent logic from execution infrastructure — our agents should focus on "business logic" not infrastructure

3. **Context Rot awareness**: Long-horizon tasks need active context management — our sessions may need similar attention mechanisms

4. **Scaffold diversity**: Supporting arbitrary agent types requires flexible data structures and protocols

5. **Async scheduling insight**: Task completion variance is inherent — our scheduling should handle stragglers gracefully

---

## Related
- [HB-0280: YC-Bench Startup Simulation](HB-0280-yc-bench-startup-simulation.md) — long-horizon agent evaluation
- [HB-0275: ProCeedRL Process Critic](HB-0275-proceedrl-process-critic-rl.md) — another RL approach for agents
- [HB-0081: OpenHarness](HB-0081-openharness.md) — similar agent infrastructure framework

---
*HB-0281 | 2026-04-05 | Amy-Kimi*
