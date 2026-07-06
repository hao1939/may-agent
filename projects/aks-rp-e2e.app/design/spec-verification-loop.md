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

The workflow is responsible for the normal repair path. Humans should not need
to patch each failing spec by hand. If the evidence shows the issue is in test
code, generated tests, runner behavior, compact planning, workflow YAML, target
environment wiring, or spec execution behavior, the worker must repair the
`aks-rp-e2e` domain repo, commit and push the change to the target branch, then
verify it with the GitHub live workflow. Changes in `aks-rp-e2e.app` can fix
orchestration, UI, recovery, metrics, and task routing only; they do not make
GitHub spec runs use new domain test code.

This is one concrete instance of the knowledge split described in
`project-knowledge-layers.md`: the loop ledger and retry/frontier policy are
project operating knowledge, while accepted spec fixes, live pass evidence, and
feature/model updates are AKS test knowledge.

The completion bar is intentionally strict: every single spec needs a live
`pass`. Catalog-level dispositions such as deprecated, product-gap, superseded,
or environment-constrained may inform the fix/escalation work, but they do not
close the spec-loop ledger.

Those dispositions also must not be confused with ordinary runnable pending
work. If the catalog says a spec is superseded or otherwise terminal, the loop
keeps it visible as pending but seeds a structured reason and resume condition.
The controller can then create or reuse repair/model/owner work instead of
rerunning the same known-bad shape. A historical `done` entry is treated as
legacy state and reopened unless it already has `pass`, but a catalog terminal
row still carries its disposition metadata when reopened.

## Core Decision

The single-spec verification workflow is the reusable experience. A task is
only needed when the app must track the work across time.

Direct human/agent use:

```text
specId + target + mode
  -> single-spec verification workflow
  -> repo-native spec command / GitHub backend
  -> structured result and artifact refs
```

App-managed loop use:

```text
project.task.assigned
  -> task workflow router
  -> task.workflow=single-spec-verifier
  -> task.context carries specId + target + tracking fields
  -> same single-spec verification workflow
  -> normalize workflow result into task state
```

The current generic task behavior becomes the default workflow. Specialized
tasks can opt into a specific workflow by setting `workflow` on the task node.

This keeps the task tree untyped:

- parent/child structure still defines breakdown and rollup;
- `workflow` only defines how a task executes;
- direct workflow input can execute the same work without creating a task;
- task context is an adapter around the same workflow input, plus tracking-only
  fields such as `loopTaskId` and `stateRef`;
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

The loop root is a durable controller task. It is not a concrete worker leaf.
The canonical way to wake it is `project.task.tick` with a concrete task target
and an explicit top-level action.

