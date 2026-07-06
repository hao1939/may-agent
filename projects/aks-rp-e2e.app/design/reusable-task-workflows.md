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
  -> workflow updates scoped artifacts or state
  -> workflow emits project.task.completed with structured fields
  -> task-reviewer judges the completion
  -> planner applies accept/retry/follow-up/escalation
```

The direct human/agent shape is:

```text
human instruction with structured input
  -> workflow file under workflows/
  -> domain command, GitHub run, or scoped artifact update
  -> structured workflowResult and concise human summary
```

There is no separate workflow category. Controllers, collectors, verifiers,
planners, and future authoring workflows are all reusable workflows. Some are
usually called through tasks; some can also be called directly by an agent.

## Knowledge Boundary

Workflows are the bridge between operating work and AKS test knowledge:

```text
task context or direct instruction input
  -> workflow under workflows/
  -> domain command, GitHub run, or scoped artifact update
  -> structured workflowResult
  -> reviewer/planner decision when the app is tracking the work
```

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
  "summary": "Feature compact package done for localdns; live GitHub workflow passed.",
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
dispatches and reviews the configured GitHub single-spec workflow, then updates
the spec-loop ledger and emits task completion.

`feature-compact-planner`

Generates one feature compact plan, runs generated tests, dispatches live GitHub
proof when ready, and reports compact artifacts, proof status, and blocker
categories through `workflowResult`.

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

The same workflow should work when assigned by a loop, by the planner, or by a
direct human instruction:

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
