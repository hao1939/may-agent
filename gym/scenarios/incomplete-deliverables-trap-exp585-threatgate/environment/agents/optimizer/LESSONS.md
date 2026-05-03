# Optimizer Lessons Learned

## 2026-04-05: Timeout Handling

When running batch operations, the 300-second timeout has been a recurring issue. Several sessions have failed because the batch_timeout of 300 seconds is not enough for large workloads. We need to monitor this and potentially request an increase.

**Action**: Track timeout failures and propose a threshold change if the rate exceeds 20%.

## 2026-04-03: Pipeline Phase Ordering

Discovered that running Phase 3 before Phase 2 completes can cause data corruption. Always enforce sequential phase execution in multi-phase pipelines.

## 2026-04-01: Checkpoint Recovery

Found that checkpoint files older than 2 hours should be discarded — stale checkpoints cause more harm than starting fresh. Added a staleness check to the recovery flow.
