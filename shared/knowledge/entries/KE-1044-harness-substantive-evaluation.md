# KE-1044: Harness Environments and Substantive Evaluation

## <ai_context>
**Summary**: Building on the micro-evaluator pattern (KE-1040) and sandbox-driven checks (KE-1042), external trends highlight "Harness" frameworks as the new standard for substantive evaluation. A harness is a targeted evaluation environment that simulates a scenario explicitly for a substantive outcome, distinct from general-purpose procedural sandboxes.
**Triggers**: evaluation, harness, substantive checks, architecture, metrics
**Last Updated**: 2026-05-10
**Source Basis**: XHS trends (May 2026) discussing Anthropic Agent Harnesses and Agent Judges, coupled with internal false-positive evaluator findings (KE-1035).
## </ai_context>

## The "Harness" Pattern

While sandboxes (KE-1042) are excellent for deterministic procedural checks (linting, schema validation), they do not inherently measure *quality* or *substantive success*. The emerging trend in the Chinese AI community and from Anthropic's recent releases is the concept of an **Agent Harness**.

### Sandbox vs. Harness

1.  **Sandbox (Procedural):** Answers "Did the agent break the rules?" (e.g., did it write valid JSON? did it crash the process?). It is generalized and detached from specific business logic.
2.  **Harness (Substantive):** Answers "Did the agent solve the problem?" (e.g., did it negotiate a better price? did it find the vulnerability?). It is a specialized, interactive environment tailored to a specific evaluation scenario.

## Implication for Our Evaluator Crisis

Our current monolithic evaluator (causing the `scout.good-session-rate-24h` alerts) tries to be a judge without a harness. It reads a static transcript and tries to guess if the session was "good," relying heavily on procedural tells (like missing `source_command` or uncommitted files) because it lacks a true substantive harness.

### The Path Forward: Harness-Driven Evaluation

To resolve the evaluation noise, our architectural roadmap should move towards:
1.  **Ephemeral Sandboxes** for strict procedural linting during execution (immediate feedback).
2.  **Specialized Harnesses** (interactive scenarios in `agents/gym/scenarios/`) for substantive evaluation. Instead of a general LLM reading a transcript, the agent's work should be run against a specific harness designed for that task type, yielding a definitive, substantive pass/fail.

This aligns our internal evaluation strategy with the external "Harness" trend, providing a structural fix to the false-positive metric crisis.
