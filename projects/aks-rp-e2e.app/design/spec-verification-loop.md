# Spec Verification Loop Proposal

Status: implemented baseline

## Goal

Drive every AKS RP E2E spec through a repeatable loop:

```text
select specs -> run live test backend -> result review -> fix/model proposal -> rerun until live pass
```

The loop should keep working without asking the LLM planner to repeatedly pick
the next spec. The task tree remains the visible control plane, while a small
deterministic workflow keeps a bounded set of spec leaves moving.

The completion bar is intentionally strict: every single spec needs a live
`pass`. Catalog-level dispositions such as deprecated, product-gap, or
environment-constrained may inform the fix/escalation work, but they do not
close the spec-loop ledger. A historical `done` entry is treated as legacy
state and reopened for live verification unless it already has `pass`.

## Core Decision

Every assigned task should run through a workflow.

```text
project.task.assigned
  -> task workflow router
  -> task.workflow ?? default-task-worker
  -> normalize workflow result into task state
```

The current generic task behavior becomes the default workflow. Specialized
tasks can opt into a specific workflow by setting `workflow` on the task node.

This keeps the task tree untyped:

- parent/child structure still defines breakdown and rollup;
- `workflow` only defines how a task executes;
- no task `kind` is required for loop routing;
- no loop-specific event family is required.

## Task Shape

One normal workflow-bound task controls the loop. It is not a special task type;
it uses the same task lifecycle as any other task. The important distinction is
that a controller pulse is progress, not task completion.

```text
aks-spec-verification-loop
  -> verify spec A
  -> verify spec B
  -> verify spec C
```

The loop task uses a controller workflow:

```json
{
  "id": "aks-spec-verification-loop",
  "workflow": "spec-loop-controller",
  "context": {
    "windowSize": 5,
    "stateRef": ".state/spec-loop/state.json",
    "githubWorkflow": "run-single-spec.yaml",
    "target": "staging",
    "branch": "dev",
    "maxOpenPrs": 3,
    "maxConsecutiveInfraFailures": 3,
    "workflowProgress": {
      "completionReady": false,
      "executionDrained": false,
      "reason": "spec-loop state still has non-terminal specs",
      "pending": 655,
      "running": 0
    }
  }
}
```

Each child leaf verifies one spec:

```json
{
  "id": "verify-spec-managedsystem-rest-add-existing",
  "parent_id": "aks-spec-verification-loop",
  "workflow": "single-spec-verifier",
  "goal": "Run and review spec.managedsystem.rest-add-existing.minimal-rest through the single-spec workflow.",
  "context": {
    "specId": "spec.managedsystem.rest-add-existing.minimal-rest",
    "githubWorkflow": "run-single-spec.yaml",
    "target": "staging",
    "branch": "dev",
    "stateRef": ".state/spec-loop/state.json"
  },
  "acceptance": [
    "Configured test backend completed or produced a concrete blocker.",
    "result.json and summary artifacts were reviewed when available.",
    "Spec status was classified as pass, fail, or error.",
    "Test result/model update or fix PR was proposed when needed.",
    "Spec-loop state was updated."
  ]
}
```

## Event Flow

The loop uses the existing task event path.

```text
project.task.assigned taskId=aks-spec-verification-loop
  -> task workflow router
  -> spec-loop-controller pulse
  -> create/fill 3-5 child spec leaves
  -> emit project.task.assigned for runnable child leaves
  -> update task.context.workflowProgress
  -> leave aks-spec-verification-loop backlog/continuing

project.task.assigned taskId=verify-spec-A
  -> task workflow router
  -> single-spec-verifier
  -> trigger run-single-spec workflow
  -> review artifacts
  -> emit normalized project.task.completed

project.task.completed taskId=verify-spec-A
  -> owner/problem path for review when needed
  -> loop task can be pulsed again to refill the window
```

No new loop-specific event family is needed. The preferred pulse event is the
generic task-targeted form:

```json
{
  "type": "project.task.tick",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "aks-spec-verification-loop"
  },
  "action": "spec-loop",
  "data": {
    "reason": "manual-pulse"
  }
}
```