```text
project.task.tick taskId=aks-spec-verification-loop action=spec-loop
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

`project.task.assigned` remains the worker path for executable child leaves.
If a loop root is accidentally assigned, the planner may bridge that assignment
back into a controller tick as compatibility behavior, but producers should not
rely on the worker to consume durable loop roots.

No new loop-specific event family is needed. The pulse event is the generic
task-targeted form:

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

Exact waits are not passive parking. On every pulse, the controller must inspect
wait leaves that name a GitHub workflow run. If the run is still active, the wait
can remain blocked. If the run is terminal, the controller must move the wait
leaf to review with the run id, conclusion, URL, and named specs attached. Code
only collects this signal; the reviewing agent decides whether the terminal run
proves a pass, needs a domain repair/rerun, or should be replaced by a fresh
external wait with the current waiting condition. A wait must not keep saying it
is waiting for a GitHub run that already finished.

The simple operating rule is: unfinished work must have an owner. A spec that
has exhausted direct retries is not finished, but it may not be visible as a
task yet because it lives in the loop ledger. The controller must turn those
ledger records into visible grouped recovery tasks, exact waits, escalations, or
passing results. A pulse cap may limit direct verifier dispatch, but it must not
leave retry-drained feature families without any recovery owner when direct
execution is drained.

## Controller Workflow

`spec-loop-controller` is deterministic. It should:

- load `tasks/tree.json`;
- load `.state/spec-loop/state.json`;
- find the loop parent task;
- count open child leaves under the loop parent;
- create verifier child leaves until the configured direct-run window is full;
- create grouped follow-up leaves for retry-drained `pending`, `error`, and
  `fail` records when no direct verifier work can be launched; grouped
  follow-ups are compact by feature family, but all affected specs must be
  recorded in task context so ownership is durable;
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
tasks: they classify root cause, repair `aks-rp-e2e` specs/tests/runner/model
files when possible, push the domain fix, and create rerun work only after a
blocker changes or a concrete test/spec fix makes the rerun meaningful. App
evidence is an audit trail, not the fix. This keeps the task tree pushing
without exploding one task per failed spec.

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
7. Commit/push the `aks-rp-e2e` change when the fix is in domain test/spec
   code, then rerun the GitHub workflow against the pushed commit.
8. Open a PR when code/model changes need review instead of direct branch
   update.
9. Complete the leaf with links to the workflow run, result artifact, test
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

## Reusable Per-Spec Recipe

Each spec should move through the same small loop. The implementation can be
AKS-specific, but the control shape is reusable for other projects.

```text
audit spec -> generate test -> run test -> review result -> update model -> close or create exact follow-up
```

1. Audit the spec.
   - Confirm the spec file is discoverable from `features/<feature>/specs/`.
   - Confirm it names the user scenario, product inputs, expected behavior,
     assertions, scenario test, and feature path ids.
   - Confirm the scenario test is standalone: it can create and clean up its own
     resources for the target environment.
   - Run live-admission and private-source policy checks before any cloud run.

2. Generate the test.
   - Use the normal documented command path, for example
     `bun run spec <spec-id> --dry-run` for local validation or
     `bun run spec <spec-id>` for live verification.
   - The generated Vitest file is temporary execution material. The durable
     source remains the spec, scenario test, target profile, and result.
   - Generation must write the fixed target into the run/plan. Execution should
     not guess subscription, region, API version, or identity from ambient local
     state.

3. Run the test and repair issues.
   - Dry-run proves discovery, target wiring, generated Vitest structure, and
     scenario-test wiring without Azure resource changes.
   - Live run is the verification bar. It must create real resources when the
     spec requires them and must clean them after the run.
   - Classify non-pass results by the thing that needs work: spec/model gap,
     scenario-test bug, runner bug, environment capacity/auth issue, or product
     behavior mismatch.
   - Small local runner/test fixes are applied in `aks-rp-e2e`, committed,
     pushed, and verified by GitHub. A local check or app memo is not enough.
   - Ambiguous product or model decisions become explicit follow-up tasks with
     the run link, result path, waiting condition, and fallback.

4. Update or correct the model.
   - Run `bun run model-update <run-dir>` after result review.
   - The updater must consume the current executor result shape:
     `result.json.specResults[]`, structured artifact refs, and the catalog
     feature path mapping.
   - The accepted model is changed only when the result and model-impact policy
     allow it. Otherwise the updater writes a proposal for review.

5. Close the spec.
   - A spec-loop ledger row closes only on a live `pass` with durable result
     evidence and any needed accepted model update or reviewed no-op proposal.
   - Dry-run pass, product-gap classification, environment issue, or retry
     exhaustion does not close the ledger by itself.
   - If it cannot close, the loop must create visible owned work: a repair task,
     exact wait, escalation, or PR. No non-pass spec should remain only as a
     hidden ledger entry.

Reusable parts:

- queue/frontier control: bounded dispatch, retry budget, exact wait ownership,
  and progress counters;
- per-item worker shape: audit, execute, collect artifacts, classify, update
  model proposal, close/follow-up;
- result contract: structured run id, item id, status, reason, artifact refs,
  and model-impact recommendation;
- closure rule: only close when the project-specific pass bar is met.

AKS-specific parts:

- spec schema and feature folder layout;
- Azure target profiles, ARM auth, quota/capacity checks, and cleanup policy;
- scenario-test libraries and AKS product assertions;
- knowledge-map update logic and AKS feature path ids.

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
