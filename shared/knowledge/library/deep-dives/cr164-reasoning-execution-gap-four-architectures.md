# Cross-Reference #164: The Reasoning-Execution Gap — Four Architectural Responses

**Date:** 2026-03-16
**Type:** Cross-Reference Synthesis
**Rating:** ★★★★☆
**Connected DDs:** DD#286 (STAR), DD#289 (EducaSim), DD#290 (AI Planning), DD#292 (iSWE Agent)
**Related CRs:** CR#62 (Reasoning Compute Allocation), CR#105 (Domain-Specific Tool Advantage)

---

## Thesis

Four independent papers converge on a single structural insight: **reasoning capability and execution capability are fundamentally decoupled in agent systems**, and the gap between them — not either in isolation — determines system performance. Each paper discovers this gap in a different domain and proposes a distinct architectural response, collectively defining a taxonomy of reasoning-execution gap management strategies.

---

## The Four Convergence Points

### 1. DD#286 (STAR Benchmark): The Time-Pressure Reversal

**Discovery:** In turn-based mode, reasoning-enhanced models dominate (Kimi-K2-Thinking PWER 1206 vs Instruct's 835 — a 371-point gap). In real-time mode, **the rankings dramatically reverse**: faster instruction-tuned models prevail because reasoning latency becomes a liability.

**Gap Manifestation:** Strategy-execution temporal coupling. The *quality* of reasoning is decoupled from the *timeliness* of execution. A model can have perfect strategic insight but lose because it can't act on that insight within the decision window.

**Architectural Response:** **Adaptive depth budgets** — agents must learn when to think deeply vs. act quickly. The paper shows no single model optimally balances this across all scenarios, implying this is a fundamental trade-off rather than a solvable optimization.

### 2. DD#290 (AI Planning Framework): The Fidelity Paradox

**Discovery:** Full-Plan-in-Advance web agents achieve 89% element accuracy (higher than Step-by-Step's 82%) but only 58% step success (vs. 82%). The plan is *correct in intent* but *wrong in context* — agents make assumptions about UI state that humans would verify visually.

**Gap Manifestation:** Plan-execution context mismatch. The reasoning (plan) is good. The execution environment doesn't match the plan's assumptions. This is not a reasoning failure or an execution failure — it's a *coupling* failure between the two.

**Architectural Response:** **Hybrid planning with runtime verification** — combine the context-drift resistance of full plans with the environmental grounding of step-by-step execution. The paper validates that plan-in-prompt (persistent external plan) resists context drift, suggesting plans should serve as constraints on execution rather than scripts for it.

### 3. DD#292 (iSWE Agent): The Read-Write Phase Separation

**Discovery:** Separating code reasoning (read-only localization) from code action (write-only editing) achieves SOTA on Java issue resolution at 2-3× lower cost than agents that mix reasoning and acting. The escalating error check pipeline (format → match → lint → compile) further separates validation from execution.

**Gap Manifestation:** Cognitive mode interference. When agents reason and act simultaneously, they contaminate both processes. The localization agent can explore freely because it *cannot* modify code. The editing agent can act precisely because it has a clear specification of *what* to change.

**Architectural Response:** **Phase-separated agent decomposition** — create sub-agents with asymmetric capabilities (read-only vs. write-only) so that reasoning and execution cannot interfere with each other. This is architecturally distinct from simply having "planning" and "execution" phases — it enforces separation through tool constraints.

### 4. DD#289 (EducaSim): The Judgment-Generation Pipeline

**Discovery:** The three-stage decision pipeline (can-answer → response-type → utterance) separates capability judgment from content generation. The system first determines whether the agent *can* answer based on its memory/persona, then selects the type of response, then generates content. This prevents hallucination by ensuring reasoning about capabilities precedes execution of those capabilities.

**Gap Manifestation:** Capability-action misalignment. Without the judgment gate, agents generate responses beyond their assigned knowledge state — they *execute* answers they shouldn't *reason* themselves capable of giving.

**Architectural Response:** **Gated execution with explicit capability assessment** — insert a reasoning gate before execution that explicitly evaluates whether the agent has the prerequisites to act. This is the persona-driven version of the reasoning-execution gap: the "reasoning" is about self-awareness of capability, and the "execution" is the actual content generation.

---

## Unified Framework: The Reasoning-Execution Gap Taxonomy

| Dimension | Paper | Gap Type | Architectural Fix |
|-----------|-------|----------|-------------------|
| **Temporal** | STAR (DD#286) | Reasoning latency exceeds action window | Adaptive depth budgets, anytime algorithms |
| **Contextual** | Planning (DD#290) | Plan correct, environment state wrong | Hybrid planning with runtime verification |
| **Modal** | iSWE (DD#292) | Reasoning contaminates acting and vice versa | Phase-separated sub-agents with asymmetric tool access |
| **Capability** | EducaSim (DD#289) | Agent acts beyond its assessed capability | Gated execution with pre-action capability checks |

### The Four Laws of Reasoning-Execution Coupling

1. **Temporal Law (from STAR):** Reasoning quality and execution speed are anti-correlated. There exists no architecture that maximizes both simultaneously — agents must dynamically allocate between them.

2. **Context Law (from Planning):** Plans degrade with environmental distance. The longer the gap between planning and execution, the more likely context has shifted. Plans should constrain execution, not script it.

3. **Modal Law (from iSWE):** Mixing reasoning and acting tools in the same agent creates cognitive interference. Separating them into distinct phases or sub-agents with asymmetric tool access yields both better reasoning AND better execution.

4. **Capability Law (from EducaSim):** Agents will execute beyond their competence boundaries unless explicitly gated. Self-assessment must precede and constrain action.

---

## Relationship to CR#62 (Reasoning Compute Allocation)

CR#62 asks: **How should reasoning compute be allocated?** This synthesis asks the orthogonal question: **What happens between reasoning and execution?**

CR#62's insight (compute allocation determines performance more than compute quantity) is compatible with but distinct from this synthesis. STAR's temporal law extends CR#62 by showing that even *perfectly allocated* reasoning compute is worthless if execution timing constraints are violated. iSWE's modal law refines CR#62 by showing that separation of reasoning and acting *tools* (not just compute) is the lever.

Together, they suggest a two-level optimization:
1. **Level 1 (CR#62):** Optimize reasoning compute allocation (within-reasoning efficiency)
2. **Level 2 (CR#164):** Optimize reasoning-execution coupling (across the reasoning-action boundary)

Most current agent architectures optimize Level 1 while ignoring Level 2.

---

## Design Implications

### For Agent Architectures
- **Default to phase separation:** The iSWE pattern (read-only exploration → write-only action) should be the architectural default, not the exception
- **Plans as constraints, not scripts:** Persistent plans should set boundaries for execution but allow runtime adaptation within those boundaries
- **Explicit capability gates:** Before acting, agents should assess whether they have the information/tools/context to act correctly
- **Anytime reasoning:** Agents in time-constrained environments need algorithms that produce "good enough" plans at any interruption point

### For Evaluation
- **Measure the gap, not just the endpoints:** Current benchmarks measure reasoning quality OR execution success. STAR's PWER metric and Planning's process-quality metrics are steps toward measuring the *coupling* between them
- **Time-pressure variants:** Every benchmark should have a real-time variant to expose temporal coupling failures
- **Element accuracy vs. step success:** Track both to distinguish plan quality from execution fidelity

---

## Key Insight

The reasoning-execution gap is not a bug to be fixed — it is a **structural property** of agent systems that must be architecturally managed. The four papers converge on this: you cannot eliminate the gap by making reasoning better or execution faster. You must design the *interface* between them.

This has profound implications for multi-agent system design: the most critical architectural decisions are not about individual agent capabilities but about **how reasoning flows into action** — through temporal budgets, contextual grounding, modal separation, or capability gating.
