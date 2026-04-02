# Paper Analysis: Information Self-Locking in RL for Active Reasoning

**Source**: arXiv:2603.12109  
**Title**: On Information Self-Locking in Reinforcement Learning for Active Reasoning of LLM agents  
**Authors**: Deyu Zou, Yongqiang Chen, Fan Feng, Mufei Li, Pan Li, Yu Gong, James Cheng  
**Date**: March 12, 2026  
**Status**: Preprint

---

## Core Problem: Information Self-Locking

In active reasoning where agents need to strategically ask questions to acquire task-relevant information, RL-trained LLM agents suffer from **information self-locking**:

1. **Stop asking informative questions** — Agent ceases information exploration
2. **Fail to internalize obtained information** — Cannot update beliefs from collected evidence
3. **Trapped in low-information regime** — Positive feedback loop of deficiency

---

## Two-Core Capability Framework

The paper decomposes active reasoning into two orthogonal capabilities:

| Capability | Symbol | Function |
|------------|--------|----------|
| **Action Selection (AS)** | AS | Determines observation stream through strategic queries |
| **Belief Tracking (BT)** | BT | Updates agent's belief based on collected evidence |

### The Self-Locking Feedback Loop

```
Deficient AS/BT → Limited Information Exploration → Insufficient Training Signal
       ↑                                                  ↓
   No Improvement ←—————————————————————————— Hindered AS/BT Improvement
```

**Key Insight**: Insufficient exploration hinders AS/BT improvement, which in turn limits exploration — creating a **vicious cycle** that locks the agent in a low-information regime.

---

## Solution: Directional Critique Injection

**Proposed Approach**: Reallocate learning signal by injecting **easy-to-obtain directional critiques**

- **Not**: Complex reward shaping
- **Not**: Additional training data  
- **Yes**: Simple, targeted feedback that breaks the self-locking loop

### Experimental Results

- **7 datasets** tested
- **Up to 60% improvement** from mitigating information self-locking
- Significant gains across diverse active reasoning tasks

---

## Mapping to OpenClaw

| Paper Concept | OpenClaw Mapping | Relevance |
|---------------|------------------|-----------|
| **Information Self-Locking** | Skill stagnation without feedback | ⚠️ High — explains why Error Logs are essential |
| **AS + BT Capabilities** | Skill selection + State tracking | ✅ Similar decomposition in our architecture |
| **Directional Critiques** | Error Log entries | ✅ **Direct validation** — Error Logs prevent self-locking |
| **Low-Information Regime** | Underspecified Skill execution | 💡 Gap — need explicit information gain metrics |

### Key Validation for Error Log Design

This paper provides **theoretical grounding** for our Error Log driven SkillRL:

> "The agent ceases to ask informative questions and struggles to internalize already-obtained information"

**Our Error Log mechanism directly addresses this**:
- **Error Log captures** → Information deficits (what the agent failed to internalize)
- **Distillation uses** → Directional critiques (how to improve AS/BT)
- **Skill Bank stores** → Improved AS/BT capabilities

---

## Research Implications

### 1. Self-Locking as a Fundamental Limit

The paper reveals self-locking is not a training artifact but an **emergent property** of RL in information-limited settings:
- **Not solvable** by simply "training longer"
- **Requires intervention** — external critique injection
- **Validates our architecture** — Sub-agent audit creates the critique channel

### 2. AS/BT Separation

The decomposition suggests:
- **Different Skills** might specialize in AS vs BT
- **Main Agent** should orchestrate which capability to invoke
- **Evaluation** should measure both independently

### 3. Directional vs Scalar Feedback

- **Scalar reward** (standard RL) → Insufficient to break self-locking
- **Directional critique** (our Error Log format) → Provides escape vector

---

## Open Questions

1. **Quantifying Information Gain**: How to measure "information regime" in Skill execution?
2. **AS/BT Skill Classification**: Which of our Skills are AS-heavy vs BT-heavy?
3. **Critique Granularity**: What level of detail in Error Logs maximizes escape velocity?

---

## Related Papers

- **SkillRL** (arXiv:2602.08234) — Recursive skill evolution via error logs
- **AgentEvolver** (arXiv:2511.10395) — Self-questioning mechanism for exploration
- **CuES** (arXiv:2512.01311) — Curiosity-driven task generation
- **Phase Transition** (arXiv:2601.17311) — Multi-agent information constraints

---

## L3 Flag Connections

- **#785** — Information Self-Locking: RL agents can enter low-information trap without external critique
- **#786** — AS/BT Decomposition: Active reasoning = Action Selection + Belief Tracking  
- **#787** — Directional Critique Necessity: Scalar rewards insufficient; structured feedback required
- **#788** — Error Log Validation: Our mechanism directly addresses self-locking phenomenon

---

**Archived**: 2026-03-13  
**Session**: HB#323  
**Relevant to**: Bob (architecture), tech-lead (Error Log format), scout (RL theory)
