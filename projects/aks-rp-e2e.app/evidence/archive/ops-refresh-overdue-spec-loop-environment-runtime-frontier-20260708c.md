# Overdue spec-loop environment/runtime frontier refresh audit — 2026-07-08

- Task: `ops-refresh-overdue-spec-loop-environment-runtime-frontier-20260708c`
- Attempt: `a_ops-refresh-overdue-spec-loop-environment-runtime-frontier-20260708c_20260708112306`
- Mode: Task Worker Mode
- Tree mutation from this worker session: **none**
- Why no mutation: this assignment requires planner/app-ops task-tree metadata updates and holder replacement decisions across multiple blocked waits. Worker mode forbids broad tree edits, so this session records the exact current truth and the remaining planner actions.

## What changed before/during this assignment

By the time this worker inspected the live tree, the planner had already applied part of the overdue-frontier repair directly in the app tree:

- `wait-spec-fleet-hubless-managed-cluster-quota-headroom-frontier-20260707`
  - blocker metadata refreshed at `2026-07-08T11:17:55Z`
- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
  - blocker metadata refreshed at `2026-07-08T11:17:55Z`
- `hold-spec-private-cluster-private-endpoint-connections-lifecycle-westus2-capacity-frontier-20260707`
  - marked `done` / `replaced` at `2026-07-08T11:18:08Z`
  - truthful surviving holder is `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- `hold-spec-rp-cluster-lifecycle-nodeless-cluster-crud-terminal-product-gap-frontier-20260707`
  - marked `done` / `replaced` at `2026-07-08T11:18:08Z`
  - truthful surviving holder is `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c`
  - blocker metadata refreshed at `2026-07-08T11:18:35Z`

So this worker is not discovering a fully untouched alert-3097 frontier. It is auditing the exact post-repair state and identifying what still needs planner-side refresh before this task can be cleanly accepted.

## Live metric state when checked

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.overdue-unworked-count --json
```

Observed:

```json
{"measuredAt":1783509907852,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Interpretation:

- Alert 3097's exact overdue environment/runtime holders are **currently represented** for metric purposes.
- That is true because this active task carries conflict scope `ops:blocked-overdue:spec-loop:environment-runtime`, and the metric logic in `scripts/project-metrics.ts` treats an active/review task with matching `ops:blocked-overdue:spec-loop:*` scope as coverage for overdue spec-loop blocked waits.
- So the metric is green **now**, but several underlying holder watch timestamps are still stale and should be refreshed before this task is accepted.

## Exact touched holder set: current truth

### Refreshed or consolidated already

| holder id | current state | current truth |
|---|---|---|
| `wait-spec-fleet-hubless-managed-cluster-quota-headroom-frontier-20260707` | `blocked` | refreshed with future `next_check_at` / `fallback_at`; still truthful exact wait |
| `hold-spec-private-cluster-private-endpoint-connections-lifecycle-westus2-capacity-frontier-20260707` | `done` | correctly replaced by `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` |
| `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c` | `blocked` | refreshed with future `next_check_at` / `fallback_at`; still truthful exact wait |
| `hold-spec-rp-cluster-lifecycle-nodeless-cluster-crud-westus2-capacity-frontier-20260707` | `blocked` | still present as exact spec holder, but the shared family holder is also refreshed and now explicitly names this successor |
| `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` | `blocked` | refreshed family-level westus2-capacity holder covering private-endpoint and nodeless successors |

### Still truthful but still carrying stale watch metadata

These holders remain `blocked` and still look like truthful current exact waits, but their blocker timing fields are already past and should be refreshed by planner/app-ops before accepting this task:

1. `hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707`
2. `hold-spec-ccp-underlay-vpa-component-lifecycle-underlay-access-frontier-20260707`
3. `hold-spec-cost-analysis-vm-prerelease-shared-underlay-runtime-input-frontier-20260707`
4. `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
5. `hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c`
6. `hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707`
7. `hold-spec-virtualmachine-prerelease-row75-aksconformance-core-run-28721673014-frontier-20260707`
8. `hold-spec-virtualmachine-prerelease-row76-aksconformance-tunnel-run-28721673014-frontier-20260707`
9. `hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h`
10. `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f`
11. `hold-spec-rp-cluster-lifecycle-new-vnet-run-28592745619-artifact-visibility-reviewed-frontier-20260707f`
12. `hold-spec-rp-cluster-lifecycle-nodeless-cluster-crud-westus2-capacity-frontier-20260707` (spec-local successor still stale even though family holder is refreshed)

