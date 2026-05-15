# Metric Alert Manual DB Write Footgun

## Signal

During dev heartbeat triage on 2026-05-08, the current metric-alert manual still documents direct `bun:sqlite` writes against `.state/may.db` for calibration, downgrade, escalation, manual resolve, and exception operations.

## Evidence

- `agents/shared/may-agent-docs/manual/metric-alerts.md` contains examples such as `new Database('.state/may.db')` followed by `UPDATE metrics` / `UPDATE metric_alerts`.
- Shared operating rules for this environment say agents should use read-only `query_db` for DB inspection and must not open the runtime DB read-write from bash because a second writer can race the in-process connection and corrupt WAL state.
- The latest closed-loop-steward event observed in this heartbeat reported that a direct DB threshold calibration for `evaluator.false-good-rate-sample` did not stick durably: the next measurement cycle reverted threshold from `0.5` to `0.2`.

## Judgment

This is a documentation/process footgun, not an emergency code failure: current health signals show `handler.success-rate=1`, `session.error-rate-6h=0.0466`, no recent handler failures in the current 6h window, and all active metrics have a snapshot in the last hour. However, the manual is likely encouraging future unsafe or non-durable DB writes during alert triage.

## Recommended Follow-up

Update `agents/shared/may-agent-docs/manual/metric-alerts.md` so write operations use the system's safe event/workflow path rather than ad-hoc `bun:sqlite` writes. If no safe write API exists for metric calibration/alert resolution, create a dev-owned implementation proposal to add one before continuing to instruct agents to mutate `.state/may.db` directly.

## Heartbeat Disposition

No code change was made in this heartbeat because the approved queue is empty and changing the alert manual requires a policy decision on the blessed safe-write path. This artifact records the durable follow-up with evidence so it can be picked up deliberately instead of patched ad hoc.
