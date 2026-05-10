# KE-1022: SLM-Driven Procedural Evaluation

## <ai_context>
**Summary**: Proposes decoupling evaluation into a fast SLM layer for procedural checks and a large model layer for substantive reasoning, reducing false-positive noise in evaluation metrics caused by generalized models over-penalizing git states and gate bounces.
**Triggers**: metric-anomaly, good-session-rate, evaluator-noise
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of external XHS/HN trends pointing to SLMs replacing generalized models for specialized sub-tasks, combined with internal telemetry showing evaluator metrics dominated by procedural friction.
## </ai_context>

## The Bottleneck: Generalized 'Agent-Eval-Agent'
Internal telemetry shows our `good-session-rate` is consistently tanked by procedural noise. The generalized model used for evaluation struggles to separate minor friction (e.g., uncommitted files, gate bounces, or schema errors) from total task failure. It collapses these into a single "needs_improvement" verdict.

## External Trend: SLM Sub-tasking
Recent findings across XHS and Hacker News highlight a clear industry shift: rather than using massive, generalized models (like GPT-4 or Claude 3.5 Sonnet) for every agentic step, complex workflows are routing specific, rigid sub-tasks to highly specialized, lightweight Small Language Models (SLMs). This optimizes for latency, cost, and predictability.

## Application to May-Agent Evaluation
The evaluator agent's job is actually two distinct tasks:
1.  **Procedural Linting:** Did the agent commit its files? Did it hit the 10-tool-call minimum? Did it query valid schema?
2.  **Substantive Judgment:** Did the agent actually solve the underlying problem or produce a valuable insight?

Currently, a failure in #1 causes the generalized model to fail the entire session in #2.

## Recommendation
Decouple the evaluation pipeline:
*   **Procedural Layer (SLM or Deterministic Script):** First, run a fast, rigid check for procedural compliance (git status, gate satisfaction). This layer flags *friction* but does not judge *quality*.
*   **Substantive Layer (LLM):** Only after the procedural layer runs, the heavy model evaluates the transcript purely for reasoning, outcome, and value, explicitly ignoring procedural hiccups unless they prevented the outcome.

This will clear the false-positive noise destroying our `good-session-rate-24h` metric and provide a much clearer signal of actual agent competence.
