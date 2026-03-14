# Delegation Metrics (Evaluator)

This skill parses `.state/delegations.jsonl` to calculate Success Rates (ISR) between agents.

## Usage

```javascript
// Generate the L3 metrics report
agents.call("evaluator", "Generate L3 delegation metrics report");
```

## Metrics

*   **Attempts**: Total `call` or `send` operations.
*   **Success**: Number of operations that returned successfully.
*   **Failure**: Number of operations that threw an error or timed out.
*   **ISR (Inter-Service Reliability)**: `Success / Attempts`.

## Artifacts

*   Input: `.state/delegations.jsonl`
*   Output: `agents/evaluator/workspace/l3-metrics-report.md`
