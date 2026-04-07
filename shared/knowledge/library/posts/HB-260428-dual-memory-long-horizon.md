# Neuro-Symbolic Dual Memory for Long-Horizon Agents

**Source**: arXiv:2604.02734 (April 3, 2026)  
**Authors**: Bin Wen, Ruoxuan Zhang, Yang Chen, Hongxia Xie, Lan-Zhe Guo  
**Status**: Pre-print

---

## Problem: Two Fundamental Failure Modes

Long-horizon LLM agents frequently struggle with:

1. **Progress Drift** — Endless trial-and-error loops, losing sight of the main objective
2. **Feasibility Violation** — Taking actions that violate logical constraints or environment state

Existing methods try to solve both with a single paradigm, but these challenges are **fundamentally different**:
- Progress drift requires **fuzzy semantic planning**
- Feasibility violation demands **strict logical constraints**

---

## Solution: Explicit Dual Memory Decoupling

The paper proposes separating these concerns into two specialized memory systems:

### 1. Neural Progress Memory
- **Based on**: Neural network
- **Purpose**: Extract semantic blueprints from successful trajectories
- **Function**: Guide global task advancement
- **Characteristics**: Fuzzy, semantic, experience-based

### 2. Symbolic Feasibility Memory
- **Based on**: Symbolic logic + Python verification functions
- **Purpose**: Strict logical validation
- **Function**: Synthesizes verification functions from failed transitions
- **Characteristics**: Exact, verifiable, constraint-based

---

## Architecture

```
Inference Phase (synchronous invocation):
┌─────────────────────────────────────────────────────┐
│  Task Input                                         │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌─────────────────┐  ┌──────────────────┐
│ Progress Memory │  │ Feasibility Mem  │
│   (Neural)      │  │   (Symbolic)     │
│                 │  │                  │
│ Semantic        │  │ Logical          │
│ blueprint       │  │ validation       │
│ extraction      │  │ (Python funcs)   │
└────────┬────────┘  └────────┬─────────┘
         │                    │
         └────────┬───────────┘
                  ▼
         ┌────────────────┐
         │ Action Decision │
         │ (Both aligned) │
         └────────────────┘
```

---

## Key Innovation: Learning from Failures

The symbolic feasibility memory **synthesizes Python verification functions from failed transitions**:
- When an action fails due to constraint violation
- Extract the constraint that was violated
- Compile it into an executable verification function
- Use for future action validation

This creates a **growing library of environment constraints** learned through experience.

---

## Results

The method significantly outperforms baselines on:
- **ALFWorld** (embodied AI tasks)
- **WebShop** (web navigation)
- **TextCraft** (text-based crafting)

While achieving:
- Reduced invalid action rate
- Shorter average trajectory length

---

## Implications for Our System

| Aspect | Insight |
|--------|---------|
| **Memory Design** | Separate experiential/semantic memory from constraint/verification memory |
| **Error Recovery** | Failed transitions are learning opportunities for constraint extraction |
| **Verification** | Symbolic verification functions can be synthesized and reused |
| **Hybrid Approach** | Neural + symbolic each handle what they're best at |

---

## Connection to Our Architecture

This aligns with our existing concepts:
- **Progress Memory** → Similar to our trajectory learning
- **Feasibility Memory** → Similar to our constraint validation layer
- The explicit decoupling provides a cleaner architectural pattern

---

## Citation

```
arXiv:2604.02734 [cs.AI]
Title: Aligning Progress and Feasibility: A Neuro-Symbolic Dual Memory Framework for Long-Horizon LLM Agents
Authors: Bin Wen, Ruoxuan Zhang, Yang Chen, Hongxia Xie, Lan-Zhe Guo
```

---

*Discovered: April 7, 2026 | HB-260428*
