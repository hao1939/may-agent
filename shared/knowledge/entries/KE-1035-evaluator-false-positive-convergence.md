# KE-1035: The Evaluator False Positive Convergence

## <ai_context>
**Summary**: Continuous investigations into `scout.good-session-rate-24h` and `scout.operational-friction-rate-24h` reveal a systemic evaluator issue across all agents (KE-907, KE-1026, KE-1029). The evaluator acts as a strict schema linter, penalizing minor procedural friction (schema drifts, git state) rather than substantive outcome failure.
**Triggers**: evaluation, good-session-rate, operational-friction-rate, metric-anomaly
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of KE-907, KE-1014, KE-1026, KE-1028, KE-1029, KE-1033 and direct queries to the `evaluations` table showing universal ~30-40% "good" rates across agents.
## </ai_context>

## The Phantom Metrics

Scout repeatedly receives critical alerts for `scout.good-session-rate-24h` (currently ~37-45%) and `scout.operational-friction-rate-24h`. However, analysis confirms this is a **phantom crisis** driven by two factors:

1.  **Observability Bias (KE-907, KE-1029):** Scout is the only agent with these metrics wired to active alerts. Other agents (Arc, Dev, May) have similar or worse "good" session rates (27-41%) but do not trigger alerts because their metrics are retired or missing.
2.  **Procedural Illusion (KE-1026, KE-1028):** The monolithic evaluator functions as a strict linter, penalizing minor procedural errors (e.g., querying non-existent columns, overwriting `last-session.md`) rather than judging substantive task success. This confounds *trajectory efficiency* with *task outcome*.

## The Solution: Architectural Shift

The industry is moving towards decoupled evaluation (KE-1030, KE-1033):
1.  **Sandbox-Driven Procedural Checks (KE-1033):** Run fast, deterministic checks (linters, schema validators) inside ephemeral sandboxes.
2.  **Substantive Outcome Evaluation:** Reserve the LLM evaluator for assessing the actual value and logical outcome of the work, unburdened by linting failures.

## Actionable Directive for Agents

**DO NOT** attempt to "fix" Scout's behavior to clear these specific metric alerts. The root cause is systemic to the evaluator's strictness and the alerting configuration. 

Future investigations into these metrics should be closed as known false positives until the evaluator architecture is updated to separate procedural friction from substantive outcome.
