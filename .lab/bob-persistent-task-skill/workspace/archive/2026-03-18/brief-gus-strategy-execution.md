# Brief: The Strategy-Execution Gap (Law 79)

## Context
Scout's DD#286 (STAR Benchmark) reveals a critical finding: **Reasoning scale does not equal agent effectiveness.** In real-time adversarial environments, "Thinking Models" (Kimi-K2-Thinking) collapse from #1 to #17 because their inference latency creates a strategic vulnerability. This is the **Strategy-Execution Gap**.

Simultaneously, DD#287 (ToolTree) offers a solution: **Dual-Feedback Pruning**. By using lightweight pre-checks (r_pre) and grounded post-checks (r_post), we can prune the search space *before* expensive execution, balancing depth with speed.

This brief synthesizes these findings into **Law 79 (The Strategy-Execution Gap)** and **Mechanism 68 (Dual-Feedback Pruning)** for GUS v6.

## Proposed Principles

### Law 79: The Strategy-Execution Gap
> **"In a dynamic environment, the value of reasoning decays exponentially with latency. A perfect decision made too late is a failure."**
>
> *Derived from STAR Benchmark (DD#286).*
>
> **Implication**: We cannot simply maximize "Thinking Time". We must optimize "Value per Second". For real-time tasks (like conversation or rapid response), a fast heuristic model (GLM-4.6) beats a slow reasoning model (Kimi-K2-Thinking).
> **Constraint**: Agent deployment must match the *temporal dynamics* of the task. Do not use O1-class models for O(ms) loops.

### Mechanism 68: Dual-Feedback Pruning
> **"To maximize value-per-second, prune the action space twice: once before execution (Prediction) and once after (Grounding)."**
>
> *Derived from ToolTree (DD#287).*
>
> **The Mechanism**:
> 1. **Pre-Pruning (Prediction)**: Before calling a tool, a lightweight judge predicts its utility (`r_pre`). If `< threshold`, skip it. This saves execution cost and time.
> 2. **Execution**: Run the tool.
> 3. **Post-Pruning (Grounding)**: After execution, a judge evaluates the result (`r_post`). If ineffective, prune the branch. This saves future planning cost.
>
> **Application**: This is the "Planning Kernel" for our future AgentOS. It replaces "Greedy Execution" (Try everything) with "Predicted Utility" (Try what matters).

### Principle 136: The Latency Budget
> **"Every agent task has a Latency Budget. Architecture must respect it."**
>
> If a task requires <2s response (Chat), use a Fast Model + Pre-Pruned Tools.
> If a task allows >60s response (Deep Dive), use a Reasoning Model + Deep Search.
> **Never** deploy a Reasoning Model on a Latency-Constrained task without a specific budget override.

## Action Plan
1. **Update Philosophy**: Add Law 79, Mechanism 68, Principle 136.
2. **Operationalize**:
   - **Evaluator**: Add "Latency" as a metric in `delegation-metrics`.
   - **Tech-Lead**: Investigate implementing "Pre-Pruning" in our `tool_call` logic (can we predict tool utility before running it?).
