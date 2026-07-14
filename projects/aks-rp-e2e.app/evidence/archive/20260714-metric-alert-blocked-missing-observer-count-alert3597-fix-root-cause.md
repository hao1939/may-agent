# Metric alert triage — blocked missing observer count (alert 3597)

- Metric: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3597`
- Owner: `app-ops`
- Chosen operation: `fix_root_cause`
- Triage time: `2026-07-14T05:41Z`

## Alert facts

Alert payload reported:

- current = `3`
- threshold = `0`
- target = `0`
- offending task ids from the latest snapshot:
  - `focus/rp-nodepool-ready-subset-pass-sync-20260714`
  - `focus/rp-cluster-ready-trio-packetize-no-live-20260714`
  - `focus/rp-nodepool-promotion-frontier-reconcile-20260714`

The previous snapshots for this metric were all `0`, so this was a fresh regression introduced by the new RP lifecycle focus children.

## Investigation

A live task-tree dry run before repair showed the metric breach was real in runtime state and limited to those three blocked leaves:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result before repair:

- `repairedCount = 3`
- repaired tasks exactly matched the three offender task ids from the metric snapshot

Live `task-tree show` confirmed the blocked leaves had `blocker.waiting_for`, `blocker.observation_method`, and `blocker.resume_condition`, but were missing `blocker.observed_by` (and therefore lacked the full observer contract expected by the metric).

## Root-cause fix applied

Applied the runtime-safe blocked-contract repair path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Post-repair live inspection of `focus/rp-cluster-ready-trio-packetize-no-live-20260714` showed the blocked contract was repaired with:

- `blocker.observed_by.workflow = project-planner`
- `blocker.observed_by.schedule = blocked-frontier-app-ops-review`
- `blocker.observed_by.trigger = project.planning.requested`
- `blocker.next_check_at` populated
- `blocker.fallback_at` populated
- `blocker.fallback_action` populated
- `trace.blocked_contract_repaired_at = 2026-07-14T05:41:09.122Z`

The same repair was applied to the other two RP lifecycle focus children.

## Verification

Post-fix live metric recompute:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed output:

```json
{"measuredAt":1784007677775,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

A follow-up dry run also showed no remaining blocked-contract repairs pending:

- `repairedCount = 0`

## Judgment

This alert was a real blocked-contract regression, not a noisy threshold and not a stale already-recovered alert at the moment of inspection. The safe owner action was to repair the live blocked contracts on the three new focus leaves. The validation signal now shows the missing-observer count back at `0`, and the next normal metrics snapshot should clear the persisted alert lifecycle.
