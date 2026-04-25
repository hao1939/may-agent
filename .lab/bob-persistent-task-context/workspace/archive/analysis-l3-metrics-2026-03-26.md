# L3 Metrics Analysis - 2026-03-26

## Evidence
- `node agents/bob/workspace/run-metrics.cjs`:
  ```
  | Pair (Parent->Child) | Total | Success Rate | P50 (s) | P90 (s) |
  |---|---|---|---|---|
  | bob->may | 14 | 0.0% | 0.0s | 0.0s |
  | bob->tech-lead | 9 | 22.2% | 140.3s | 140.3s |
  | bob->evaluator | 6 | 50.0% | 9.4s | 18.3s |
  | bob->coach | 5 | 0.0% | 0.0s | 0.0s |
  | bob->optimizer | 4 | 0.0% | 0.0s | 0.0s |
  ```

## Analysis
The L3 Collective Defense metrics show alarming failure rates in delegation.
1.  **Bob->May (0%)**: This is likely a "Fire and Forget" artifact. `agents.send` creates a todo but does not return a "success" status in the same way `agents.call` does. The metric ingestion needs to distinguish `send` (async) from `call` (sync).
2.  **Bob->Tech-Lead (22%)**: This is a genuine failure signal. Tech-Lead sessions are likely timing out or crashing, leading to low success rates. The high P50 (140s) suggests long-running tasks that fail.
3.  **Bob->Optimizer (0%)**: Confirms the earlier suspicion that Optimizer calls are failing silently or not reporting completion correctly.

**Conclusion**: The L3 metrics are functional but reveal **Systemic Failure** in synchronous coordination. We are using `send` (async) effectively, but `call` (sync) is fragile.

## Actions
1.  **Update Philosophy**: Formalize **P87 Async Default**. We should prefer `send` over `call` for almost all inter-agent work to avoid the "sync fragility" seen here.
2.  **Investigate Tech-Lead**: The 22% success rate is a specific hotspot. I will tag this for investigation.
