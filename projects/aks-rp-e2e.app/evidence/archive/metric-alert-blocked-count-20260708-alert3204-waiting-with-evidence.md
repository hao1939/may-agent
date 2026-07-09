# Metric alert triage — `aks-rp-e2e.task.blocked-count` — alert `3204`

- Metric id: `aks-rp-e2e.task.blocked-count`
- Alert id: `3204`
- Judged at: `2026-07-08T18:00:05Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

This breach is real now, but it is not yet a priority or calibration change case.
The live runtime tree still has active and review motion, and the blocked count is
only modestly above the newly recalibrated `130` threshold. The smallest truthful
operation is to keep the alert visible as a watch signal while recording why the
current 135 count is accepted temporarily: the blocked frontier is still exact-wait
stewardship, not hidden runnable work or broken blocked contracts.

## Evidence checked

### Runtime metric row

`query_db(metrics)` returned:

- `current=135`
- `threshold=130`
- `target=0`
- `priority=P3`
- description still says the accepted wind-down frontier is about `105-109` blocked
  leaves and should only alert when blocked leaves grow materially beyond that
  plateau or crowd out active work.

### Recent persisted samples

Prompt snapshots showed:

- `135` at `1783550176217`
- `136` at `1783549870923`
- `136` at `1783549566062`
- `135` at `1783549261140`
- `135` at `1783548949790`
- `135` at `1783548615061`
- `133` at `1783548311508`
- `132` at `1783548007675`
- `130` at `1783547707254`
- `128` at `1783547406718`

The breach is therefore current, not stale.

### Fresh local recompute

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.blocked-count --json
```

Result:

```json
{"measuredAt":1783550258871,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":135}
```

### Live task-tree summary

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts summary
```

Relevant result:

- `counts.blocked=135`
- `counts.active=5`
- `counts.review=3`
- `counts.backlog=2`
- active frontier includes:
  - `focus-active-review-runnable-frontier-no-live-20260708`
  - `reconcile-compact-loop-live-workflow-202607082233`
  - `reconcile-spec-loop-pending-kms-38`
  - `repair-compact-net-integration-checker-subset-20260708`
  - `verify-spec-secops-fips-version-gate-bounded-rerun-20260708`
- review frontier includes:
  - `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607082233`
  - `hold-compact-bootstrap-profile-cache-direct-cache-switch-arm-timeout-frontier-20260708g`
  - `ops-investigate-empty-review-turn-failures-20260708`

This means blocked waits have not yet crowded out all useful motion.

### Blocked-leaf distribution

Direct `.state/tasks/tree.json` scan showed:

- `135` blocked leaves total
- all `135` blocked leaves are owned by `aks-explorer`
- top branch counts:
  - `aks-spec-verification-loop = 109`
  - `aks-feature-compact-loop = 19`
  - `focus-dev-infra-core-live-pass-20260707 = 2`
  - project-level shared waits = `5` single exact holders

The current count is therefore dominated by known domain wait families rather than
by an app-ops integrity defect such as missing owners or missing blocked metadata.

## Why this is `waiting_with_evidence`

- **Not `resolve_stale`**: fresh recompute and task-tree summary both still say `135`.
- **Not `fix_root_cause`**: the count reflects legitimate domain wait inventory, and
  app-ops should not force-close domain waits just to improve the metric.
- **Not `calibrate_metric`**: the threshold was already recalibrated to `130` on
  2026-07-08. One small breach while active/review work is still healthy is not yet
  enough evidence to move the threshold again.
- **Not `upgrade_or_escalate`**: the signal is still P3 watch-level, with active and
  review capacity present and no integrity/safety issue.

## Validation trigger

Re-check on the next metrics snapshot or after the current active/review frontier
changes materially. This judgment should be revisited immediately if either of the
following becomes true:

1. blocked count stays above `130` after the current active/review leaves drain, or
2. blocked count rises again while `active + review` capacity falls toward zero.
