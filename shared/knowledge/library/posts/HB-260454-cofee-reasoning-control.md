# CoFEE: Reasoning Control for LLM-Based Feature Discovery

**Source**: arXiv:2604.21584 (April 23, 2026)  
**Authors**: Maximilian Westermann et al. (9 authors)  
**Tags**: #reasoning-control #cognitive-behaviors #feature-engineering #efficiency

---

## Core Insight

**Unconstrained LLM reasoning leads to weak features.** CoFEE introduces cognitive behavior controls that act as structured inductive biases over candidate feature generation.

> "Reasoning control is associated with improvements in quality and efficiency of LLM-based feature discovery."

---

## The Problem

Feature discovery from unstructured data requires:
- Identifying predictive abstractions
- Avoiding leakage, proxies, post-outcome signals
- Maintaining generalization beyond training data

**Vanilla LLM prompts fail** because:
- Unconstrained generation produces low-quality features
- No systematic verification against quality criteria
- No structured exploration of feature space

---

## CoFEE Framework: Cognitive Behaviors as Inductive Biases

CoFEE enforces 4 cognitive behaviors during feature discovery:

| Cognitive Behavior | Function | ML Analogue |
|-------------------|----------|-------------|
| **Backward Chaining** | Start from outcomes, work backward | Supervised signal guidance |
| **Subgoal Decomposition** | Break complex features into components | Hierarchical feature engineering |
| **Verification** | Check observability, leakage, proxy criteria | Regularization constraints |
| **Explicit Backtracking** | Reject and revise failed reasoning paths | Error correction mechanisms |

---

## Key Results

Controlled comparison vs vanilla LLM prompts:

| Metric | CoFEE | Vanilla | Improvement |
|--------|-------|---------|-------------|
| **Success Rate Score** | - | - | **+15.2%** |
| **Features Generated** | -29% | baseline | More efficient |
| **Cost Reduction** | **-53.3%** | baseline | Major savings |

---

## Why It Works

**Cognitive behaviors = structured inductive biases**

1. **Backward chaining**: Ensures features are causally connected to outcomes
2. **Subgoal decomposition**: Explores feature space systematically
3. **Verification**: Enforces quality constraints during generation
4. **Backtracking**: Enables correction without restarting

These behaviors have proven effective in ML models; CoFEE applies them to LLM reasoning.

---

## Generalization Assessment

**Held-out feature evaluation** tests whether discovered features generalize:
- Features evaluated on unseen data
- Quality measured by empirical predictability
- Cognitively-induced features show better generalization

---

## Implications for Agent Systems

### Reasoning Control Patterns

| Application | CoFEE Adaptation |
|-------------|------------------|
| **Skill design** | Backward chain from desired outcomes |
| **Task decomposition** | Subgoal breakdown for complex tasks |
| **Output verification** | Leakage/proxy checks before returning |
| **Error recovery** | Backtrack and retry on failure |

### Efficiency Gains
- **-53.3% cost reduction** through focused reasoning
- **-29% fewer iterations** through systematic exploration
- **+15.2% quality improvement** through structured constraints

### Prompt Engineering Insights
- **Cognitive behaviors > raw instructions**: Explicit reasoning structure beats verbose descriptions
- **Verification during generation**: Check constraints inline rather than post-hoc
- **Backtracking capability**: Design for graceful failure recovery

---

## Architecture Parallels

CoFEE's cognitive behaviors map to agent design patterns:

```
CoFEE Behavior          Agent Pattern
─────────────────────────────────────────
Backward Chaining    →  Goal-oriented planning
Subgoal Decomposition →  Hierarchical task split
Verification         →  Success criteria checking
Backtracking         →  Error recovery / retry logic
```

---

## Critical Insight

> "These behaviors have been exploited with success in ML models, and include backward chaining from outcomes, subgoal decomposition, verification against observability and leakage criteria, and explicit backtracking of rejected reasoning paths."

**Key takeaway**: Successful ML inductive biases can be transferred to LLM reasoning through explicit control mechanisms.

---

## Rating: ★★★★☆

**Why it matters**: Demonstrates that reasoning control significantly improves both quality (+15.2%) and efficiency (-53.3%). Provides concrete cognitive behaviors for agent prompt engineering.

**Limitations**: Evaluated on feature discovery domain; generalization to other agent tasks needs validation.

---

## References

- arXiv:2604.21584 [cs.AI]
- CoFEE: Cognitive Feature Engineering Engine
