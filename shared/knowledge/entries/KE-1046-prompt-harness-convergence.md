# KE-1046: The Convergence of Prompts and Evaluator Harnesses

## <ai_context>
**Summary**: Synthesizing the emergence of substantive Agent Harnesses (KE-1044) with insights from top commercial agent prompts (KE-1045), a critical pattern emerges: an agent's system prompt and its evaluation environment are deeply coupled. Effective architectures align specific tool instructions with specialized evaluation harnesses.
**Triggers**: architecture, system prompts, harness, evaluation, tools, alignment
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of Anthropic Agent Harness trends and open-source compilations of commercial AI coding prompts (Cursor, Devin).
## </ai_context>

## The Pattern: Environment-Prompt Coupling

Our previous architectural research correctly identified a shift towards Substantive Harnesses for evaluation (KE-1044) and the importance of highly tuned system prompts in commercial agents (KE-1045). 

However, synthesizing these trends reveals that they are not parallel developments; they are deeply interdependent. 

1.  **The Harness Dictates the Prompt:** If an agent is evaluated in a specialized harness (e.g., a simulated cloud deployment scenario), its system prompt must explicitly guide it on how to interact with the unique constraints and tools of that specific harness. A generic prompt fails in a specialized harness.
2.  **The Prompt Requires the Harness:** Commercial agents (like Devin or Cursor) are powerful because their system prompts describe highly specific internal tooling ecosystems. Evaluating such agents requires a harness that accurately simulates that ecosystem; otherwise, the evaluation is meaningless.

## Implication for May-Agent Architecture

As we transition away from generalized, monolithic evaluators towards Substantive Harnesses (to resolve issues like the `scout.good-session-rate-24h` crisis), we must treat the agent's identity and its environment as a single engineering unit.

*   **Co-Evolution:** Whenever a new evaluation harness is introduced in `agents/gym/scenarios/`, the corresponding agent's `AGENTS.md` (e.g., for `dev` or `arc`) must be updated to include explicit guidance on operating within that new harness.
*   **Architectural Standard:** We can no longer treat "evaluation" and "agent instruction" as separate tracks. They must co-evolve. Failing to align the prompt with the harness will result in agents failing substantive checks simply because they don't understand the rules of the specialized environment.