## Timestamp audit

Worker-side timestamp check against live `.state/tasks/tree.json` at `2026-07-08T11:24:55Z`:

| holder id | state | next_check_at status | fallback_at status | resume_at status |
|---|---|---:|---:|---:|
| `wait-spec-fleet-hubless-managed-cluster-quota-headroom-frontier-20260707` | blocked | future | future | missing |
| `hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-private-cluster-private-endpoint-connections-lifecycle-westus2-capacity-frontier-20260707` | done | - | - | - |
| `hold-spec-ccp-underlay-vpa-component-lifecycle-underlay-access-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-cost-analysis-vm-prerelease-shared-underlay-runtime-input-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c` | blocked | past | past | missing |
| `hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-virtualmachine-prerelease-row75-aksconformance-core-run-28721673014-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-virtualmachine-prerelease-row76-aksconformance-tunnel-run-28721673014-frontier-20260707` | blocked | past | past | missing |
| `hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h` | blocked | past | past | missing |
| `wait-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260707f` | blocked | past | past | missing |
| `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c` | blocked | future | future | past |
| `hold-spec-rp-cluster-lifecycle-new-vnet-run-28592745619-artifact-visibility-reviewed-frontier-20260707f` | blocked | past | past | past |
| `hold-spec-rp-cluster-lifecycle-nodeless-cluster-crud-westus2-capacity-frontier-20260707` | blocked | past | past | future |
| `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` | blocked | future | future | future |

## Important interpretation

This task's acceptance asks for each touched holder to be either:

- refreshed with fresh evidence and watch metadata, or
- replaced by one truthful surviving family-level wait.

Current live state satisfies that only **partially**:

- satisfied for `fleet` and `serverless-virtualnodes`
- satisfied for `private-endpoint westus2` through replacement by shared family holder
- satisfied at family level for the westus2-capacity family holder itself
- **not yet satisfied** for the remaining stale exact holders listed above

So the task should **not** be accepted as fully complete yet unless planner/app-ops first updates those stale holders or intentionally replaces more of them with a clearly truthful surviving family-level holder.

## Planner-ready next actions

1. Keep this task active until the remaining stale exact holders are refreshed or intentionally consolidated.
2. For the westus2-capacity slice:
   - surviving family holder is already `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
   - planner should decide whether `hold-spec-rp-cluster-lifecycle-nodeless-cluster-crud-westus2-capacity-frontier-20260707` remains a necessary exact successor or should also be replaced by the refreshed shared family holder.
3. Refresh blocker timing/evidence on the remaining stale exact waits without reopening unchanged live runs:
   - BYO UDR prerequisite
   - CCP underlay access
   - cost-analysis shared underlay/runtime input
   - rp-nodepool rollback environment
   - network-acns user-iptables runtime blocker
   - three VM-prerelease row holders from run `28721673014`
   - workload-autoscaler KEDA upgrade HTTP 400 frontier
   - serverless-schedulerctrl underlay kubeconfig frontier
   - rp-cluster new-vnet run `28592745619` artifact-visibility frontier
4. After those updates, rerun the same metric command to confirm the active task is no longer masking stale watch metadata that still needs repair.

## Evidence references

- `.state/tasks/tree.json`
- `.state/journal.jsonl`
- `scripts/project-metrics.ts`
- this note: `evidence/archive/ops-refresh-overdue-spec-loop-environment-runtime-frontier-20260708c.md`

## Bottom line

The environment/runtime overdue frontier is **currently represented** and the metric is now **0**, but only because planner-side refresh work has already started and this active task's conflict scope covers the remaining waits. The tree still contains a substantial set of truthful but stale exact blocked holders whose watch metadata remains past due, so the planner should use this audit as the remaining repair checklist before accepting the task.