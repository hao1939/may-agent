# Iteration 6 — Implementation Summary

**Date**: 2026-05-09  
**Commit**: 02b6ab139 + prior concurrent commits

## Changes Made

### 1. metrics-snapshot.ts — New Metrics Added to ALL_METRICS
- `v2.agent-config-bytes-p50` — S5 convention-over-config (median agent.json size)
- `v2.manager-loc` — S6 manager LOC
- `v2.runtime-glue-loc` — S6 runtime glue LOC  
- `v2.spec-coverage-rate` — meta coverage metric (was retired, now active)

### 2. metrics-snapshot.ts — Un-retired Metrics
Removed from `RETIRED_METRIC_IDS`:
- `v2.manager-loc`
- `v2.runtime-glue-loc`
- `v2.spec-coverage-rate`

### 3. metrics-snapshot.ts — Computation Code Added
- **S5**: Stats all `agent.json` files, computes median size in bytes
- **S6**: Finds manager.ts and glue files via `find`, counts LOC via `wc -l`
- **Coverage rate**: Maps all 22 claims to their metric IDs, checks each for active status + recent snapshot, computes ratio

### 4. v2-spec.md — Status Updates
- **C10**: `untested` → `measured` (was already measured by `capability.status-reality-mismatch-count`)
- **S5**: `untested` → `measured` (now computed by metrics-snapshot)

### 5. Test Update
- `heartbeat-data.test.ts`: Updated test to verify `v2.spec-coverage-rate` is in ALL_METRICS (not retired)

## Expected Coverage Impact

After next metrics-snapshot run:
- S5 becomes measured → +1 claim
- C10 was already measured → spec status correction only
- S6 depends on manager.ts existing at expected path (currently not found → won't record)
- Structural holds (S2, S3, S4) already count → +3
- Total expected: ~6/22 = 0.2727 (matches DB), potentially 7/22 = 0.3182 with S5

## Next Steps
- S6 needs path discovery fixed (manager.ts not at `/app/src/lib/manager.ts`)
- S1 (callsite conformance) is next cheapest implementation
- S7, S8 need new event types to measure