Loop pulses use `project.task.tick` with a concrete task target and an explicit
top-level `action` discriminator such as `spec-loop`. Routing starts at that
task, falls back to the loop/parent task when available, and finally reaches the
project owner.

## Workflow Result Contract

All task workflows should return one normalized task result shape:

```json
{
  "taskStatus": "done | partial | blocked | continuing",
  "summary": "short operator-facing result",
  "evidence": ["path-or-url"],
  "events": []
}
```

Router behavior:

```text
done/partial/blocked -> complete the task using existing task completion flow
continuing           -> record journal/output, leave the task open
```

The `continuing` result is important for workflow-bound controller tasks. A
controller pulse is not completion of the task. The task becomes done only when
its acceptance is satisfied or the owner explicitly replaces/cancels it.

Because workflow-bound tasks are still normal tasks, completion protection is
expressed through generic task context, not a special task kind:

```json
{
  "context": {
    "workflowProgress": {
      "completionReady": false,
      "reason": "spec-loop state still has non-terminal specs",
      "pending": 651,
      "running": 0,
      "error": 3,
      "updatedAt": "2026-06-26T00:00:00Z"
    }
  }
}
```

Task review tooling must refuse normal `mark-done` while
`workflowProgress.completionReady` is `false`. Rollup may archive completed
child leaves, but it must not infer parent completion from an empty child list.

`executionDrained` is different from `completionReady`. A loop is execution
drained when there are no running specs and no pending specs that can still be
sent directly to the single-spec workflow. It is completion-ready only when
every spec is `pass`; stranded `pending`, `fail`, `error`, `pr_open`, and legacy
`done` all keep the loop incomplete. Drained non-pass or stranded-pending
results are backlog pressure, not project completion.

Blocked wait leaves narrow the affected scope, but they do not suppress
unrelated ledger pressure. The controller must publish
`unrepresentedNonTerminalCount`; while it is greater than zero the loop root is
actionable backlog and watchdog/stall review should keep pushing it. Exact wait
stewardship is allowed only when every non-pass or pending spec is represented
by a live verifier child, grouped repair/escalation child, exact wait, or
accepted terminal owner disposition. Retry-drained or direct-run-ineligible
pending records must create grouped follow-up work; they must not be hidden by a
`stranded` or retry-budget-exhausted flag.

## Controller Workflow

`spec-loop-controller` is deterministic. It should:

- load `tasks/tree.json`;
- load `.state/spec-loop/state.json`;
- find the loop parent task;
- count open child leaves under the loop parent;
- create verifier child leaves until the configured direct-run window is full;
- create grouped follow-up leaves for retry-drained `pending`, `error`, and
  `fail` records when no direct verifier work can be launched;
- assign runnable child leaves;
- update compact loop counters;
- pause on circuit breakers;
- wake the owner only for judgment or policy decisions.
- update `task.context.workflowProgress` after each pulse.

It should not decide product truth or rewrite the knowledge model.

When the spec queue is drained and non-pass results remain, the controller
materializes grouped follow-up leaves under the same loop task. The grouping key
is `status + feature family`, for example `error/aad-rbac` or
`error/app-routing`. These follow-up leaves are repo-local reconciliation
tasks: they classify root cause, repair specs/model/evidence when possible, and
create rerun work only after a blocker changes or a concrete test/spec fix makes
the rerun meaningful. This keeps the task tree pushing without exploding one
task per failed spec.

## Single Spec Verifier Workflow

`single-spec-verifier` owns one spec leaf. It should:

1. Dispatch the configured test backend for the task's `specId`; the initial
   backend is GitHub `run-single-spec.yaml`, but the same leaf shape can route
   to local/generated Vitest plan execution.
2. Watch or poll the workflow run.
3. Download artifacts.
4. Parse the project `result.json`.
5. Classify the result:
   - `pass`: evidence/model update candidate.
   - `fail`: product mismatch only if the modeled assertion was reached;
     otherwise test/spec/scenario fix work.
   - `error`: workflow, runner, scenario-test, helper defect, or any external,
     environment, product, or source issue that prevents a live pass.
