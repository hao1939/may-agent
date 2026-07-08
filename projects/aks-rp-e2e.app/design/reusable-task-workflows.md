# Reusable Workflows

Status: accepted design direction

## Purpose

Long-running loops and direct human requests repeat the same project work:

```text
feature -> collect official doc/API behavior references
spec    -> create or repair executable scenario tests
feature -> create, check, and live-prove compact test plans
```

These should all use the same workflow experience. A workflow owns how that
work is done, what artifacts it writes, and what structured result it reports.
A task is only the app's tracking wrapper when work needs ownership, retry,
UI visibility, blocked-state handling, or later recovery.

This document covers the project-operating workflow mechanism. The durable AKS
test knowledge produced by those workflows still belongs in the portable domain
workspace. The boundary is described in `project-knowledge-layers.md`.

The app-managed target shape is:

```text
loop/planner task
  -> task.workflow=<workflow file under workflows/>
  -> task context carries the same workflow input plus tracking fields
  -> project.task.assigned dispatches the runnable task
  -> task-worker adapter builds business workflow input
  -> business workflow updates scoped artifacts or state
  -> task-worker adapter emits project.task.completed with structured fields
  -> task-reviewer judges the completion
  -> planner applies accept/retry/follow-up/escalation
```

The direct human/agent shape is:

```text
human instruction with structured input
  -> workflow file under workflows/
  -> domain command, Azure DevOps pipeline run, or scoped artifact update
  -> structured workflowResult and concise human summary
```

There is no separate workflow category. Controllers, collectors, verifiers,
planners, and future authoring workflows are all reusable workflows. Some are
usually called through tasks; some can also be called directly by an agent.
Whether a workflow-backed task is domain work or system ops work is a naming
and scope convention, not a workflow type:

```text
domain/spec/...    -> use workflows that verify or repair AKS specs
domain/feature/... -> use workflows that collect AKS feature references
domain/compact/... -> use workflows that generate and prove compact tests
ops/...            -> use workflows that observe, diagnose, recover, or
                      escalate project process issues
```

If that distinction is not clear from the task branch or id, fix the branch/id.
Do not add another workflow category or task classification field.

The same workflow can be used by a human/agent directly or by the app through a
task. Agent ownership comes from the task scope, not from the workflow file:

```text
aks-explorer + domain/* task -> run AKS/spec/test workflow
app-ops + ops/* task         -> run observability/recovery/stall workflow
app-ops + project-planner    -> decide and apply the next task-tree move
aks-reviewer                 -> review completed task output, read-only
direct human request         -> run the same workflow with structured input
```

Keep one task tree. `aks-explorer` and `app-ops` focus on different roots, but
the planner coordinates both so dependencies are visible.

## Adapter Boundary

The task tree is a tracking and relationship model, not the business API for
every workflow. For normal business workflows:

```text
task tree task -> task adapter -> workflow input
workflow result -> task adapter/reviewer/planner -> task-tree update
```

The workflow should know the business part: collect references, verify one
spec, generate a compact plan, diagnose one bounded problem, or update a scoped
artifact. It should not normally know parent rollup, assignment queues, review
state, or task-tree storage.

Orchestration workflows are the exception because their business purpose is the
project process. `project-planner`, `task-worker`, loop controllers, watchdog,
review, and stall-review adapters may read task or loop state through shared
helpers, but they should still keep mutations narrow and structured.

## Knowledge Boundary

Workflows are the bridge between operating work and AKS test knowledge:

```text
task context or direct instruction input
  -> workflow under workflows/
  -> domain command, Azure DevOps pipeline run, or scoped artifact update
  -> structured workflowResult
  -> reviewer/planner decision when the app is tracking the work
```

When the app tracks work, task execution is event-driven:

```text
task tree backlog leaf
  -> project.task.assigned
  -> task-worker
  -> scoped workflow or default worker
  -> project.task.completed
```

Use "assigned" as the event name, but read it as "dispatched". The task tree is
durable work state; `project.task.assigned` is the event that starts the work.

