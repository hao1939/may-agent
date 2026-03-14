# Synthesis: Privacy Amplification & Harness Engineering
**Date:** 2026-03-12
**Sources:** Scout (arXiv:2603.05520), Amy-Kimi (TDAD, AgentHub), Bulletin (2026-03-12)

## 1. The Mathematical Proof of P20 (Short Chains)
**Source:** Scout (arXiv:2603.05520 - Information Theoretic Privacy Control)

We have long held **P20 Short Chains** ("Prefer flat delegation over deep trees") as a heuristic for reliability. Scout's new finding provides a **mathematical proof** based on information theory.

*   **The Law:** Privacy leakage ($\epsilon$) amplifies to $(2^N-1)\epsilon$ in a sequential pipeline of depth $N$.
    *   Depth 2 (Manager → Worker): $3\times$ leakage.
    *   Depth 5 (Manager → A → B → C → D): $31\times$ leakage.
*   **Implication:** The "Context Window" is an attack surface. Every token we pass to a sub-agent that isn't strictly necessary is a leak multiplier.
*   **Design Shift:** Delegation must be **subtractive**. We currently pass full context often. We should move to "Need-to-Know" context slicing.
    *   *Bad:* `agents.call("worker", full_history)`
    *   *Good:* `agents.call("worker", specific_task + essential_context_only)`

## 2. The Move to "Harness Engineering" (L4)
**Source:** Amy-Kimi (TDAD - Test-Driven Agent Definition, AgentHub)

Multiple signals converge on the "Harness Engineering" paradigm (CuiLiang's L0-L5 ladder).
*   **Prompt Engineering (L1):** "You are a helpful assistant..."
*   **Context Engineering (L2):** RAG, dynamic context.
*   **Harness Engineering (L3/L4):** The environment *constraints* the agent.
    *   *TDAD:* Treat prompts as compiled code with regression tests.
    *   *AgentHub:* "Stupid pipes, smart endpoints" — the platform is just a Git DAG.
    *   *Secure Skills:* Our recent move to `SKILL.md` manifests.

**Synthesis:** We are correctly positioned at L4. The industry is catching up to "File System as Truth" (AgentHub) and "Constrained Execution" (TDAD). We should double down on **structure over prompting**.

## Recommended Actions
1.  **Philosophy Update:** Update **P20** to cite the $(2^N-1)$ law. It's not just about error propagation; it's about information containment.
2.  **Context Slicing:** Future design task for Tech-Lead: `SubagentManager` should support (or default to) context slicing. Currently, we often rely on the agent to "read the file", which is good (pull-based), but `agents.call` arguments are pushed.
