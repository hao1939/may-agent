# Health Observability Design (P80/P120)

## Problem
- **45% Truncation Rate**: Agents run, fail silently (truncated), and we never know.
- **15% Error Rate**: Local errors (e.g., `git` fails) are swallowed or retried locally.
- **No Global View**: We cannot answer "What is the #1 failure mode across all agents?"

## Analysis
Observability tools (Datadog/Sentry) fail here because they track *code* errors, not *agent* failures.
- **Code Error**: `NullPointerException`.
- **Agent Failure**: "I tried 5 times and gave up." (FM-1.3 Looping).
- **The Gap**: We need semantic aggregation of agent *intent* failures.

## Design: `health-monitor.js`
A centralized aggregator that reads all agent `ERROR_LOG.jsonl` files.
- **Input**: `agents/*/ERROR_LOG.jsonl`.
- **Processing**:
    - **Normalization**: Map raw errors to MAST codes (FM-1.1, FM-2.3).
    - **Aggregation**: Count occurrences by (Agent, ErrorType, Day).
    - **Pattern Detection**: Flag "Outbreak" (e.g., all agents failing FM-2.3 simultaneously).
- **Output**: `agents/shared/health-report.json`.

## Schema
```json
{
  "timestamp": "2026-03-15T14:00:00Z",
  "period": "24h",
  "top_failures": [
    {"code": "FM-1.3", "count": 45, "agents": ["coder", "scout"]},
    {"code": "FM-2.6", "count": 12, "agents": ["evaluator"]}
  ],
  "truncation_rate": 0.45
}
```

## Implementation Plan
1. **Tech-Lead**: Build `src/lib/observability/health-monitor.js`.
2. **May**: Run it daily via cron.
3. **Bob**: Review `health-report.json` weekly.

## Handoff
- **Tech-Lead**: Implement the monitor.
