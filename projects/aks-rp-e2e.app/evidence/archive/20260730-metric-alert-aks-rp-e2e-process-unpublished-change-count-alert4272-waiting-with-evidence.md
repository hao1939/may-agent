# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 4272)

- Operation: `waiting_with_evidence`
- Alert id: `4272`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-30T00:59:22Z`

## Why the breach is still real now

The alert body (`current=3`) still matches the live measurement.

### Runtime metric row

```sql
SELECT id, current, threshold, target, priority, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.unpublished-change-count';
-- current = 3
-- threshold = 0
-- target = 0
-- priority = P0
```

### Fresh recompute

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1785372955587,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3}
```

### Repo truth

```bash
cd /app/projects/aks-rp-e2e && git status --porcelain=v1 --branch
# ## dev...origin/dev
#  M features/net-integration/compact/staging.diagnostics.json
#  M features/net-integration/compact/staging.plan.json
#  M features/net-integration/compact/staging.summary.md

cd /app/projects/aks-rp-e2e && git rev-list --count HEAD --not --remotes=origin
# 0
```

So the current count is exactly three dirty tracked files and no local-only commit objects.

## The three counted files are already represented by a live exact hold

The current unpublished slice is the regenerated `net-integration` compact packet:

- `features/net-integration/compact/staging.diagnostics.json`
- `features/net-integration/compact/staging.plan.json`
- `features/net-integration/compact/staging.summary.md`

Fresh diff evidence shows those are the only changed files in the slice:

```bash
cd /app/projects/aks-rp-e2e && git diff --name-status -- \
  features/net-integration/compact/staging.diagnostics.json \
  features/net-integration/compact/staging.plan.json \
  features/net-integration/compact/staging.summary.md
# M features/net-integration/compact/staging.diagnostics.json
# M features/net-integration/compact/staging.plan.json
# M features/net-integration/compact/staging.summary.md
```

The live task tree already binds this exact residue to current compact-frontier lineage:

- parent task `compact/compact-feature-net-integration-9ff54e06c2`
  - `phase=waiting`
  - summary says current `origin/dev` materially changed the compact surface, the package was regenerated and locally check-validated, and the task now waits on one direct child hold preserving the refreshed frontier
- child hold `hold-compact-net-integration-split-frontier-9ff54e06c2-20260730`
  - `phase=running`
  - outcome: preserve the exact `net-integration` split compact frontier after current `origin/dev d4773ce8` without reopening an unchanged broad compact rerun
  - outputs include exactly:
    - `features/net-integration/compact/staging.plan.json`
    - `features/net-integration/compact/staging.summary.md`
    - `features/net-integration/compact/staging.diagnostics.json`
    - `evidence/archive/reconcile-compact-feature-net-integration-current-head-d4773ce8-20260730.md`

The current domain evidence memo for that hold explains why the packet changed and why it must stay visible for now:

- current `origin/dev` moved `spec.net-integration.cross-tenant-auxiliary-token` from the ready set into an accepted environment-blocked frontier member
- regenerated compact authority changed from the older mixed frontier to a new split frontier
- the full local compact `--check` suite passed (`51 passed (51)`), so the packet is current rather than accidental planner residue

The unpublished count is therefore real, but it is not orphaned: it is already attached to exact live compact-frontier work owned by `aks-explorer`.

## Why this is not `fix_root_cause`, `resolve_stale`, or `calibrate_metric`

- **Not `fix_root_cause`**: app-ops should not publish, discard, or rewrite this domain compact packet while the same three files are already attached to the live `net-integration` compact hold.
- **Not `resolve_stale`**: both the runtime metric row and direct recompute still read `3`.
- **Not `calibrate_metric`**: threshold `0` remains correct because these domain-repo changes are still invisible to pipeline runs until they are published or truthfully cleared.
- **Not `upgrade_or_escalate`**: the alert is already `P0`, and current evidence shows an exact live owner and hold rather than an ownerless or destructive-repair situation.

## Why the final operation is `waiting_with_evidence`

`waiting_with_evidence` is the smallest truthful operation because the breach is real but already represented by one exact current hold:

1. the metric still measures `3` live unpublished files,
2. all three are the `net-integration` compact packet files,
3. the live task tree already preserves that exact packet under `hold-compact-net-integration-split-frontier-9ff54e06c2-20260730`.

This memo is the concrete triage artifact: it records that alert 4272 is a represented live wait, not an unowned publication gap.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if either of these lands first:

1. `hold-compact-net-integration-split-frontier-9ff54e06c2-20260730` is replaced or closed by a newer exact compact-frontier decision; or
2. the three `features/net-integration/compact/staging.*` files are published, reverted, or otherwise truthfully cleared from `/app/projects/aks-rp-e2e`.
