# Iteration 10 — Implement C2, C5, C6 Metrics

**Date:** 2025-05-10  
**Previous coverage:** 17/22 = 0.7727  
**Expected coverage:** 20/22 = 0.9091  

## Changes Made

### File: `agents/may/handlers/metrics-snapshot.ts`

#### 1. Added 5 new METRIC_DEFS entries

| Metric ID | Claim | Target | Threshold |
|-----------|-------|--------|-----------|
| `capability.breach-time-to-recovery-p50-h` | C2 | ≤6h | >24h |
| `capability.unrecovered-breach-count-7d` | C2 (supporting) | 0 | >2 |
| `capability.cross-domain-handling-rate` | C5 | 0 | >0.1 |
| `capability.trend-7d` | C6 | 0 | >2 |

#### 2. Added computation logic for each metric

**C2 — `capability.breach-time-to-recovery-p50-h`:**
- Queries `metric.breach` and `metric.recovered` events from the last 7 days
- Matches each breach to the next recovery of the same `metricId` via SQL CTE
- Computes median (p50) of the time deltas in hours
- Also computes `capability.unrecovered-breach-count-7d`: breaches with no matching recovery

**C5 — `capability.cross-domain-handling-rate`:**
- For each `metric.breach` event in 7d, extracts the `owner` from event data
- Checks if any remediation session was started by a *different* agent within 5 minutes
- Rate = cross-domain sessions / total breaches with owner info

**C6 — `capability.trend-7d`:**
- For each `capability.*` metric with snapshots in the last 7 days, computes linear regression slope
- Counts metrics with slope < -0.001 as "declining"
- Records the count of declining metrics

#### 3. Coverage mapping already correct
The `claimMetrics` map already had the right metric IDs for C2, C5, C6. No changes needed there.

## Remaining Uncovered Claims (2/22)

| Claim | Metric | Status | Blocker |
|-------|--------|--------|---------|
| C3 | `capability.journal-reference-rate` | Deferred | Low `agent.decision` emission (depends on S7) |
| C4 | `capability.message-conversation-close-rate` | Deferred | Semantic issue: agents use stigmergy not messages |

## Tests
- All 34 heartbeat-data tests pass ✅

## Expected Impact
Coverage rises from 17/22 (0.7727) to 20/22 (0.9091), exceeding the 0.8182 acceptance threshold.
