# Status/Reality Mismatch Reconcile-Before-Record Fix

## Signal

Dev heartbeat found `capability.status-reality-mismatch-count` red in the active metrics table (`current=4`, `threshold=3`, `owner=may`) while there were no dev-owned unresolved alerts. The recent snapshot history showed the known KE-811 flap pattern: values `4 -> 0 -> 1 -> 0...` for the metric.

## Root Cause

`agents/may/handlers/metrics-snapshot.ts` recorded `capability.status-reality-mismatch-count` before its best-effort reconciliation inserted missing `session.end` events for terminal sessions. That made the metric alert on transient orphan arrivals that the same handler fixed a few lines later.

## Change

Moved the reconciliation block before the metric `record()` call and changed `terminalSessionsWithoutEnd` from `const` to `let` so the handler can recount after reconciling. The recorded value now reflects post-reconciliation state instead of pre-reconciliation transient state.

## Validation

- Read-back of `metrics-snapshot.ts` confirmed reconciliation now runs before `record("capability.status-reality-mismatch-count", ...)`.
- `bun --check may/handlers/metrics-snapshot.ts` passed.
- `git diff --check -- may/handlers/metrics-snapshot.ts agents/dev/workspace/investigations/2026-05-08-status-reality-mismatch-reconcile-before-record.md` passed.

## Follow-up

Watch the next 48h for new `metric_alerts` rows on `capability.status-reality-mismatch-count`. KE-811 predicts zero new rows if this fix addresses the flap.
