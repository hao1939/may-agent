# Metric alert triage — upgrade_or_escalate — `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

- Alert id: `3209`
- Metric id: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Chosen operation: `upgrade_or_escalate`
- Triage time: `2026-07-08T18:00:05Z`

## Judgment

This is not a new app-side blocked-wait defect for the alias metric itself.
It is a repeated runtime alert-lifecycle regression for a measurement-only compatibility alias that is explicitly configured **not** to alert.

The real actionable process breach, if any, belongs to the canonical metric:
- `aks-rp-e2e.process.blocked.overdue-unworked-count`

The alias metric intentionally mirrors samples only:
- `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

## Evidence checked

1. Current runtime metric rows show both metrics at the same sampled value:
   - canonical `aks-rp-e2e.process.blocked.overdue-unworked-count`: `current = 2`
   - alias `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`: `current = 2`
2. The alias metric runtime config is:
   - `{"alert":{"mode":"disabled","disabled":true}}`
3. The current open alert lifecycle still created alias alert row `3209` with `resolved_at = null`.
4. The canonical metric also has its own real open alert row `3210`, so the alias row is a duplicate lifecycle page, not the only signal.
5. Recent snapshots prove the alias is a compatibility mirror, not an independent measurement:
   - alias note includes `"compatibilityAliasFor":"aks-rp-e2e.process.blocked.overdue-unworked-count"`
6. App registration source declares the alias with alert lifecycle suppressed:
   - `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts`
   - `config.alert.mode = "disabled"`
7. Observability design declares this exact metric has no breach consumer and should not open its own alert lifecycle:
   - `process.blocked.overdue-nonhuman-unworked-count>0` consumer is `none (measurement-only alias)`
   - expected state: same sampled value as the canonical metric, with no distinct breach/recovery row
8. Runtime-platform tests also encode the expected behavior:
   - `projects/may-agent/test/integration/metrics.test.ts` includes `suppresses alert lifecycle for metrics with disabled alert config`
   - the AKS-specific alias/canonical pair test expects canonical `breached` while alias remains `ok`
9. This is a repeated regression, not a one-off stale row:
   - previous alias alert `3160` already required the same escalation pattern
   - a fresh alias alert `3209` opened again anyway

## Why this is escalation, not root-cause fix

App-ops can judge that the canonical blocked-wait signal is real and separately actionable, but app-ops cannot safely fix this alias alert-lifecycle defect from the current triage environment because:

- the environment provides read-only DB inspection only,
- there is no safe runtime write path here to resolve `metric_alerts.id = 3209`, and
- the repeated duplicate row points to a runtime/platform alert-evaluation problem, not a task-tree contract problem inside `aks-rp-e2e.app`.

Because the alias is explicitly disabled for alerting yet still opens alert rows, the right durable action is to escalate the runtime/platform regression instead of pretending the alias itself needs app-side blocked-work repair.

## Requested escalation decision

Runtime owner / May should:

1. resolve open alert `3209` for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` if it remains open,
2. investigate why alert evaluation still inserts alias alert rows for metrics whose config has `alert.mode = "disabled"` and `disabled = true`,
3. confirm whether the duplicate row is being created by the normal metrics evaluator, a manual alert path, or a secondary consumer bypassing disabled-alert checks, and
4. prevent future duplicate alias alert rows so only canonical metric `3210` can own paging for this condition.

## Next validation

Validate at the next `metrics-snapshot` / alert lifecycle cycle:

- canonical metric may continue to alert if the underlying blocked waits are still real,
- alias snapshots may continue updating,
- but alert `3209` should resolve or disappear,
- and no new open alert row should be created for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` while its alert config remains disabled.