6. Apply a bounded local fix or model proposal when safe.
7. Open a PR when code/model changes are ready.
8. Complete the leaf with links to the workflow run, result artifact, test
   result notes, and PR when present.

`lastRunUrl` is the durable GitHub Actions workflow link and should be present
for every dispatched attempt. `lastResultPath` is the downloaded local result
artifact path. Do not collapse these into one field: when a test fails before
artifact upload, the workflow URL is still the operator's primary drill-down
reference.

Every single-spec run must be standalone. A spec that needs a caller-provided
existing cluster, shared-cluster carrier, mounted AKS RP source checkout, or
Azure CLI login state is not ready for the spec loop; that is a test repair
item. The single-spec workflow supplies the fixed target environment, and the
test must create and clean up its own AKS cluster through ARM REST helpers.

Live test code should use `ARM_ACCESS_TOKEN`, GitHub OIDC, or managed identity
with ARM REST. It must not shell out to `az`, use `azure/login`, depend on
Azure CLI account state, or read private AKS RP source code.

## State File

The task tree is the visible frontier. The full spec ledger belongs in app
state:

```text
projects/aks-rp-e2e.app/.state/spec-loop/state.json
```

Minimal shape:

```json
{
  "loopTaskId": "aks-spec-verification-loop",
  "windowSize": 5,
  "cursor": 0,
  "specs": {
    "spec.foo": {
      "status": "pending",
      "attempts": 0,
      "lastRunId": null,
      "lastRunUrl": null,
      "lastResultPath": null,
      "lastPrUrl": null,
      "updatedAt": "2026-06-26T00:00:00Z"
    }
  }
}
```

The state file is operational memory. Accepted product knowledge still lives in
the domain repo knowledge model.

## Operator Commands

```bash
bun run spec-loop status
bun run spec-loop seed
```

These commands are development helpers, not the normal control plane. Normal
operation should be visible through `tasks/tree.json`, the task frontier, and
`task.context.workflowProgress`. Use the `pulse-spec-loop` app action to wake
the controller. The default target task id is `aks-spec-verification-loop`.

## Breakdown And Rollup

Breakdown and rollup continue to work normally because the tree structure does
not change.

- The loop parent breaks down into a bounded set of child spec leaves.
- Child leaves normally do not decompose themselves.
- If a leaf exposes deeper work, it completes with the exact repair or
  escalation path; the owner/planner can create repair or model-update child
  tasks.
- Completed child leaves can be compacted and archived by the existing task
  rollup path.
- The loop parent stores summary counts in `context.workflowProgress` and
  remains open until final loop closure.
- An empty child list means the current window is empty; it does not mean the
  loop task is complete.

## Planner Role

The LLM planner is not in the normal queue path.

Use the planner/owner only for:

- repeated infrastructure failures;
- ambiguous product mismatch;
- shared auth, quota, capacity, or cleanup blocker;
- changing loop policy;
- too many open PRs;
- task tree inconsistency;
- final completion review.

## Implementation Steps

1. Done: add task workflow routing with `task.workflow ?? default-task-worker`.
2. Done: extract current generic `task-worker` behavior into
   `default-task-worker`.
3. Done: add `spec-loop-controller`.
4. Done: add `.state/spec-loop/state.json` store helpers.
5. Done: add `single-spec-verifier`.
6. Done: dispatch GitHub workflow, poll by a unique `loop_key`, download
   artifacts, and parse `result.json`.
7. Done: add `bun run spec-loop status|seed`.
8. Done: add tests for workflow routing, bounded refill, dev-infra-core
   priority, and backlog-child reassignment.
9. Done: publish `workflowProgress` so normal task review cannot mark the loop
   done while specs remain pending/running.
10. Remaining: add circuit breakers.
11. Remaining: add bounded fix/model-update PR creation after result review.

## Open Questions

- Should pass-only model evidence updates be batched by feature family instead
  of creating one PR per spec?
- What is the first safe window size for live GitHub workflow execution: 1, 3,
  or 5?
- Should `single-spec-verifier` create fixes directly, or should it create a
  follow-up repair task when the change is larger than a small bounded patch?
