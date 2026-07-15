# Net-integration multinic same-run carrier routing repair review — 2026-07-15

- Task: `ops/repair-net-integration-multinic-same-run-carrier-routing-20260715`
- Scope: prove whether `hold-compact-net-integration-package-partial-frontier` points at a missing/stale downstream carrier for `spec.net-integration.multinic-dualstack` + `spec.net-integration.multinic-mixed`, then record the smallest truthful repair proposal.
- Worker-mode note: this session did **not** mutate the runtime task tree because the assigned task did not explicitly authorize a supported `task-tree ...` metadata command from worker mode. This memo is the planner/app-ops review material for the exact repair.

## Primary findings

### 1) The holder currently points at a **missing downstream task id**

Live app-owned surfaces still point the multinic pair at:

- `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`

Current live references:

- `.state/tasks/tree.json`
  - `hold-compact-net-integration-package-partial-frontier.goal`
  - `hold-compact-net-integration-package-partial-frontier.blocker.waiting_for.taskId`
- `.state/spec-loop/state.json`
  - `spec.net-integration.multinic-dualstack.taskId`
  - `spec.net-integration.multinic-mixed.taskId`
- `.state/feature-compact-loop/state.json`
  - `waitingFor.taskId`
  - `retryReason` / `ownerReason` / `blockedReason`

But the live runtime task tree no longer contains that task id. A direct scan of `.state/tasks/tree.json` finds only these current tasks mentioning the multinic/run-172268432 linkage:

- `project`
- `hold-compact-net-integration-package-partial-frontier`
- `ops/repair-net-integration-multinic-same-run-carrier-routing-20260715`

So the holder/spec/compact state all point at one owner path that is **absent** from the live tree.

### 2) The referenced consumer task was archived away

The missing task is not hypothetical; it exists only in archive now.

Archived evidence:

- `.state/tasks/archive/done-leaves-20260715010555064.json`
  - contains `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`
  - archived at `2026-07-15T01:05:55.064Z`
- `.state/journal.jsonl`
  - `2026-07-15T01:05:55.309Z task_tree_parent_rolled_up` archived `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`

That archive action left the holder/spec-loop/compact-loop pointers behind, so the family wait now references a non-live downstream task.

### 3) The same-run carrier text is also **stale**

The live holder/spec-loop/compact-loop wording still says the multinic pair is on one `shared_ado_job_assignment_wait` because run `172268432` was:

- `status = notStarted`
- `result = null`
- `startTime = null`
- `finishTime = null`
- `artifactCount = 0`
- `nextCheckAt = 2026-07-15T01:30:00Z`
- `fallbackAt = 2026-07-15T02:00:00Z`

Current live state examples:

- `.state/spec-loop/state.json`
  - both multinic specs still carry `review.classification = shared_ado_job_assignment_wait`
  - both still record `adoStatus = notStarted`
  - both still record `artifactCount = 0`
- `.state/feature-compact-loop/state.json`
  - `blockedReason` still says run `172268432` is `notStarted` with `[]` published artifacts
  - `nextCheckAt` / `fallbackAt` remain the old `01:30Z` / `02:00Z` windows
- `.state/tasks/tree.json`
  - holder goal / acceptance / blocker text still repeats the same queued/notStarted/no-artifacts story

### 4) Fresh ADO evidence shows the queue-stall fallback condition is **not** met

Fresh authenticated ADO checks from this session:

#### `az pipelines runs show --id 172268432`

Current run facts:

- `status = inProgress`
- `result = null`
- `startTime = 2026-07-15T01:15:36.637675+00:00`
- `finishTime = null`
- `lastChangedDate = 2026-07-15T01:16:12.287000+00:00`
- `queueId = 12818`
- `sourceVersion = 1fda31ac51e8c31b7e73949dc8e1df8de32d484d`

#### `az pipelines runs artifact list --run-id 172268432`

Current artifact facts:

- published artifacts are no longer `[]`
- currently present artifact: `plan-inputs`

These fresh ADO facts disprove the old same-run carrier wording in two ways:

1. the run is no longer `notStarted`; it has started and is `inProgress`
2. the run is no longer artifactless; at least `plan-inputs` exists

Because the holder's fallback escalation required the run to remain `notStarted` with `workerName = null` and no artifacts, the existing queue-stall fallback condition is **false right now**. The truthful repair is therefore **not** a shared queue-stall escalation at this time.

### 5) There is no evidence of a duplicate rerun request in the live tree

