# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1781170903127_511
- **Status:** success
- **When:** 2026-06-11T09:49:03.531Z

## What Happened
Choosing fix_root_cause because the handler.p95-duration breach (602,266ms > 600,000ms threshold) was caused by a measurement bug: `aks-rp-e2e-task-execution-worker` handlers (103 instances in 6h window, avg 1.1M ms, max 3.5M ms) were not excluded from the p95 calculation despite being long-running agent sessions, not infrastructure handlers. Added `NOT LIKE '%-task-execution-worker'` exclusion filter in metrics-snapshot.ts. Without these outliers, p95 drops to ~103K ms — below both threshold (600K) and target (120K). Commit cf8085821.

## Files Modified
- agents/may/handlers/metrics-snapshot.ts

## Completed
- Fix handler.p95-duration metric alert #1646 by excluding task-execution-worker handlers from p95 measurement
