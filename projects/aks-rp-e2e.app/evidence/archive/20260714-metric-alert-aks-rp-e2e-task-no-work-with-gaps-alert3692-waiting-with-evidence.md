# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3692`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triaged at: `2026-07-14T17:29:54Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row still shows a breaching sample (`current=1`), but the owner-side source metric already recomputes healthy (`0`) against the current live task tree. This triage environment only provides read-only runtime DB access, so the concrete safe owner action is to leave durable evidence and wait for the next `metrics-snapshot` / alert-recovery pass instead of trying to edit `metrics` or `metric_alerts` directly.

## Runtime state checked

Read-only runtime inspection during triage showed:

- `metrics.current = 1`
- `metrics.updated_at = 1784050047780`
- alert `3692` remains unresolved
- latest snapshots for this metric were `1, 0, 0, 0, 1, 0, 1, 0, 0, 0`

That pattern matches a transient/stale breach, not a stable starvation condition.

## Current owner-side recomputation

Command:

```bash
cd /app/projects/aks-rp-e2e.app && \
  printf 'active-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.active-count && \
  printf 'stale-active-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-count && \
  printf 'no-work-with-gaps=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps && \
  printf 'unknown-path-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.model.unknown-path-count && \
  printf 'spec-unverified-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.spec.unverified-count
```

Observed output:

```text
active-count=1
stale-active-count=0
no-work-with-gaps=0
unknown-path-count=60
spec-unverified-count=90
```

Interpretation:

- `unknown-path-count=60` and `spec-unverified-count=90` prove verification gaps still remain.
- `active-count=1` and `stale-active-count=0` prove the project currently has healthy active work.
- Therefore the source metric correctly recomputes `0` right now.

## Live frontier evidence

Current task summary shows:

- one active leaf: `review-spec-kms-v2-private-vnet-integration-private-kv-rerun-171997614-return-20260714`
- three review leaves:
  - `domain-burn-down-spec-loop-blocked-wave-b-20260714-followup-followup`
  - `domain-burn-down-spec-loop-blocked-wave-c-20260714-followup-followup`
  - `domain/reconcile-compact-loop-blocked-wave-c-20260714`
- no runnable backlog leaves
- 123 blocked leaves remain represented

The runtime `sessions` table also shows current running project sessions, including the planner wake and the active `aks-explorer` worker session for the KMS review leaf. That matches the healthy recomputation: the project still has executable work even though the persisted metric row has not caught up yet.

## Why this is not another operation

- Not `fix_root_cause`: there is no current no-work frontier left to repair for alert `3692`; the source metric is already healthy.
- Not `resolve_stale`: the alert likely is stale, but this workflow does not provide a safe write path to resolve `metric_alerts` directly.
- Not `calibrate_metric`: the metric contract still correctly describes a real P0 zero-work condition.
- Not `downgrade_priority`: a true no-work-with-gaps breach should remain P0.
- Not `upgrade_or_escalate`: no destructive action or human policy decision is required.
- Not `document_exception`: this is not an intentionally accepted breach.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected validation: the persisted runtime row for `aks-rp-e2e.task.no-work-with-gaps` should move from `1` to `0`, after which alert `3692` should recover naturally. If the persisted row remains `1` after the next snapshot while the owner-side metric command still returns `0`, re-triage it as a metric state-sync defect rather than real project starvation.