Current live task scan shows no surviving live task for:

- `domain/queue-net-integration-multinic-live-rerun-slice-20260715`
- `wait-net-integration-multinic-dualstack-ado-run-172268432-result`
- `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`

The queue task and prior wait exist only in archive / journal lineage. So the present problem is **missing/stale representation**, not an extra live rerun request.

## Diagnosis

`hold-compact-net-integration-package-partial-frontier` currently has **both** defects named in the acceptance criteria:

1. it references a **missing** downstream task (`domain/consume-net-integration-multinic-live-run-172268432-return-20260715` is archived, not live), and
2. it preserves a **stale same-run carrier** (still describes run `172268432` as queued/notStarted/zero-artifact job-assignment wait even though the run is now in progress and already published `plan-inputs`).

## Smallest truthful repair proposal for planner

Because the queue-stall fallback predicate is not met, the smallest truthful repair is to **recreate/relink one exact same-run consumer task** for run `172268432`, not to create a queue-stall escalation and not to queue another rerun.

### Proposed live downstream owner task

Planner should re-add this exact owner path under `aks-feature-compact-loop`:

- `id`: `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`
- `state`: `blocked`
- `kind`: `domain_leaf`
- `owner`: `aks-explorer`
- `goal`: `Consume the returned signal for Azure DevOps run 172268432 covering spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed: inspect terminal artifacts when they appear, or sharpen the same run into one exact shared execution/setup/escalation wait without queueing a duplicate rerun.`

### Proposed blocker shape

Use the same `waiting_for.type = ado.pipeline_run.completed` contract, but refresh the facts to current truth:

- `runId = 172268432`
- `queueId = 12818`
- `specIds = [spec.net-integration.multinic-dualstack, spec.net-integration.multinic-mixed]`
- current ADO status is `inProgress`, not `notStarted`
- `startTime` is populated
- `finishTime` is still `null`
- currently known artifact surface includes `plan-inputs`
- no duplicate rerun before same-run terminal artifacts or one sharper same-run escalation

Recommended blocker wording:

> Azure DevOps run 172268432 for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed is now inProgress (startTime 2026-07-15T01:15:36.637675+00:00, lastChangedDate 2026-07-15T01:16:12.287000+00:00), result null, finishTime null, queueId 12818, with plan-inputs published but no terminal result bundle consumed yet. Keep one same-run returned-signal consumer task on this exact run until terminal artifacts appear or the same run sharpens into one exact shared execution/setup/escalation wait. Do not queue another rerun first.

### Required holder/spec/compact text refresh

Planner should then refresh the three controller-visible surfaces so they point at the recreated live task and stop claiming the old queued/notStarted carrier:

1. `hold-compact-net-integration-package-partial-frontier`
2. `.state/spec-loop/state.json` rows for:
   - `spec.net-integration.multinic-dualstack`
   - `spec.net-integration.multinic-mixed`
3. `.state/feature-compact-loop/state.json` `net-integration` row

Minimum truth changes required:

- keep one downstream owner path: `domain/consume-net-integration-multinic-live-run-172268432-return-20260715`
- remove stale `notStarted` / `startTime null` / `[] artifacts` wording
- remove stale `shared_ado_job_assignment_wait` wording unless planner intentionally reuses that classification with updated semantics
- refresh expired `nextCheckAt` / `fallbackAt` windows from the new repair time instead of preserving the already-expired `2026-07-15T01:30:00Z` / `2026-07-15T02:00:00Z`
- preserve the no-duplicate-rerun rule
- keep queue-stall escalation only as a future fallback if the same run later stops progressing or still fails to produce reviewable result artifacts by the refreshed fallback window

## Exact planner-facing outcome

- **Do create/relink** one live same-run consumer task for run `172268432`.
- **Do not** create a queue-stall escalation now.
- **Do not** queue a duplicate multinic rerun.
- **Do refresh** the holder/spec-loop/compact-loop text so it matches the current in-progress ADO facts and points at a real live downstream task again.

## Canonical event / review proposal

No runtime event was emitted from this worker session.

Planner/app-ops should treat this memo as the evidence packet for a task-tree repair review whose action is:

1. recreate/relink `domain/consume-net-integration-multinic-live-run-172268432-return-20260715` as the single live downstream owner, and
2. update the holder/spec-loop/compact-loop surfaces away from the stale queued/job-assignment wording to current same-run in-progress truth.
