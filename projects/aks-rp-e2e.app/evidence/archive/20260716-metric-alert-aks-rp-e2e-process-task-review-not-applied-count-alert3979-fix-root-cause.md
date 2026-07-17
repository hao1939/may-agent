# Metric alert triage — `aks-rp-e2e.process.task.review-not-applied-count` (alert 3979)

- Alert id: `3979`
- Metric id: `aks-rp-e2e.process.task.review-not-applied-count`
- Chosen operation: `fix_root_cause`
- Judged at: `2026-07-16T21:03:00Z`

## Baseline

Fresh live recompute before repair:

```json
{"measuredAt":1784235615042,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"reviews\":[{\"taskId\":\"domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717\",\"attemptId\":\"a_domain_normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717_20260716202009\",\"decision\":\"followup\",\"reviewedAt\":\"2026-07-16T20:32:35.208Z\"},{\"taskId\":\"domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e\",\"attemptId\":\"a_domain_recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e_20260716194022\",\"decision\":\"accept\",\"reviewedAt\":\"2026-07-16T20:32:15.032Z\"}]}"}
```

The breach was real: both reviewed leaves were still in `state = review` even though accepted review events already existed.

Relevant review events from the runtime DB:

- `3346914` → `domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e` with `decision = accept`
- `3346950` → `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717` with `decision = followup`

## Current source facts used for judgment

### 1) Network CNI task was ready to accept as complete

The accepted review event `3346914` already contained same-run pass evidence for ADO run `172513552`, and the live review leaf still sat in `review`.

### 2) Node-pool followup had become directly actionable

The accepted followup review event `3346950` asked for a successor task after run `172540963` reached completed and published `slice-01-test-results`.

A fresh Azure DevOps check during triage showed that condition is now satisfied:

- `az pipelines runs show --id 172540963 ...` → `status = completed`, `result = succeeded`, `finishTime = 2026-07-16T20:43:47.380375+00:00`
- `az pipelines runs artifact list --run-id 172540963 ...` → artifacts include `plan-inputs` and `slice-01-test-results`

So the followup should not remain stranded in review, and it no longer needs a blocked wait placeholder; it needs a concrete successor task.

## Applied root-cause repair

I used the supported task-tree CLI to apply both reviews directly:

1. Created the concrete successor named by review `3346950`:
   - `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-terminal-artifact-review-20260717`
   - parent: `domain/normalize-scenario-tests-repo-frontier-20260715`
   - owner: `aks-explorer`
   - state: `backlog`
   - scope: exact same run/spec/file/path conflict scopes from the accepted review action

2. Closed the stale reviewed leaf as applied followup:
   - `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717`
   - final state: `done`
   - resolution: `replaced`
   - review summary names the created successor above

3. Closed the already-satisfied accepted recheck leaf:
   - `domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e`
   - final state: `done`
   - resolution: `completed`

## Post-repair validation

Fresh live recompute after repair:

```json
{"measuredAt":1784235779333,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"reviews\":[]}"}
```

Task-tree checks after repair:

- `domain/recheck-network-cni-azure-overlay-dual-stack-windows2022-ado-run-172513552-terminal-result-20260716e` now shows `state = done` with review summary `Applied accepted review 3346914...`.
- `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-artifact-review-20260717` now shows `state = done`, `resolution = replaced`, and review summary naming the successor task.
- `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle-ado-172540963-terminal-artifact-review-20260717` now exists as a concrete `backlog` task owned by `aks-explorer`.

## Judgment

Choosing `fix_root_cause` because the alert represented two real unapplied review decisions, and the owner could safely clear them through the supported task-tree control plane: one accepted review was completed, and one followup review was converted into a concrete successor task once the external ADO condition became true.