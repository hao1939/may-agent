# Heartbeat Injection Alert Mismatch — 2026-05-08

## Finding

This dev heartbeat was injected with `📊 No metrics configured` and `Active Alerts: None — all clear`, but runtime DB evidence in the same session shows the metrics subsystem is active and has unresolved alerts.

## Evidence

- `SELECT id, name, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active'` returned 31 active metrics, including `session.error-rate-6h=0.0554`, `handler.success-rate=1`, and `evaluator.substantive-low-quality-rate-24h=0.0826`.
- Unresolved metric-alert query returned 4 rows: `evaluator.false-good-rate-sample`, `scout.good-session-rate-24h`, `scout.operational-friction-rate-24h`, and `evaluator.low-quality-rate-24h`.
- The current heartbeat prompt still claimed no metrics were configured and no active alerts existed.

## Impact

Dev heartbeat context is under-informing the metrics owner. The standing plan compensates by querying the DB directly, but the injected header can cause false all-clear decisions and hides non-dev unresolved alerts from system-debugging triage.

## Related Existing Queue Items

This overlaps with proposed work already in `agents/shared/work-queue.md`:

- P0 `Fix loadAlerts() — drop severity, join on metrics.owner`.
- P1 `Heartbeat header should consult metric_alerts`.

No new proposal is needed unless those items are rejected or stall.

## Action This Session

Documented the mismatch with live DB evidence and did not edit alert-loading code because no Approved work-queue item is available for dev implementation in this heartbeat.

## Next Validation Signal

A future dev heartbeat should no longer show `No metrics configured` when `metrics.status='active'` rows exist, and active-alert injection should be consistent with `metric_alerts` joined to `metrics.owner` for the receiving agent.
