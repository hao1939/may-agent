# Deep Dive: arXiv:2603.09890 — "Influencing LLM Multi-Agent Dialogue via Policy-Parameterized Prompts"

**Authors:** Hongbo Bo, Jingyu Hu, Weiru Liu (University of Bristol)
**Venue:** AAMAS 2026 (Accepted)
**Date Analyzed:** 2026-03-13
**Relevance to Unified Framework:** ★★★★★ (5/5)

---

## One-Paragraph Summary

This paper introduces a formal framework for treating **prompts as actions** in LLM-based multi-agent dialogue systems, creating a lightweight "policy parameterization" that can steer conversational behavior **without any model training**. The key idea is decomposing each agent's prompt into five components—task/persona (T), dialogue memory (M), retrieved knowledge (D), rule template (R), and weights (W)—and dynamically constructing prompts at each dialogue round based on the current state. The framework formalizes this as a state-action process where the policy π maps state to a constructed prompt, the LLM executes the prompt, and the output updates global memory. Experiments across two social simulation scenarios (land use, education policy) with three heterogeneous LLMs (Qwen3-8B, Llama3-8B, Mistral-7B) demonstrate that different rule templates and weight configurations produce measurably different behavioral profiles across five evaluation metrics: responsiveness, rebuttal, evidence usage, non-repetition, and stance shift.

---

## Key Contributions

### 1. Prompt-as-Action Formalization
The paper's central innovation is treating the **prompt itself as the action** in a multi-agent system, rather than treating the LLM's output as the action. This creates a clean separation:
- **State:** s_i^(k) = {T_i, Q, M̂^(k), D̂_i^(k)} — persona, query, dialogue memory, retrieved knowledge
- **Action:** a_i^(k) = π_i(s_i^(k)) — the constructed prompt
- **Execution:** o_i^(k) = LLM_i(a_i^(k)) — the natural language output
- **Transition:** M^(k+1) = {∪ o_i^(k)} ∪ M^(k) — memory accumulation

This is a **fundamentally different abstraction** from standard RL-based multi-agent formalizations. Rather than learning policies through gradient updates, the policy is defined by prompt construction rules.

### 2. Five-Component Prompt Decomposition
Each prompt is assembled from:
- **T (Task/Persona):** Agent role, stance, and task description
- **M (Memory):** Recent dialogue history (shared message pool)
- **D (Knowledge):** RAG-retrieved chunks from agent-specific knowledge base
- **R (Rule template):** None/Light/Struct templates for behavioral structure
- **W (Weights):** Three-element vector [w_T, w_M, w_D] ∈ [0,2]³ controlling emphasis

The weight vector maps to a **three-tier signal system** (low/mid/high) that attaches specific micro-instructions to each component block. This is the "parameterization" — continuous weights translate to discrete behavioral instructions.

### 3. Rule Template Hierarchy (None → Light → Struct)
Three levels of structural constraint:
- **None:** No formatting guidance; agents generate freely from concatenated [T][M][D][Q]
- **Light:** Minimal structure — "Answer Q, cite 1-2 pieces from D, respond to M if needed, limit to N sentences"
- **Struct:** Full reasoning structure — extract 4 types of key points (supporting, opposing, conflicting, cooperative), then generate response prioritizing D citations

**Critical Finding:** Different rule templates create distinct behavioral trade-offs:
| Metric | None | Light | Struct |
|--------|------|-------|--------|
| Non-repetition | 0.43-0.47 | 0.33-0.38 | **0.62** |
| Evidence usage | 0.10-0.16 | **0.28-0.30** | 0.20 |
| Rebuttal | 0.15-0.28 | **0.13-0.31** | 0.07-0.22 |
| Responsiveness | 0.85 | 0.85-0.88 | 0.80-0.89 |
| Stance | 0.48 | 0.47 | 0.47-0.51 |

Key insight: **Struct maximizes non-repetition but suppresses evidence usage and rebuttal**. Light optimally balances evidence use. None has lowest non-repetition but highest rebuttal.

### 4. Adaptive Weight Scheduling
Time-based dynamics:
- w_M increases over time (early rounds: less reliance on sparse memory → late rounds: more engagement with accumulated dialogue)
- w_D decreases over time (early rounds: establish stance from evidence → late rounds: less need for knowledge grounding)
- w_T remains constant (persona is stable)

Plus behavior-based correction: if an agent fails to use D or respond to M in a round, the corresponding weight is bumped up by α.

### 5. Weight Sensitivity Analysis
Increasing w_T to 1.5 **significantly increases rebuttal rate** — agents with stronger persona emphasis are more argumentative and "loyal to role." There's a **cross-over effect** for evidence usage: Light rules can enforce evidence use even with low w_D, but without rules (None), higher w_D is necessary. This suggests **rules and weights are partially substitutable control mechanisms**.

---

## Connection to Unified Framework

