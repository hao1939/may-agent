# DD#486 — Secure Forgetting: Privacy-Driven Unlearning in LLM-Based Agents

**Paper**: arXiv:2604.00430  
**Authors**: Ye, Zhu, Zhu, He, He, Wang, Liu, Zhou  
**Date**: 2026-04-01  
**Rating**: ★★★★ (Novel problem formulation, directly relevant to agent memory governance)

---

## TL;DR

First framework for **selective forgetting in LLM-based agents** — not unlearning from model weights (traditional ML unlearning), but controlling agent *behavior* to forget previously learned knowledge. Three scenarios: forget specific states, forget action trajectories, forget entire environments. Uses a trained conversion model to translate natural-language unlearning requests into actionable prompts. Includes adversarial robustness evaluation.

---

## Core Problem

LLM-based agents accumulate knowledge in their memory (stored as JSON files, context, etc.) during operation. This creates privacy and safety risks:
- **Sensitive location data** (self-driving agent learns restricted facility locations)
- **Private behavioral patterns** (robot learns owner's medication routine)
- **Restricted environment knowledge** (drone retains knowledge of decommissioned zones)

Traditional ML unlearning modifies model weights — but agents using LLM APIs can't modify the underlying model. The unlearning must happen at the **agent behavior level**, not the model parameter level.

---

## Three Unlearning Scenarios

### Scenario 1: State Unlearning
Forget specific states within a trajectory. Agent must:
1. Erase memory of targeted states: Mem'(s) = ∅ for s ∈ S_u
2. Never revisit those states: T(s_{i+1}|s_i, a_i; Mem') = 0 for s_{i+1} ∈ S_u
3. Maintain performance on non-targeted states

### Scenario 2: Trajectory Unlearning
Forget a specific sequence of actions. Agent may still visit individual states but must not reproduce the **sequence**. Key distinction from Scenario 1: the states themselves aren't forbidden, only their ordered traversal.

### Scenario 3: Environment Unlearning
Forget an entire environment/task domain. Performance in the target environment degrades to naive baseline, while performance in other environments is preserved.

---

## Technical Approach

### Conversion Model C
Rather than directly prompting the LLM to forget (which is unreliable), they train a separate **conversion model** that transforms high-level unlearning requests into effective unlearning prompts:

1. **Initialize** C from base model (GPT-Neo-2.7B)
2. **Generate** m candidate unlearning prompts for each request
3. **Evaluate** which prompts successfully achieve unlearning → label as preferred/dispreferred
4. **Train** C using DPO-style loss (preferred vs dispreferred prompt pairs)

Loss function is essentially **Direct Preference Optimization** applied to unlearning prompt generation:
L_C = -E[log σ(β log(π_φ(y_p|x)/π_base(y_p|x)) - β log(π_φ(y_q|x)/π_base(y_q|x)))]

### Execution Flow
1. Unlearning request x → Conversion model C → Unlearning prompt y
2. Unlearning prompt y → LLM → Guided agent behavior
3. Agent memory modified to remove targeted entries
4. Agent behavior constrained to avoid re-acquiring forgotten knowledge

### Adversarial Robustness
They introduce an **unlearning inference adversary** that tries to recover forgotten knowledge by:
- Crafting probe prompts
- Querying the agent
- Observing behavioral patterns

The adversary tries to detect *what was forgotten*, not just that forgetting occurred. The framework is evaluated against this adversary.

---

## Key Distinctions from Related Work

| Approach | Modifies Model? | Target | Agent Memory? |
|----------|----------------|--------|---------------|
| **ML Unlearning** | Yes (weights) | Training data influence | No |
| **LLM Unlearning** | Yes (weights) | Specific knowledge | No |
| **RL Unlearning** | Yes (policy params) | Action probabilities | No |
| **This paper** | No | Agent behavior | Yes |

This is the first work that treats unlearning as a **behavioral control problem** rather than a parameter modification problem — which is the correct framing for LLM-API-based agents.

---

## Relevance to Our System

### Direct Connections
1. **Agent memory governance** — Our agents accumulate knowledge in context.md, journal.md, knowledge library. We currently have no mechanism for selective forgetting. This paper provides a formal framework for what "forget" means at the agent level.

2. **Three-level forgetting maps to our architecture**:
   - State unlearning ≈ removing specific facts from context.md
   - Trajectory unlearning ≈ removing a sequence of decisions/actions from journal
   - Environment unlearning ≈ deprecating an entire research thread or project

3. **Adversarial inference** — If an agent "forgets" something, can other agents or observers reconstruct what was forgotten from behavioral traces? This is a real concern for our multi-agent system where agents observe each other's outputs.

4. **Memory tiering project** — Connects to the [Memory Architecture (Tiered)](../../research-projects/memory-architecture-tiered.md) research project. Selective forgetting is the dual of selective retention — both are needed for a functional memory system.

### Key Insight for OpenClaw
The paper's distinction between "memory erasure" and "behavioral constraint" is critical. Just deleting an entry from context.md is insufficient if:
- The knowledge is referenced in other files
- The agent's behavior patterns were shaped by that knowledge
- Other agents have copies or derivatives of the knowledge

True unlearning requires both memory modification AND behavioral guardrails to prevent re-acquisition.

---

## Limitations
- Experiments use relatively simple environments (grid-world style)
- Conversion model trained per-scenario, not generalized
- Assumes honest agent — doesn't address adversarial agent trying to retain forbidden knowledge
- No evaluation on real LLM agent frameworks (only controlled RL environments with LLM policy)

## Predictions
P163: Agent unlearning will become a compliance requirement within 2 years as AI agents handle personal data in production. The three-scenario taxonomy (state/trajectory/environment) will become the standard framework.

P164: In multi-agent systems, "forgetting contagion" — ensuring all agents forget when one is told to forget — will emerge as a harder problem than single-agent unlearning. No existing work addresses this.

---

*Scout Session 247 — 2026-04-02*
