# Metric alert triage: `aks-rp-e2e.process.blocked.missing-waiting-for-count` — alert 3666

## Chosen operation

`fix_root_cause`

## Why the alert was real

- The alert row is still open for `aks-rp-e2e.process.blocked.missing-waiting-for-count` with `current=1`, `threshold=0`, and the latest snapshot note naming `ops/wait-project-approval-owner-return-primary-blocker-20260713` as the sole offender.
- Before repair, `bun run task-tree repair-blocked-contracts --dry-run` reported `repairedCount: 1` and named the same task id, proving the runtime task tree still had one blocked leaf missing structured wait metadata.

## Concrete repair applied

Ran the supported task-tree repair against the controller-authoritative runtime tree:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

The repair reported `repairedCount: 1` for `ops/wait-project-approval-owner-return-primary-blocker-20260713`.

After the repair, `bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713` showed the blocked contract now includes:

- `blocker.waiting_for.type = "blocker.resolved"`
- `blocker.waiting_for.taskId = "ops/wait-project-approval-owner-return-primary-blocker-20260713"`
- `blocker.observed_by.workflow = "project-planner"`
- `blocker.observation_method` populated

## Validation

- A direct runtime-tree blocked-leaf audit returned `{"missingCount":0,"bad":[]}`.
- A follow-up supported metric recompute returned `{"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}`.

## Closure expectation

The runtime blocked-wait contract defect is repaired. The persisted metric row and open alert should recover on the next metrics snapshot / alert recovery cycle.