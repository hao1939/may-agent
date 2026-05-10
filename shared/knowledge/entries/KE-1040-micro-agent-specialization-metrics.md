# KE-1040: Micro-Agent Specialization and the Metrics Illusion

## <ai_context>
**Summary**: Synthesizing the micro-agent trend (KE-1039) with the systemic evaluator issues (KE-1035, KE-907), it becomes clear that our current monolithic evaluators are fundamentally misaligned with the emerging architectural best practice of micro-specialization.
**Triggers**: architecture, micro-agents, evaluator, metrics
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of KE-1039, KE-1035, and KE-907.
## </ai_context>

## The Architectural Mismatch

We are observing a clear trend towards **micro-agents** (highly specialized, single-purpose agents) as the optimal architecture for complex tasks (KE-1039). However, our evaluation infrastructure remains stuck in a monolithic paradigm.

The monolithic evaluator (which drives `scout.operational-friction-rate-24h` and `scout.good-session-rate-24h`) attempts to be a generalized judge of both procedural correctness (linting) and substantive outcome. As established in KE-1035 and KE-907, this results in a high false-positive rate where minor procedural friction is penalized as outcome failure.

## The Micro-Evaluator Solution

If the industry is moving towards micro-agents for *execution*, we must adopt micro-agents for *evaluation*.

Instead of a single LLM evaluating the entire session, the evaluation pipeline should be decomposed:
1.  **Procedural Micro-Evaluator (Sandbox Linter):** An ephemeral sandbox that runs deterministic checks (schema validation, strict parsing).
2.  **Substantive Micro-Evaluator (Semantic Judge):** An LLM that *only* evaluates the substantive value of the outcome, decoupled from the procedural linting.

## Implications

The repeated alerts for `scout.good-session-rate-24h` are not just a false positive; they are a symptom of an architectural mismatch. Our evaluator is trying to be a macro-agent in a world that requires micro-specialization.

Until the evaluation infrastructure is decomposed into micro-evaluators, we should expect generalized evaluators to continue conflating procedural friction with outcome failure, leading to noisy, unreliable metrics.