The workflow may know how to generate a spec, collect references, verify a
single live test, or build a compact plan. It should not become the durable
place where accepted feature truth, spec definitions, or compact packages live.
Those artifacts belong in `../aks-rp-e2e`. The app keeps the task state, loop
ledger, review result, and next operating move.

## Core Rules

1. The `workflows/` folder is the source of truth.

   A task `workflow` value must refer to `workflows/<name>.ts`, except for
   explicitly allowed domain workflows such as `spec-runner`.

2. A workflow declares its input and output when downstream automation needs it.

   The declaration lives in the workflow file as `workflowContract`. There is no
   registry file and no category-specific contract marker.

3. Direct input and task context carry the same workflow input.

   Required inputs should come from direct structured input or the task
   adapter's context. A task may add tracking-only fields such as `loopTaskId`,
   `stateRef`, attempt ids, or review/ownership metadata. These fields must not
   change the meaning of the underlying work. A workflow should fail with a
   structured problem when its required work input is missing.

4. Every task completion is structured.

   `project.task.completed` already carries common fields: `result`, `summary`,
   `evidenceRefs`, `review`, and `problem`. Workflows that have domain-specific
   output should also include `workflowResult`.

5. Prose is review material, not routing protocol.

   Code collects facts and artifacts. The reviewer and planner judge those
   facts. Routing decisions must use structured fields, not special phrases in
   summaries.

## Extending The App

Do not require perfect reuse at the first attempt. Let useful one-off work
graduate into reusable shape when repetition proves the value:

```text
one-off fix
  -> repeated task pattern
  -> reusable workflow
  -> app route or event only when the control plane needs it
```

### 1. One-Off Fix

Use direct agent work or a normal task when the problem shape is still unknown.
This is appropriate for quick repair, exploratory diagnosis, or trying a new
approach. The only requirement is that the result is not hidden in prose:
leave a structured completion, concrete artifact, code change, exact blocker,
or escalation that the planner/reviewer can understand.

### 2. Repeated Task Pattern

When the same kind of work appears again, keep it as a task convention before
creating a workflow. Reuse task scope, `workflow`, and `context` fields instead
of adding new task kinds:

```json
{
  "workflow": "default-task-worker",
  "context": {
    "kind": "ado-artifact-diagnosis",
    "runId": "123",
    "featureKey": "localdns"
  }
}
```

If the repeated work can still be handled by the default worker with clear
acceptance criteria, do not promote it yet.

### 3. Reusable Workflow

Promote the pattern to `workflows/<name>.ts` when the steps are stable enough
to repeat. The workflow should be runnable both directly and through a task:

```ts
export const name = "ado-artifact-diagnoser";
export const description = "Diagnose one Azure DevOps run artifact gap.";

export const workflowContract = {
  workflow: "ado-artifact-diagnoser",
  input: {
    required: ["runId"],
    optional: ["featureKey", "specId"],
  },
  output: {
    fields: ["status", "summary", "artifacts", "problem", "nextActions"],
  },
};
```

A task can use the workflow immediately:

```json
{
  "workflow": "ado-artifact-diagnoser",
  "context": {
    "runId": "123",
    "featureKey": "localdns"
  }
}
```

No `app.ts` change should be needed for ordinary task execution because the
standard path already exists:

```text
project.task.assigned -> task-worker -> task.workflow
```

### 4. App Route Or Event

Edit `app.ts` only when an event, schedule, metric, external input, or UI
action must trigger the workflow directly. Prefer existing events first:

```text
project.task.assigned
project.task.completed
project.task.reviewed
project.planning.requested
project.task.tick
project.problem.investigation.requested
project.watchdog.check.requested
project.stall.review.requested
message.created
```

Add a new event only when using an existing event would hide a durable command
or fact. Put variants in `target`, top-level `action`, `data.reason`,
`data.mode`, or `data.params` before adding new event names.

### Seamless Developer Path

Normal extension should not require container restart:

```text
add or edit workflows/foo.ts
create/assign task with workflow=foo
task-worker loads and runs it
```

Manifest changes are the exception:

```text
edit app.ts for a new schedule/action/event route
project app watcher reloads the manifest
new route becomes active
```

If reload is not seamless, that is an app/runtime issue to fix. Restarting the
container should not be part of the normal workflow-authoring loop.

## Workflow Result

Use the SDK `workflowResult(...)` helper from `@may-agent/sdk` for structured
results that need to be read by loops, reviewers, watchdogs, or planners. The
SDK only adds a stable `resultVersion` and a few empty convenience collections.
Each workflow owns the shape of its own structured input and output.

Example:

```json
{
  "resultVersion": "workflow-result-v1",
  "workflow": "feature-compact-planner",
  "workflowVersion": "feature-compact-planner-v1",
  "subject": {
    "kind": "compact",
    "id": "localdns",
    "capabilityId": "localdns"
  },
  "status": "done",
  "summary": "Feature compact package done for localdns; live Azure DevOps pipeline passed.",
  "artifacts": [
    "features/localdns/compact/staging.plan.json",
    "features/localdns/compact/staging.diagnostics.json",
    "runs/test-results/example/result.json"
  ],
  "checks": [
    {
      "name": "live-aks-proof",
      "status": "pass"
    }
  ],
  "metrics": {
    "clustersNeeded": 2,
    "clustersSaved": 14
  },
  "problem": null,
  "nextActions": [],
  "inputFingerprint": {
    "featureKey": "localdns",
    "target": "staging"
  }
}
```

Common fields such as `workflow`, `subject`, `status`, `summary`, `artifacts`,
`checks`, `metrics`, `problem`, `inputFingerprint`, and `details` are
conventions, not SDK-enforced schema. Use stable values only where downstream
automation actually reads them.

## Workflow Contract

When a workflow needs machine-readable input/output documentation, export a
simple contract next to the workflow implementation:

```ts
export const workflowContract = {
  workflow: "feature-reference-collector",
  version: "feature-reference-collector-v1",
  input: {
    required: ["task.context.featureKey", "task.context.packetPath"],
    optional: ["task.context.capabilityId", "task.context.stateRef"],
  },
  output: {
    version: "workflow-result-v1",
    fields: ["subject", "status", "artifacts", "checks", "problem"],
  },
};
```

This is documentation and a local affordance for tests or integrity checks. The
`input` and `output` objects may be as simple or detailed as the workflow needs;
there is no central schema registry and no new workflow type.

## Task Adapter

When the app uses a workflow through a task, the task is an adapter around the
same workflow input:

```json
{
  "workflow": "single-spec-verifier",
  "context": {
    "specId": "spec.localdns.cluster-topology",
    "target": "staging",
    "mode": "live",
    "loopTaskId": "aks-spec-verification-loop",
    "stateRef": ".state/spec-loop/state.json"
  }
}
```

`specId`, `target`, and `mode` are work input. `loopTaskId` and `stateRef` are
tracking input for the app-managed adapter. Direct human/agent use supplies the
work input without the tracking fields. The workflow should keep the business
logic in one place and let the adapter handle task completion, loop ledger
updates, retries, blocked-state recording, and review routing.

## Current Workflow Inventory

`feature-reference-collector`

Collects official Microsoft Learn and Azure REST API spec references for one
feature packet. It should emit `workflowResult` with the feature subject,
reference draft artifact, quality checks, and a problem when references are
missing or incomplete.

`single-spec-verifier`

Verifies one spec and classifies the result. Direct use runs the repo-native
`bun run spec <spec-id>` path and returns a structured result. Task-backed use
dispatches and reviews the configured pipeline single-spec workflow, then updates
the spec-loop ledger and emits task completion.

`feature-compact-planner`

Generates one feature compact plan, runs generated tests, dispatches live
Azure DevOps proof when ready, and reports compact artifacts, proof status, and
blocker categories through `workflowResult`.

