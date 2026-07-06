# Reusable Task Workflows

Status: accepted design direction

## Purpose

Long-running loops and manual tasks repeat the same project work:

```text
feature -> collect official doc/API behavior references
spec    -> create or repair executable scenario tests
feature -> create, check, and live-prove compact test plans
```

These should all use normal task workflows. A loop decides which item needs work
next; the assigned workflow owns how that work is done, what artifacts it
writes, and what structured result it reports.

This document covers the project-operating workflow mechanism. The durable AKS
test knowledge produced by those workflows still belongs in the portable domain
workspace. The boundary is described in `project-knowledge-layers.md`.

The target shape is:

```text
loop/manual/planner task
  -> task.workflow=<workflow file under workflows/>
  -> workflow updates scoped artifacts or state
  -> workflow emits project.task.completed with structured fields
  -> task-reviewer judges the completion
  -> planner applies accept/retry/follow-up/escalation
```

There is no separate workflow category. Controllers, collectors, verifiers,
planners, and future authoring workflows are all task workflows.

## Knowledge Boundary

Task workflows are the bridge between operating work and AKS test knowledge:

```text
task context
  -> workflow under workflows/
  -> domain command, GitHub run, or scoped artifact update
  -> structured workflowResult
  -> reviewer/planner decision
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

3. The assigned task carries the input.

   Required inputs should come from `task.context`, task id conventions, or the
   triggering event. A workflow should fail with a structured problem when its
   required input is missing.

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

## Current Workflow Inventory

`feature-reference-collector`

Collects official Microsoft Learn and Azure REST API spec references for one
feature packet. It should emit `workflowResult` with the feature subject,
reference draft artifact, quality checks, and a problem when references are
missing or incomplete.

`single-spec-verifier`

Dispatches and reviews one GitHub live run for a single spec. It should keep
reporting run ids, artifact refs, spec status, and live-pass evidence in
structured completion fields.

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

## Manual Usage

The same workflow should work when assigned by a loop, by the planner, or by a
manual task:

```text
collect references for localdns
verify spec.localdns.cluster-topology
build compact package for workload-identity
```

Manual tasks should still provide normal `task.context` inputs and should still
complete through `project.task.completed`.

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

Task workflows may edit scoped domain artifacts, but they do not accept their
own work:

```text
task workflow -> project.task.completed -> task-reviewer -> planner
```

The reviewer checks whether the completion satisfies the task acceptance
criteria. The planner remains the task-tree mutation owner: it accepts the
result, asks for rework, creates follow-up tasks, or records an exact wait.

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
manual targeted task
loop-generated child task
planner-generated repair task
```

The repeated human/agent work should shrink to reviewing structured outputs and
scoped diffs, not rediscovering how to collect references, verify specs, or
build compact packages for every feature.