### Relation to Seven Laws
1. **Law 1 (Communication Topology):** The framework uses a shared message pool (flat topology) but notes extensibility to layered/decentralized/centralized configurations. The prompt construction mechanism is topology-agnostic.

2. **Law 3 (Role Specialization):** The persona component T directly implements role differentiation. The finding that higher w_T increases argumentativeness and stance loyalty is empirical validation that **role emphasis drives behavioral divergence**.

3. **Law 5 (Memory & State):** The dialogue memory M and its interaction with the retrieval system D creates a two-layer memory architecture: episodic (dialogue history) + semantic (knowledge base). The time-based scheduling of w_M vs w_D formalizes the **memory trade-off over conversation lifetime**.

### Relation to Eight Degradation Patterns
- **Sycophancy / Echo Chambers:** The non-repetition metric (0.33-0.62 range) and stance shift metric directly measure convergence/divergence. Struct templates produce highest non-repetition, suggesting structured reasoning resists echo chamber formation.
- **Conversational Degradation (cf. arXiv:2603.11394):** The round-wise analysis shows non-repetition initially declining then stabilizing — exactly the degradation pattern identified in the Stop Listening to Me paper, but here partially controlled by rule templates.

### Relation to GNAP Protocol
The five-component prompt decomposition (T, M, D, R, W) can be viewed as a **concrete instantiation** of GNAP message construction where:
- T = agent identity/role header
- M = conversation state
- D = knowledge payload
- R = protocol rules
- W = priority/urgency signals

### Relation to Intelligence Paradox (arXiv:2603.12129)
The cross-over effect where Light rules compensate for low weights, but None requires high weights, parallels the intelligence paradox finding: **more sophisticated control (Struct) doesn't always yield better outcomes** — it suppresses evidence usage while improving non-repetition. There's an optimal complexity level.

---

## Methodological Strengths
1. **Clean formalization** — treating prompts as actions is elegant and avoids the training overhead of RL
2. **Systematic evaluation** — 5 metrics × 5 queries × 3 rules × multiple weights × 5 runs = thorough
3. **Heterogeneous LLMs** — using 3 different models (Qwen3, Llama3, Mistral) prevents model-specific confounds
4. **Adaptive scheduling** — time-based + behavior-based weight adjustment is a principled approach to dynamic control

## Limitations
1. **Small scale** — only 3 agents per scenario; unclear how prompt parameterization scales to 10+ agents
2. **LLM-as-judge evaluation** — using Llama3 to evaluate Llama3's outputs creates potential bias
3. **No ground truth for "good" behavior** — the framework can *control* behavior but doesn't optimize for any objective notion of quality
4. **Shared memory only** — doesn't test decentralized or private memory configurations
5. **Rule templates are hand-designed** — no automated search over template space

---

## Novel Insights for Our Research

### 1. The Prompt Decomposition is a Control Surface
The T/M/D/R/W decomposition provides a **five-dimensional control surface** for agent behavior. This is the first paper to formalize prompt engineering as a policy space with measurable effects. For our unified framework, this suggests that **agent coordination can be achieved through structured prompt construction** rather than training — a practical alternative to RL-based approaches.

### 2. Rules and Weights are Substitutable Controllers
The cross-over effect (Light rules compensate for low w_D; None requires high w_D) reveals that **behavioral control has multiple pathways**. This is analogous to biological systems where different mechanisms can achieve similar phenotypic effects — a form of **control degeneracy** that increases system robustness.

### 3. Struct Templates Create a Rebuttal-Evidence Trade-off
Forcing agents into structured reasoning (extract supporting/opposing/conflicting/cooperative points) improves novelty but suppresses evidence citation and argumentation. This suggests **over-structuring dialogue leads to a different kind of degradation** — agents become more methodical but less engaged.

### 4. Temporal Dynamics of Prompt Weights
The finding that evidence weight should decrease and memory weight should increase over time formalizes an intuition: **early dialogue is about establishing positions (knowledge-heavy); late dialogue is about engaging with others (memory-heavy)**. This temporal signature could be used as a diagnostic for conversation health.

---

## Testable Predictions

1. **Scaling prediction:** As agent count increases beyond 5-6, the shared message pool will cause memory component M to dominate, requiring compensatory increases in w_D to maintain evidence usage
2. **Cross-model prediction:** The Struct template should show different magnitude effects on different LLM sizes — smaller models may struggle more with structured extraction
3. **Convergence prediction:** Under adaptive weights with behavior correction, all rule template configurations should converge to similar behavioral profiles over sufficiently many rounds
4. **Transfer prediction:** Weight configurations optimized for one scenario (land use) should transfer to structurally similar scenarios but fail for semantically different domains

---

## Rating: ★★★★★

**Relevance:** Direct contribution to our unified framework's understanding of how to control multi-agent LLM behavior without training. The prompt-as-action formalization is the most principled approach we've seen to date. The five-component decomposition provides a concrete architecture for the "agent communication layer" in our framework. Essential reading for anyone building multi-agent LLM systems for social simulation.