Compact loop runtime data belongs in `.state/feature-compact-loop/state.json`
or ignored run artifacts. `features/<capability>/compact/*.summary.md` is
generated package state, not a task journal. Workers must not append refresh,
no-decision, progress, local result path, or per-task evidence notes to compact
summaries. Update feature-owned compact artifacts only for material reusable
package/spec changes.

Future task workflows can be added when there is a real reusable operation. Do
not add wrappers just to rename an existing workflow.

## Loop Usage

Loops should schedule the existing task workflow that owns the work:

```text
feature-reference loop
  -> feature-reference-collector tasks

spec loop
  -> single-spec-verifier tasks for live verification
  -> bounded repair tasks when a spec/test cannot be verified

feature-compact loop
  -> feature-compact-planner tasks
  -> bounded repair tasks for carrier/spec/plan gaps
```

The loop state remains a ledger of item status, attempts, latest proof, and
latest problem. The workflow result updates that ledger. The loop should not
duplicate reference collection, verification, or compact planning logic.

Retry budgets are a churn guard, not a terminal verdict. When a grouped repair
or follow-up fixes a shared issue, it must report the retry reopening through
structured task data instead of prose. For feature compact repair leaves, use:

```json
{
  "compactRetryReset": {
    "errorClass": "package-partial",
    "featureKeys": ["airlock"],
    "reason": "shared compact package generator now produces a ready plan"
  }
}
```

`errorClass` reopens matching exhausted compact errors; `featureKeys` reopens
exact features. A controller applies the reset only when the completed repair
task is newer than the feature's current error record, then resets attempts and
lets normal loop scheduling create the next proof attempt.

## Direct Human/Agent Usage

The same workflow should work when dispatched by a loop, dispatched by the
planner, or called by a direct human instruction:

```text
collect references for localdns
verify spec.localdns.cluster-topology
build compact package for workload-identity
```

Direct usage should provide the same essential input, but it should not require
a task when the work can be completed now:

```text
workflow: single-spec-verifier
specId: spec.localdns.cluster-topology
target: staging
mode: live
```

The workflow returns the same kind of structured result and artifact refs. The
agent reports that result to the human. If the direct run cannot finish and the
project must remember it, then the agent or app may create a task with the same
workflow input. The task is for tracking unfinished work, not for making the
workflow executable.

## Idempotency

When repeat work is expensive or risky, include `inputFingerprint` in
`workflowResult`:

```json
{
  "inputFingerprint": {
    "workflowVersion": "feature-compact-planner-v1",
    "featureKey": "localdns",
    "target": "staging",
    "planInputHash": "<hash>"
  }
}
```

If the same fingerprint already produced a known partial result or blocker, the
next run should not blindly repeat the same work. It should either no-op, retry
because the task explicitly asked for a new strategy, or run because inputs
changed.

## Review And Ownership

Workflows may edit scoped domain artifacts, but app-tracked workflow results do
not accept their own work:

```text
task workflow -> project.task.completed -> task-reviewer -> planner
```

For task-backed work, the reviewer checks whether the completion satisfies the
task acceptance criteria. The planner remains the task-tree mutation owner: it
accepts the result, asks for rework, creates follow-up tasks, or records an
exact wait. For direct human/agent work, the agent gives the human the
structured result and only creates a task when follow-up tracking is needed.

## Integrity

Integrity checks should stay lightweight:

- every task `workflow` value points to a real `workflows/<name>.ts` file or an
  explicitly allowed domain workflow;
- durable loop tasks remain in the task tree while their loop ledger has pending
  or running items;
- loop-created repair leaves should gain concrete `workflow` values over time;
- legacy generic repair leaves are migration debt and should be burned down, not
  normalized into a second workflow system.

## Success Criteria

The design is working when the same workflow can be reused in all three places:

```text
direct human/agent instruction
loop-generated child task
planner-generated repair task
```

The repeated human/agent work should shrink to reviewing structured outputs and
scoped diffs, not rediscovering how to collect references, verify specs, or
build compact packages for every feature.
