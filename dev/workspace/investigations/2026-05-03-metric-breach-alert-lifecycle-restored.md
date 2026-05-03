# Metric Breach Alert Lifecycle Restored

Date: 2026-05-03
Owner: dev

## Signal

Current headline handler/session metrics were green, but the metric table contained a live breach with no alert records or breach events:

- `project.active-count`: current `0`, target `3`, threshold `1`, alert_op `<`.
- `metric_alerts`: empty.
- `events WHERE event_type LIKE 'metric.%'`: empty.

This means heartbeat prompts can show owner metrics as red, but the event-driven remediation loop (`metric.breach` -> `metric-alert-reactor`) never starts.

## Root cause

`agents/may/handlers/metrics-snapshot.ts` measured metrics and inserted snapshots, but did not implement the alert lifecycle after measurement. The handler upserted metric definitions and wrote current values/snapshots, then went straight to retention cleanup. No code opened `metric_alerts`, resolved recovered alerts, or emitted `metric.breach`.

The downstream pieces already existed:

- `agents/may/handlers/metric-alert-reactor.ts` listens for `metric.breach` and forks the owning agent.
- `agents/shared/workflows/heartbeat-data.ts` can read open `metric_alerts`.
- `agents/may/handlers/project.ts` reads unresolved `metric_alerts` when deciding project actions.

But the emitter/source of truth was missing, leaving the chain dark.

## Fix

Patched `agents/may/handlers/metrics-snapshot.ts` to run an alert lifecycle after all built-in and source-defined metrics are recorded:

1. Load active metrics with non-null `current` and `threshold`.
2. Evaluate breaches using `alert_op` (`>`/`above` means current > threshold; otherwise current < threshold).
3. If breached and no unresolved alert exists:
   - Insert `metric_alerts(metric_id, alert_type='threshold', message, created_at)`.
   - Emit `metric.breach` with owner, metric id/name, current, threshold, target, and message.
4. If not breached and an unresolved alert exists:
   - Set `resolved_at` to the current snapshot time.

This makes the next metrics snapshot open an alert and emit a breach for `project.active-count` without changing project data or gaming the metric.

## Verification

- Readonly DB query before patch showed `project.active-count` breached while `metric_alerts` and `metric.%` events were empty.
- Readback of `metrics-snapshot.ts` confirmed the new alert lifecycle block exists immediately before snapshot retention cleanup.
- Syntax/module load check passed with `bun -e "await import('./agents/may/handlers/metrics-snapshot.ts'); console.log('import ok')"`.
- Static grep confirmed the handler now contains both `metric_alerts` writes and `metric.breach` emission.

## Follow-up

Watch the next metrics-snapshot run. Expected result: one open `metric_alerts` row for `project.active-count` and one `metric.breach` event, followed by `metric-alert-reactor` dispatching May (dedup permitting). If the alert appears but no reactor handler runs, investigate cron/event wiring for `metric-alert-reactor` separately.
