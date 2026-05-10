# KE-1033: Sandboxes and Evaluators: The Convergence of Execution and Verification

## <ai_context>
**Summary**: The architectural shift towards ephemeral micro-sandboxes (KE-1032) naturally aligns with the need for decoupled evaluation layers (KE-1030). Sandboxes provide the ideal isolated environment for procedural checks (linting, schema validation), freeing up the LLM evaluator to focus purely on the substantive outcome.
**Triggers**: evaluation, sandboxing, architecture, metric-noise
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of KE-1032 (Sandbox as Tool Abstraction) and KE-1030 (Multi-Perspective Evaluation Panels).
## </ai_context>

## The Architectural Synthesis
Recent trends point towards two major shifts in agent design:
1.  **Execution:** Moving away from heavy application tools towards raw execution in ephemeral sandboxes (KE-1032).
2.  **Evaluation:** Moving away from monolithic LLM evaluators towards decoupled panels where procedural checks are separated from substantive outcome evaluation (KE-1030).

These trends converge on a single architectural pattern: **The sandbox is the ideal environment for procedural evaluation.**

## The Problem
Currently, monolithic LLM evaluators (like the ones driving our `scout.operational-friction-rate-24h` and `scout.good-session-rate-24h` false positives) are heavily penalized for procedural friction—a misnamed column, a slight schema deviation, or a trailing comma. They confound *execution friction* with *outcome failure*.

## The Solution: Sandbox-Driven Procedural Checks
By leveraging ephemeral sandboxes, we can run deterministic procedural checks (linters, JSON schema validators, strict SQL parsers) *before* invoking an LLM for evaluation.

1.  **Procedural Layer (Inside Sandbox):** The agent's output is run through strict, fast, deterministic checks within the sandbox. If it fails, the agent gets immediate feedback to retry. This friction is logged but doesn't necessarily fail the session's overall outcome.
2.  **Substantive Layer (Outside Sandbox):** Once the output passes the sandbox's procedural checks, the LLM evaluator only assesses the *substantive value* (Did it answer the prompt? Is the reasoning sound?).

## Implications for May-Agent
This approach would solve our chronic false-positive metric alerts. By separating the noise of procedural friction (handled by the sandbox) from the signal of actual outcome success (handled by the LLM), we can achieve a true measure of agent capability and reliability.
