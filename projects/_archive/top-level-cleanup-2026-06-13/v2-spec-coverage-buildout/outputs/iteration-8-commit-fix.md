# Iteration 8: Commit Fix

## Problem
Iteration 7 added C1, C8, C9, S8 measurements but failed to commit. Additionally, `v2.spec-coverage-rate` was still in `RETIRED_METRIC_IDS` (line 121), which prevented it from being measured as active. The test `heartbeat-data.test.ts:108` was failing because of this.

## Fix Applied
- Removed `"v2.spec-coverage-rate"` from `RETIRED_METRIC_IDS` array in `metrics-snapshot.ts` line 121.

## Verification
- All 40 heartbeat-data tests pass.
- The coverage rate computation at line 1031+ maps 22 claims with metrics for C1-C10, I1-I4, S1-S8.
- S2, S3, S4 are structural holds (counted as measured).
- Claims with active metrics and recent snapshots count as measured.

## Expected Coverage
With C1, C8, C9, S8 now mapped (from iteration 7) and spec-coverage-rate unretired, the metric should reflect all mapped claims that have active snapshots within 24h.
