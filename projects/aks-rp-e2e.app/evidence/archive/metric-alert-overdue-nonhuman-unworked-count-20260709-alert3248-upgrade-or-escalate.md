# Metric alert triage — upgrade_or_escalate — `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

- Alert id: `3248`
- Metric id: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Chosen operation: `upgrade_or_escalate`
- Triage time: `2026-07-09T07:35:37Z`
- Linked wait task: `wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709`

## Judgment

This alias alert is a repeated runtime/platform alert-lifecycle regression, not a new app-side blocked-wait repair need.

The canonical process signal already exists and is paging separately:
- `aks-rp-e2e.process.blocked.overdue-unworked-count` → open alert `3249`

The alias metric is intentionally measurement-only:
- `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` → open alert `3248`
- runtime config still says `{"alert":{"mode":"disabled","disabled":true}}`

So alert `3248` is duplicate lifecycle noise for a disabled compatibility alias, while the real process breach remains owned by the canonical metric's alert path.

## Evidence checked

1. Runtime metric rows currently match exactly:
   - alias metric current = `9`
   - canonical metric current = `9`
2. Runtime config for the alias metric is still:
   - `{"alert":{"mode":"disabled","disabled":true}}`
3. Open runtime alert rows currently exist for both metrics with the same breach time:
   - alias alert `3248`
   - canonical alert `3249`
4. The latest alias snapshot note still marks the metric as a compatibility mirror:
   - `"compatibilityAliasFor":"aks-rp-e2e.process.blocked.overdue-unworked-count"`
5. App registration source declares the alias alert lifecycle disabled:
   - `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts`
6. Observability design says the alias has no breach consumer and should not own a distinct alert lifecycle:
   - `process.blocked.overdue-nonhuman-unworked-count>0` consumer = `none (measurement-only alias)`
7. This is a repeat pattern, not a one-off surprise:
   - prior archive evidence already recorded the same escalation need for alerts `3160` and `3209`

## Concrete operation taken

Because this environment has no safe runtime write path for `metric_alerts` and the defect is in runtime alert evaluation rather than app task-tree blocked coverage, I created one exact blocked escalation wait:

- task id: `wait-ops-disabled-alert-alias-lifecycle-alert3248-runtime-response-20260709`
- owner: `app-ops`
- state: `blocked`
- blocker owner: `human`
- resume at: `2026-07-09T20:00:00Z`
- next check at: `2026-07-09T18:30:00Z`
- fallback at: `2026-07-10T00:00:00Z`

That leaves a durable process outcome tying this alert to the exact runtime-owner decision needed, instead of pretending the alias itself needs more app-side blocked-work repair.

## Requested runtime-owner decision

Runtime owner / May should:

1. resolve open alert `3248` for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` if it still exists,
2. identify why metrics with `alert.mode = disabled` and `disabled = true` can still open alert rows,
3. confirm whether the duplicate row is created by the normal metrics evaluator or another bypass path, and
4. prevent future alert lifecycle rows for this compatibility alias while allowing the canonical metric `3249` to continue owning the real page.

## Next validation

Validate on the next metrics/alert lifecycle refresh:

- alias snapshots may continue updating,
- canonical alert `3249` may remain open if the real overdue-unworked breach is still present,
- but alias alert `3248` should resolve or disappear,
- and no new open alert row should appear for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` while its alert config remains disabled.
