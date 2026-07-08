# Metric alert triage — upgrade_or_escalate — `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

- Alert id: `3160`
- Metric id: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Chosen operation: `upgrade_or_escalate`
- Triage time: `2026-07-08T02:41:10Z`

## Judgment

This alert is not a real P0 blocked-wait breach that app-ops should repair directly.
It is an invalid alert-lifecycle duplicate for a measurement-only compatibility alias.

The canonical actionable metric is:
- `aks-rp-e2e.process.blocked.overdue-unworked-count`

The alias metric intentionally keeps snapshots live but suppresses alert lifecycle:
- `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

## Evidence checked

1. Runtime metric row for the alias currently shows:
   - `current = 1`
   - `priority = P0`
   - `config = {"alert":{"mode":"disabled","disabled":true}}`
2. The open alert row still exists as `metric_alerts.id = 3160` with `resolved_at = null`.
3. Project metric registration source declares this alias with:
   - description: alert lifecycle is suppressed so the canonical metric owns paging
   - config: `alert.mode = "disabled"`
4. Project observability design states:
   - `process.blocked.overdue-nonhuman-unworked-count>0` consumer is `none (measurement-only alias)`
   - expected state: `same sampled value as process.blocked.overdue-unworked-count, with no distinct breach/recovery row`
5. The metric sampler intentionally mirrors the canonical metric value into the alias and marks it as:
   - `compatibilityAliasFor: "aks-rp-e2e.process.blocked.overdue-unworked-count"`

## Why this is escalation, not root-cause fix

The underlying blocked-wait sample may be real for the canonical metric, but this specific alert row is not supposed to exist for the alias at all.

App-ops does not have a safe runtime write path in this workflow to:
- resolve `metric_alerts.id = 3160`, or
- repair the runtime alert-emission path that opened an alert for a metric whose config explicitly disables alerts.

Therefore the correct durable owner action is to escalate the invalid alert lifecycle to the runtime/human owner instead of pretending the alias itself needs process repair.

## Requested escalation decision

Runtime owner / May should:
1. resolve open alert `3160` for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` if it remains open,
2. verify why the alert lifecycle opened a row for a metric with `config.alert.disabled = true`, and
3. prevent future alias alert rows so only the canonical metric `aks-rp-e2e.process.blocked.overdue-unworked-count` can page.

## Next validation

Validate at the next `metrics-snapshot` / alert lifecycle cycle:
- alias snapshots may continue updating,
- but alert `3160` should be resolved or absent,
- and no new open alert row should be created for this alias metric.
