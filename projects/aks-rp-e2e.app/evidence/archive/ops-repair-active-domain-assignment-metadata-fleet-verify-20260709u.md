# ops/repair-active-domain-assignment-metadata-fleet-verify-20260709u

Date: 2026-07-09
Agent: app-ops

## Scope

Classify the active compact Fleet verifier attempt `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220` and record whether it is:

- valid in-flight work,
- a stale-attempt requeue,
- or an assignment-contract bug.

Per worker constraints, this note does **not** mutate the live task tree. It records the evidence and the repair path the planner/tooling should apply after review.

## Finding

**Classification: assignment-contract bug that currently presents as a stale active leaf, not valid in-flight work.**

The active verifier leaf was created and assigned with a blank owner/worker contract, so the tree shows an active attempt but there is no matching runtime worker session in the `sessions` table. The task is therefore not truthful in-flight work.

## Evidence

### 1) Runtime task tree shows the active Fleet verifier has blank ownership metadata

From `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`:

- task id: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220`
- `state: "active"`
- `owner: ""`
- `trace.assigned_worker: ""`
- `trace.current_attempt_id: "a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220_20260709122048"`
- `session_id: "s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220"`
- `trace.worker_started_attempt_id` equals the same attempt id

This means the leaf was promoted to active with an empty owner/worker contract before any truthful worker attribution existed.

### 2) Journal confirms the assignment and worker-start records were emitted with empty worker

From `/app/projects/aks-rp-e2e.app/.state/journal.jsonl`:

- `2026-07-09T12:20:49.065Z` `task_assigned` for `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220` recorded `worker:""`
- `2026-07-09T12:21:31.702Z` `task_worker_started` for the same task recorded `worker:""`

So this is not just a display issue on the task node; the emitted lifecycle events themselves carried the blank worker.

### 3) There is no matching live runtime session for the active Fleet verifier attempt

Querying `sessions` for `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220` returned **no row**.

By contrast, older Fleet verifier sessions do exist and are attributed to `aks-explorer`, for example:

- `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091159` → `agent: aks-explorer`, `status: done`
- `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle_retry_20260709115338` → `agent: aks-explorer`, `status: done`

This proves the active 12:20 verifier leaf is not backed by an actual worker session, unlike prior healthy assignments.

### 4) The planner already suspected the same problem

From `/app/projects/aks-rp-e2e.app/.state/planner-runs.jsonl` at `2026-07-09T12:24:55.170Z`:

> `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220` is active with empty owner. Planning should validate whether it is actually claimed; otherwise this is an active-state hygiene issue, not real in-flight work.

The evidence collected here confirms that suspicion.

## Why this is an assignment-contract bug, not just a stale attempt

A pure stale-attempt requeue would normally imply a previously valid worker/session contract that later expired or disappeared. Here, the defect is earlier and more basic:

1. the task node was created with `owner: ""`,
2. the assignment event recorded `worker: ""`,
3. the worker-start event also recorded `worker: ""`, and
4. no runtime `sessions` row was ever created for that supposed worker session.

So the stale active state is the **symptom**; the root cause is that assignment allowed an empty worker/owner contract onto a focused domain leaf.

## Current-attempt safety judgment

The tree still marks this verifier leaf active, but the runtime evidence shows there is **no real running worker session** behind it.

Because this task is a worker-scoped audit/repair and not planner authority, I did **not** mutate the live task tree from this session. The safe path is for planner/app-ops review to repair the leaf after this note is consumed.

## Recommended post-completion repair path

Planner/app-ops should apply the following after reviewing this note:

1. Treat `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220` as a false active leaf caused by bad assignment metadata.
2. Requeue or replace that leaf through normal task-tree tooling so the next assignment is emitted only with a non-empty owner/worker contract.
3. Preserve the existing conflict scope `task-assignment:fleet-hubless-rpapi-lifecycle` while doing so, so a truthful Fleet-focused verifier remains single-owner.

## Concrete tooling/planner follow-up

A durable follow-up is warranted because recurrence is possible.

### Follow-up the planner should add

Create one ops/tooling repair task for the assignment path that creates focused compact/spec leaves, with acceptance like:

- reject assignment when task owner resolves to empty,
- reject `task_assigned` journal emission when worker is empty,
- reject `task_worker_started` for empty-worker assignments,
- add a regression test covering focused leaf creation/assignment so `owner` and `trace.assigned_worker` must be non-empty,
- optionally add watchdog/planner hygiene that flags `active` leaves with `owner:""` or `trace.assigned_worker:""` before they are treated as real in-flight work.

### Minimum code-level suspect area

The assignment metadata is preserved in runtime code paths that use `assigned_worker`, `current_attempt_id`, and `task_worker_started` journal emission. Relevant visible source surfaces in the app repo include:

- `workflows/project-planner.ts`
- `workflows/task-worker.ts`
- `workflows/default-task-worker.ts`
- `workflows/lib/task-tree-tools.ts`

The emitted runtime artifacts show the bug is in the assignment/dispatch contract, not in Fleet domain content.

## Bottom line

The current unowned active Fleet verifier is **not** valid in-flight work. It is an **assignment-contract bug** that left behind a stale active task shape: empty owner, empty assigned worker, empty worker-start attribution, and no backing runtime session row. The planner should repair the leaf after review and add a tooling guard so future focused domain leaves cannot be activated with a blank worker/owner contract.
