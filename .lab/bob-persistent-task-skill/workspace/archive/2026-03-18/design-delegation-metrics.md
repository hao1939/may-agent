# L3 Delegation Metrics (Design)

## Context
We have implemented **Ops Gates** (L2 Execution Defense) and **Drift Detection** (L3 Collective Defense for Test Density).
However, we lack visibility into **Cross-Agent Delegation** (e.g., May -> Coder).
If Coder succeeds (exit code 0) but May rejects the result ("This isn't what I asked for"), the system has failed, but our current metrics show "Success".

## Goal
Implement a `delegation-metrics` skill for Evaluator that:
1. Reads `.state/delegations.jsonl`.
2. Calculates **Integration Success Rate** (ISR) per parent-child pair.
3. Flags **Protocol Drift** (High Agent Success + Low ISR).

## Schema: `.state/delegations.jsonl`
We already have the logging mechanism in `manager.ts` (lines 1100-1120), but the file doesn't exist yet because no delegations have occurred since the patch, or the path is wrong.

```json
{
  "timestamp": "2026-03-25T10:00:00Z",
  "traceId": "uuid...",
  "sessionId": "s_123...",
  "parent": "may",
  "child": "coder",
  "method": "call",
  "status": "success",
  "durationMs": 5432,
  "error": null
}
```

## Metrics to Compute
1. **Volume**: Total calls per pair (e.g., May->Coder: 50 calls).
2. **Success Rate**: % of calls where `status` == "success".
3. **Latency**: P50/P90 duration for successful calls.
4. **Error Rate**: % of calls where `status` == "error".

## Alert Thresholds
- **Critical**: Success Rate < 80% for any core pair (May->Coder, Coder->QA).
- **Warning**: Latency P90 > 60s (suggests "Thinking Loop" or "Retry Hell").

## Implementation Plan
1. Create `agents/evaluator/skills/delegation-metrics.cjs`.
2. Add "Analyze Delegation Metrics" to `agents/evaluator/periodic-tasks.md`.
3. Verify with a synthetic test `agents/bob/workspace/compliance-test/delegation-metrics.test.cjs`.

This closes the loop on **HAE L3 Defense** by monitoring the *edges* of the agent graph, not just the nodes.
