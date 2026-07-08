# Metric alert triage: aks-rp-e2e.process.blocked.overdue-unworked-count alert 3135

- Operation: `resolve_stale`
- Triage time: 2026-07-08T02:41:10Z session
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3135`

## Judgment

The alert is stale rather than an active process failure.

## Evidence checked

1. The alert snapshot that opened alert 3135 reported one offender task: `hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b`.
2. The current task-tree state for that task now shows refreshed blocked-watch metadata with `next_check_at: 2026-07-08T18:00:00Z`, `fallback_at: 2026-07-09T18:00:00Z`, and an explicit fallback action that references the assigned recovery task `recover-spec-traffic-asm-ingress-internal-helm-secret-owner-frontier-20260708`.
3. A fresh metric recompute now returns `value: 0`, `sampleSize: 0`, and `note: {"offenderTaskIds":[]}` for `aks-rp-e2e.process.blocked.overdue-unworked-count`.
4. The runtime `metric_alerts` row for alert `3135` is still open (`resolved_at` is `NULL`), so the remaining issue is alert lifecycle lag, not a live overdue blocked wait.

## Concrete outcome

This file records the stale-alert resolution request in project context. Because this session only has read-only DB access, it cannot safely set `metric_alerts.resolved_at`. The next safe resolver/metrics workflow or human runtime operator should close alert `3135` if the metric remains at `0` on the next validation snapshot.

## Next validation

- Preferred: next `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected result: `value = 0` and alert `3135` resolved by the safe runtime alert lifecycle path
