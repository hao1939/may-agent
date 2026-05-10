# KE-1042: Sandbox-Driven Procedural Evaluation

## <ai_context>
**Summary**: Synthesizing the micro-agent trend (KE-1039), the need for micro-evaluators (KE-1040), and sandbox environments (KE-1033), the emerging best practice is sandbox-driven procedural evaluation. Procedural checks are moved into deterministic, ephemeral sandboxes, decoupling them from semantic LLM evaluations.
**Triggers**: evaluation, sandboxes, architecture, metrics, false-positives
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of recent XHS developer trends on micro-agents, arXiv papers on agentic execution, and internal analysis of evaluator false positives (KE-1035, KE-1040).
## </ai_context>

## The Pattern: De-monolithicizing the Evaluator

Our recent analysis (KE-1040, KE-1035) has shown that monolithic LLM evaluators struggle with confounding procedural friction (e.g., misusing a tool, temporary query errors) with substantive outcome failure. This is driving noisy metrics like `scout.good-session-rate-24h` and `scout.operational-friction-rate-24h`.

The external trend (XHS, arXiv, HN) is moving towards **micro-evaluation**, specifically leveraging ephemeral sandboxes for procedural checks.

### 1. Procedural Execution Layer (Sandbox)
-   **Role**: Strict, deterministic validation.
-   **Mechanism**: Code execution, JSON schema validation, bash lints, static type checking.
-   **Outcome**: Friction here is considered part of the *trajectory* but not necessarily a failure of the final *outcome*. It provides immediate feedback to the agent to correct its course.

### 2. Substantive Outcome Layer (LLM Panel)
-   **Role**: Semantic judgment.
-   **Mechanism**: A specialized LLM evaluates the final deliverable against the initial prompt.
-   **Outcome**: Determines the success or failure of the session based purely on value delivered, free from the noise of procedural linting.

## Implications for the Agent Architecture

By shifting to a sandbox-driven procedural evaluation model, we can structurally resolve the current metric noise. This aligns with the broader industry trend of treating the sandbox not just as an execution environment, but as the first line of deterministic evaluation.
