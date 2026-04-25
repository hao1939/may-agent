# Brief: GUS v6 Integration — "Task Graph" (Law 105)

**Status**: Draft
**Owner**: Bob
**Date**: 2026-03-16

## 1. Context & Evidence
Recent research confirms that linear execution (chains) is insufficient for complex cognitive tasks, while full graph-based execution (DAGs) offers superior performance and auditability.

*   **Evidence 1 (JD.com CogSearch, arXiv:2603.11927)**: Production deployment of a 4-agent system using a **Task Graph (DAG)** for query decomposition. Achieved **+30% conversion** on complex queries. Proves that structured dependency modeling (Input(v_j) ⊆ Output(v_i)) is production-viable and superior to monolithic processing.
*   **Evidence 2 (VMAO, arXiv:2603.11445)**: "Plan-Execute-Verify-Replan" framework using DAG decomposition achieved **+35% completeness** and **+58% source quality**. Validates that explicit dependency modeling enables parallel execution and precise context propagation (`context_from_deps`).
*   **Evidence 3 (ToolTree, arXiv:2603.12740)**: MCTS-based tool planning (a form of dynamic graph search) beats ReAct by ~10%. Validates that exploring the solution space as a graph (with backtracking/pruning) is superior to greedy chains.

## 2. Theoretical Synthesis

### Law 105: The Task Graph Law
**"Complex cognitive work is structurally a Directed Acyclic Graph (DAG) of dependencies, not a linear chain of thoughts."**

*   **Corollary 1 (Parallelism)**: Nodes with no mutual dependencies can and should be executed in parallel (Amdahl's Law applied to cognition).
*   **Corollary 2 (Context Precision)**: A node `v` only requires the outputs of its parent nodes `Parents(v)`, not the entire global context. Global context injection is inefficient and noisy (Context-Efficiency Tradeoff, Law 56).
*   **Corollary 3 (Checkpoints)**: Every edge `(u, v)` in the DAG is a natural verification boundary. If `u` fails, `v` cannot start.

### Mechanism 90: Explicit Dependency Declaration
Instead of implicit "step-by-step" reasoning, agents must produce an **Explicit Dependency Graph**:
1.  **Decompose**: Break high-level goal into atomic sub-tasks `T1...Tn`.
2.  **Link**: Declare dependencies `T2 depends on T1`, `T3 depends on T1`.
3.  **Execute**: The runtime scheduler executes the DAG, handling parallelism and context passing.

### Principle 149: Graph-Based Context
**"Context should flow along the edges of the Task Graph."**
Do not dump the "entire conversation history" into every sub-agent. Pass only the **outputs of predecessor tasks**. This maximizes signal-to-noise ratio and minimizes context window usage.

## 3. Integration Plan

### Philosophy.md Updates
*   **Add Law 105 (The Task Graph Law)** under "Structure & Coordination".
*   **Add Mechanism 90 (Explicit Dependency Declaration)**.
*   **Add Principle 149 (Graph-Based Context)**.

### Practical Implications (P82)
This validates our move towards **structured handoffs** and **Skill Chains**.
*   **Future Design**: We should move from "Conversation History" to "Artifact Passing". When Agent A hands off to Agent B, they should pass a specific **Artifact** (the output of their node), not just a "scrollback".
*   **Scheduler**: Our `manager.ts` could eventually support parallel tool execution based on a dependency graph (currently it supports `Promise.all`, which is a 1-layer DAG).

## 4. Action
*   **Delegate**: Hand off to May for `philosophy.md` update batch.
