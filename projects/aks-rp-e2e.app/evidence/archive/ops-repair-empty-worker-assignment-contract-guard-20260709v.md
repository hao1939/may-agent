# ops/repair-empty-worker-assignment-contract-guard-20260709v

Date: 2026-07-09
Agent: app-ops

## Goal

Harden focused task assignment so planner/worker dispatch cannot activate leaves or emit assignment lifecycle events with empty owner/worker metadata.

## Incident confirmed

The earlier active Fleet compact verifier incident was real assignment-contract corruption, not just a stale display bug.

From the prior audit note at `evidence/archive/ops-repair-active-domain-assignment-metadata-fleet-verify-20260709u.md`:

- task `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607091220` became `active` with `owner: ""`
- its `trace.assigned_worker` was `""`
- journal emitted `task_assigned` with `worker:""`
- journal emitted `task_worker_started` with `worker:""`
- there was no matching runtime `sessions` row for the claimed active attempt

That established the bad state this repair needed to close.

## Root cause

The empty-worker assignment was admitted by **two adjacent empty-string fallthrough bugs**.

### 1) Worker routing config treated blank trigger worker as authoritative

File: `projects/aks-rp-e2e.app/workflows/default-task-worker.ts`

Old behavior in `buildTaskTreeConfig(...)` effectively did:

- `assignedWorker = triggerString(trigger, "worker")`
- `worker = assignedWorker ?? field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent`

Because `triggerString(...)` returns `""` for a present-but-blank worker, nullish coalescing preserved the empty string instead of falling back.

That meant any workflow path using `buildTaskTreeConfig(...)` could carry `config.worker = ""` when the incoming assignment event had `worker:""`.

This is especially relevant for focused controller/dispatch flows such as compact/spec loop controllers, which later call `assignTask(config, { taskId })` for child work.

### 2) SDK assignment creation also treated blank owner/worker as valid

File: `projects/may-agent/packages/sdk/src/project-task-tree.ts`

Old behavior in `createAssignmentForTask(...)` did:

- `worker = input.worker ?? task.owner ?? config.worker`

Again, `""` is not nullish, so a blank `input.worker`, blank `task.owner`, or blank `config.worker` could survive and be written through as the assignment worker.

That allowed the SDK to:

- flip the task to `active`
- set `task.owner = ""`
- set `trace.assigned_worker = ""`
- append an outbox assignment with `worker:""`
- append `task_assigned` journal entries with `worker:""`

So the exact bug was not a single missing validation check; it was a two-step contract leak where **blank strings were treated as real worker values** both before and during assignment creation.

## Bounded code fix

### SDK hard guard: reject empty assignment contracts

Changed file: `projects/may-agent/packages/sdk/src/project-task-tree.ts`

Repair:

- added `nonEmptyTrimmedString(...)`
- `createAssignmentForTask(...)` now resolves worker using trimmed non-empty fallbacks only
- if `input.worker`, `task.owner`, and `config.worker` are all blank after trimming, assignment now throws:
  - `Task <id> cannot be assigned without a non-empty worker/owner contract`

Effect:

- no task can be activated with blank owner/worker metadata through `assignTask(...)`
- no `task_assigned` event/outbox row can be emitted with `worker:""`

### App worker fallback: blank event worker no longer overrides truthful owner

Changed file: `projects/aks-rp-e2e.app/workflows/default-task-worker.ts`

Repair:

- `buildTaskTreeConfig(...)` now trims candidate worker values
- blank trigger `worker` no longer wins over fallback sources
- for assignment-triggered wakes, it also looks up the assigned task owner from the task tree and prefers that over handler-default worker when the event worker is blank

Effect:

- `task_worker_started` attribution no longer records `worker:""` just because the event payload contained a blank worker
- worker execution stays aligned with the truthful assigned task owner when the event is malformed but the task node is still valid

## Why this fixes the Fleet-style failure

The prior Fleet bad leaf required both of these failure modes to line up:

1. blank worker could enter routing/config state
2. blank worker could still be accepted as the assignment contract

After this repair:

- the app side no longer treats blank event worker as a valid assigned worker for worker-start handling
- the SDK side refuses to activate any task when all owner/worker candidates are blank

So a focused leaf can no longer truthfully become active with:

- `owner:""`
- `trace.assigned_worker:""`
- `task_assigned worker:""`
- `task_worker_started worker:""`

## Test evidence

### SDK regression coverage

File changed: `projects/may-agent/packages/sdk/src/project-task-tree.test.ts`

Added targeted tests proving that:

1. assignment is rejected when `worker`, `owner`, and config worker are all empty
2. blank explicit worker input falls back to task owner
3. bulk runnable backlog assignment also ignores blank worker input and preserves truthful owner fallback

Verification command:

- `cd /app/projects/may-agent && bun test packages/sdk/src/project-task-tree.test.ts`
- Result: **31 pass, 0 fail**

### App worker-start regression coverage

File changed: `projects/aks-rp-e2e.app/workflows/task-worker.test.ts`

Added targeted test proving that when a `project.task.assigned` event carries `worker:""` but the active task owner is `app-ops`:

- the task worker runs the session as `app-ops`
- the journal contains `task_worker_started` with `worker:"app-ops"`
- the journal does **not** contain `worker:""`

Verification command:

- `cd /app/projects/aks-rp-e2e.app && bun test ./workflows/task-worker.test.ts`
- Result: **18 pass, 0 fail**

### Focused compact-loop regression sanity

Existing compact-loop coverage that manipulates blank-owner survivors still passes after the contract hardening.

Verification command:

- `cd /app/projects/aks-rp-e2e.app && bun test ./workflows/feature-compact-loop.test.ts --timeout 30000`
- Result: **61 pass, 0 fail**

This matters because it shows the new guard did not break valid compact-loop hygiene/reprojection behavior that may temporarily observe historical blank-owner data while repairing it.

## Remaining hygiene follow-up

No additional watchdog mutation was made in this task.

That is acceptable because the primary contract bug is now guarded at assignment time. Existing stale-active / empty-owner hygiene detection should remain as a **second-line guard** for already-persisted historical bad states or any future unexpected corruption path.

## Files changed

- `projects/may-agent/packages/sdk/src/project-task-tree.ts`
- `projects/may-agent/packages/sdk/src/project-task-tree.test.ts`
- `projects/aks-rp-e2e.app/workflows/default-task-worker.ts`
- `projects/aks-rp-e2e.app/workflows/task-worker.test.ts`

## Bottom line

The empty-worker active-leaf bug came from blank strings being accepted as real assignment metadata in both app worker routing and SDK assignment creation. The repair now:

- rejects empty owner/worker assignment contracts before activation and `task_assigned` emission
- falls back from blank event worker to truthful task ownership for worker-start handling
- proves the behavior with targeted regression tests

This closes the contract hole that allowed the Fleet verifier leaf to appear active with `owner:""` and `trace.assigned_worker:""`.
