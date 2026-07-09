# Metric alert triage — upgrade_or_escalate — `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`

- Alert id: `3280`
- Metric id: `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count`
- Chosen operation: `upgrade_or_escalate`
- Triage time: `2026-07-09T11:43:09Z`

## Judgment

This is a repeated runtime alert-lifecycle defect on a compatibility alias metric, not a new app-side blocked-wait repair need.

The alias metric is intentionally measurement-only and should not own a distinct alert lifecycle:

- app metric registration sets `config.alert.mode = "disabled"` and `disabled = true`
- observability design says `process.blocked.overdue-nonhuman-unworked-count>0` has consumer `none (measurement-only alias)`
- the snapshot note still marks the metric as a compatibility mirror of `aks-rp-e2e.process.blocked.overdue-unworked-count`

Even so, runtime opened a fresh alias alert row `3280` at the exact same time as the canonical alert row `3281`.

## Evidence checked

1. Runtime metric rows now show:
   - alias `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` → `current = 1`, `threshold = 0`, `config = {"alert":{"mode":"disabled","disabled":true}}`
   - canonical `aks-rp-e2e.process.blocked.overdue-unworked-count` → `current = 1`, `threshold = 0`, `config = {"alert":{"mode":"consecutive_failures","count":1}}`
2. Open runtime alert rows now show a duplicate pair created at the same timestamp:
   - alias alert `3280`
   - canonical alert `3281`
3. Latest alias snapshot still carries:
   - `{"offenderTaskIds":["hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707"],"compatibilityAliasFor":"aks-rp-e2e.process.blocked.overdue-unworked-count"}`
4. Source registration still declares alias alert lifecycle disabled in:
   - `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts`
5. Design still documents the alias as measurement-only with no distinct breach consumer in:
   - `projects/aks-rp-e2e.app/design/project-observability.md`
6. This is a repeat regression pattern, not a one-off:
   - prior archive evidence already recorded the same escalation need for alerts `3160`, `3209`, and `3248`

## Concrete operation taken

I recorded this alert-specific escalation packet in project evidence so the runtime-owner decision is explicit and durable.

Because this environment exposes only read-only DB access and no safe runtime write path for `metric_alerts`, I cannot directly resolve alert `3280` or repair the evaluator from this session. The correct concrete action is therefore to escalate the repeated runtime defect rather than pretend the alias needs additional app-side blocked-work repair.

## Requested runtime-owner decision

May / runtime owner should:

1. resolve open alert `3280` for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` if it still exists,
2. identify why a metric with `config.alert.mode = "disabled"` and `disabled = true` can still open alert rows,
3. verify whether the duplicate row is created by the normal metrics evaluator or another bypass path, and
4. prevent future alert lifecycle rows for this compatibility alias while preserving the canonical alert path on `aks-rp-e2e.process.blocked.overdue-unworked-count`.

## Next validation

Validate on the next metrics/alert lifecycle refresh:

- alias snapshots may continue updating,
- canonical alert `3281` may remain open if the real overdue-unworked breach is still present,
- but alias alert `3280` should resolve or disappear,
- and no new open alert row should appear for `aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count` while its alert config remains disabled.
