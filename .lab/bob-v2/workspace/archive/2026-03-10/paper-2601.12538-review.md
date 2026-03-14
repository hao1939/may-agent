# Review: arXiv:2601.12538 ("Agentic Reasoning")

## Verdict: Actionable Validation ✅

This paper is a strong validation of our current architecture. It maps our "Meta-Loop" directly to its "Self-Evolving Agentic Reasoning" layer and our "Feature Team" to its "Collective Multi-Agent Reasoning" layer.

However, we must apply its recommendations through the filter of our philosophy (Simplicity, Short Chains, Infra-Offloading). We will adopt the **principles** but adapt the **mechanisms** to fit our file-centric, low-complexity ethos.

### Alignment Check

| Paper Concept | Our System | Alignment |
|---------------|------------|-----------|
| **Foundational Layer** (Planning, Tools) | `SOUL.md`, `tools/` | ✅ Aligned |
| **Self-Evolving Layer** (Feedback, Memory) | Meta-Loop (Evaluator/Optimizer) | ✅ Strong Validation |
| **Collective Layer** (Roles, Coordination) | Feature Team (May/Tech-Lead/Coder) | ✅ Aligned |
| **In-Context Reasoning** | `agents/may` (Orchestrator) | ✅ Aligned |
| **Validator-Driven Feedback** | `agents/qa` (Verifier) | ✅ Aligned |
| **Learned Routing (RL)** | `agents/shared/system-design.md` | ⚠️ **Partial Drift**: We prefer "Infra-Offloading" (P17) over black-box RL routing. |
| **Hierarchical Orchestration** | May → Tech Lead → Coder | ⚠️ **Risk**: P20 "Short Chains" warns against deep hierarchies. |

### Recommendations

#### 1. Optimize Agent Descriptions (EASYTOOL-style)
*From Scout's Rec #4*
The paper highlights that orchestrators (May) perform better when agent descriptions are structured and capability-focused (EASYTOOL).
*   **Action**: Refine `agents/shared/system-design.md`. Ensure each agent's entry clearly defines **"What it does"**, **"When to use it"**, and **"Inputs required"**.
*   **Why**: High-leverage "Harness Over Model" (P13).

#### 2. Reinforce "Validator-Driven Feedback"
*From Scout's Rec #2*
The paper confirms that a distinct "Verifier" role significantly improves quality.
*   **Action**: Ensure our `implement-and-review` workflow strictly enforces the QA step. QA is not optional; it is the structural validator.
*   **Philosophy**: Validates "Role-Based Evaluation".

#### 3. Adapt "Workflow Memory" to Skills
*From Scout's Rec #3*
The paper suggests storing successful multi-agent patterns. We shouldn't build a new "Workflow Memory" system (over-engineering). Instead, we should use our existing `skills` system.
*   **Action**: Create `agents/shared/skills/patterns/` to store proven multi-agent interaction patterns (e.g., "How to scrape efficiently", "How to debug a crash").
*   **Why**: "File System as Memory" (P11).

### Rejections (Non-Actionable)

*   **Hierarchical Orchestration (Deep Trees):** We reject "AgentOrchestra" style deep hierarchies. We stick to **P20 Short Chains**. Flat is better than deep. If a task is too complex, decompose it at the root, don't bury it in sub-orchestrators.
*   **RL-Based Routing:** We reject "MASRouter" style RL routing. We stick to **P17 Offload Routing to Infra**. Routing should be deterministic and transparent (defined in `system-design.md`), not a black-box probability distribution.

### Next Steps (Delegated to Tech Lead/May)

1.  **Tech Lead**: Review `agents/shared/system-design.md`. Rewrite the "Feature Team" table to be more functional/EASYTOOL-style (Input/Output/Capabilities).
2.  **May**: When delegating complex tasks, explicitly look for "patterns" in `agents/shared/skills/` before planning.

### Philosophy Update
I will update `agents/shared/philosophy.md` to explicitly reference **Validator-Driven Feedback** as a mechanism for quality, reinforcing why we have a separate QA agent.
