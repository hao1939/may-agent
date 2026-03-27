# HB#1607 — CoMAM: Collaborative Multi-Agent Optimization for Personalized Memory System

**Source**: arXiv:2603.12631 [cs.MA]  
**Authors**: Wenyu Mao, Haoyang Liu, Zhao Liu, et al. (USTC/CityU HK)  
**Date**: 2026-03-13  
**Status**: 🔥🔥 Milestone Paper — Multi-Agent Memory System Optimization

---

## Core Thesis

> "Independent optimization on local agents hardly guarantees global system performance... treating the memory system as a 'collection of local experts' rather than a collaborative team."

Existing methods (prompt engineering, independent RL) focus on local task optimization, but **independent strategies can conflict when combined in the global pipeline**:
- Fine-grained construction agents may store redundant/noisy content if retrieval agents are treated as fixed
- Retrieval agents may over-filter information if construction strategies aren't considered

---

## Three Specialized Agents

| Agent | Function | Local Reward | OpenClaw Mapping |
|-------|----------|--------------|------------------|
| **Extraction Agent** | Fine-grained memory construction (key events/facts) | Information coverage (α=0.8) | Artifact extraction + L1 validation |
| **Profile Agent** | Coarse-grained memory abstraction (preferences/patterns) | Abstraction rationality (model-based) | AGENTS.md role induction |
| **Retrieval Agent** | Retrieve Top-K memories + generate response | Precision/coverage (β=0.2) | Skill invocation + L3 orchestration |

---

## Sequential MDP Formulation

**Innovation**: Frame heterogeneous asynchronous execution as sequential Markov Decision Process:

```
s₀ = ℋ (raw history)
  ↓ a₀ = πθ⁰(ℋ) — Extraction Agent
s₁ = ℳf (fine-grained memory)
  ↓ a₁ = πθ¹(ℳf) — Profile Agent  
s₂ = (ℳ, q) (memory set + query)
  ↓ a₂ = πθ²(ℳ, q) — Retrieval Agent
s₃ = (ℰ'q, p) (retrieved info + response)
```

**Key**: Embeds inter-agent dependencies into state transitions for end-to-end joint optimization.

---

## Adaptive Credit Assignment Mechanism

**Problem**: How to align local improvements with global performance?

**Solution**: Quantify contribution via group-level ranking consistency using NDCG:

```
vn = NDCG(σ(Rlocal,n), σ(Rglobal))
wn = exp(vn) / Σexp(vn')
rfinal,n = rlocal,n + wn · rglobal
```

**Key Insight**: Agent contribution = its ability to predict global improvement from local improvement.

---

## Experimental Results

**Datasets**: Long-term personalized conversation tasks (LoCoMo, MSC)

**Key Findings**:
- CoMAM significantly outperforms independent optimization baselines
- Even with locally converged agents, independent combination consistently underperforms joint optimization
- Ablation validates: MDP regularization + adaptive credit assignment each contribute to performance

---

## OpenClaw Architecture Mapping

| CoMAM Component | OpenClaw Equivalent | Equivalence |
|-----------------|---------------------|-------------|
| Extraction/Profile/Retrieval Agents | AGENTS.md roles + Skill Library | Functional |
| Sequential MDP | Handoff chain + SIGNALS.md | Execution flow |
| Local task rewards | L1/L2 validation gates | Layered validation |
| Global system reward | End-to-end success metric | Objective function |
| Adaptive credit weights | Error Log retrospective weights | **Core mechanism** |
| NDCG-based contribution | Pattern frequency × severity | Weight calculation |

---

## Critical Design Implications

1. **Local optimum ≠ Global optimum**: OpenClaw's L1/L2/L3分层验证 is essentially hard-coded credit assignment — CoMAM suggests dynamic weight adjustment

2. **Multi-granular memory architecture validated**:
   - Fine-grained (Extraction) ↔ Raw Artifacts
   - Coarse-grained (Profile) ↔ AGENTS.md role states
   - Retrieval ↔ Skill selection + context assembly

3. **Ranking consistency as contribution metric**: Error Log could adopt NDCG-like metrics to evaluate local improvement impact on global performance

4. **Sequential dependencies formalized**: Handoff chain is implicit MDP — could be explicitly modeled for probabilistic L3 orchestration support

---

## L3 Flags

- **#1607**: Introduce adaptive credit assignment mechanism for dynamic Error Log weight adjustment
- **#1608**: Evaluate NDCG-like metrics for failure mode contribution quantification
- **#1609**: Explicitly model Handoff chain MDP state transitions

---

## Summary

CoMAM provides formal proof that "layered validation as credit assignment" is a sound design — our L1/L2/L3 is the hard-constraint version of CoMAM's adaptive learning mechanism.
