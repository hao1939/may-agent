# Metric alert triage: aks-rp-e2e.process.blocked.missing-fallback-count (alert 2881)

- Alert id: 2881
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Decision: `fix_root_cause`
- Triage time: 2026-07-07T05:35Z

## Why this alert was real

The metric definition counts blocked leaf tasks in the runtime task tree that are missing either:

- `blocker.fallback_at`
- `blocker.fallback_action`

A fresh runtime-tree audit using the same SDK/task-tree path as the metric found one live offender:

- `hold-compact-extension-addon-spec-metadata-eligibility-frontier-20260707b`

That blocked leaf had only:

- `condition`
- `category`
- `owner`
- `resume_condition`

and was missing fallback metadata.

## Root cause fixed

Updated `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` for `hold-compact-extension-addon-spec-metadata-eligibility-frontier-20260707b` by adding:

- `waiting_for`
- `observed_by`
- `observation_method`
- `next_check_at`
- `fallback_at: 2026-07-08T17:32:17.297Z`
- `fallback_action: If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`
- `trace.blocked_contract_repaired_at`

## Validation

After the runtime-tree repair, rerunning the metric command returned:

```text
0
```

Command used:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

## Note on repo state

The fix was applied to the runtime task tree under `.state/tasks/tree.json`, which is ignored runtime state. The `/app` git worktree already contains many unrelated modified/untracked paths from other active work, so this triage session did not make a safe isolated commit.
