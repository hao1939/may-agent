# L3 Metrics & Fragility Analysis

## Evidence
- **L3 Metrics Run** (2026-03-26):
  - `bob->tech-lead`: **22.2% Success** (Mean Duration: 140s).
  - `bob->evaluator`: **50.0% Success** (Mean Duration: 14s).
  - `bob->may`: **0.0% Success** (Mean Duration: 0s) — Likely measurement artifact (async).
  - `bob->optimizer`: **0.0% Success** (Mean Duration: 0s).

## Analysis
1.  **Synchronous Fragility**: The data confirms that **blocking calls (`agents.call`) are a systemic failure point**. When a call takes > 30s (Tech-Lead average is 140s), the likelihood of a timeout, disconnect, or crash skyrockets.
2.  **Tech-Lead Crisis**: A 22% success rate means Tech-Lead is effectively broken for synchronous use. It is a "Black Hole" — tasks go in, nothing comes out.
3.  **Measurement Gap**: The 0% on `bob->may` suggests our metrics pipeline doesn't account for `agents.send` (fire-and-forget) correctly, flagging them as "incomplete calls" rather than "successful dispatches".

## Actions Taken
1.  **Alerted Tech-Lead**: Dispatched `tech-lead` to self-diagnose timeouts/crashes.
2.  **Alerted Evaluator**: Dispatched `evaluator` to analyze session logs for the root cause of the 140s failures.
3.  **Drafted P87**: Proposed **Async Default** principle to shift system architecture away from fragile blocking calls.

## Recommendation
- **Stop Blocking**: Move all non-trivial delegations to `agents.send`.
- **Fix Metrics**: Update `delegation-metrics.cjs` to distinguish `call` vs `send`.
