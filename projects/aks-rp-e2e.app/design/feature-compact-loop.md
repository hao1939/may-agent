# Feature Compact Loop

Status: implemented baseline

## Purpose

`aks-feature-compact-loop` is a normal workflow-bound task that iterates over
AKS feature packets and creates compact live test packages for each feature.
The loop exists to reduce live validation cost without weakening the pass bar:
for a feature, the generated compact plan should cover the feature-owned specs,
reuse clusters when the specs can safely share state, and then prove the plan
with a real Azure DevOps live run.

The loop is domain work. It changes AKS test knowledge, generated compact
plans, diagnostics, and live result understanding. It may reveal ops problems,
such as broken pipeline dispatch or missing artifacts, but those should become
linked `ops/*` repair work rather than being hidden inside feature status text.

## Workflows

The task tree stays the control plane.

- Parent task workflow: `feature-compact-loop-controller`
- Child task workflow: `feature-compact-planner`
- Default parent task id: `aks-feature-compact-loop`
- State file: `.state/feature-compact-loop/state.json`

The controller follows the same small loop as the other durable loops:

```text
read ledger -> reconcile children -> fill bounded frontier
```

It should:

- load the live task tree through the SDK runtime path;
- load `.state/feature-compact-loop/state.json`;
- reconcile active, review, done, blocked, and error child tasks;
- create one `feature-compact-planner` child per feature when capacity allows;
- dispatch runnable child leaves with `project.task.assigned`;
- keep `task.context.workflowProgress` current;
- represent every non-terminal feature by child work, exact wait, escalation,
  or accepted terminal disposition.

The controller should not decide AKS product truth and should not mark the loop
done while any feature still lacks a passing live compact proof.

## Planner Workflow

`feature-compact-planner` owns one feature. It should:

1. Read the feature packet and feature-owned specs.
2. Generate a compact plan and diagnostics for the configured target.
3. Check that selected specs are live-admissible and do not depend on private
   AKS RP source, Azure CLI login state, or caller-created clusters.
4. Run local generated-test checks.
5. Dispatch the Azure DevOps live pipeline when the package is ready.
6. Collect the pipeline run id, result artifact, and top-level `result.json`.
7. Reject false passes, including check-only results that did not create real
   Azure resources when the plan requires them.
8. Close the feature only on live pass with real run/artifact proof.

Generated compact artifacts live in the domain repo, for example:

```text
features/<capability>/compact/<target>.plan.json
features/<capability>/compact/<target>.diagnostics.json
features/<capability>/compact/<target>.summary.md
```

Runtime state, task refresh notes, retry state, and blocked waits belong in
`.state/feature-compact-loop/state.json` or ignored run artifacts. Do not append
runtime journal text to feature compact summaries.

## Compact Rule

Compaction should be brave but explicit.

Default assumption:

```text
Specs from the same feature may share a cluster when their resource/state DAGs
do not conflict.
```

The planner should treat incidental names, such as resource group or cluster
name, as runtime values. They should not prevent sharing. A concrete name is
generated only when the test runs.

A spec blocks sharing only when its required state, destructive action,
network shape, OS/arch requirement, identity mode, or other scoped expectation
conflicts with another selected spec. When sharing is blocked, diagnostics
should name the exact conflict so the feature can be repaired or split into a
small number of clusters.

The operator-facing metric is simple:

```text
baseline clusters - compact clusters = clusters saved
```

For most features the target should be one or two clusters. More clusters are
allowed only when diagnostics show real conflicts.

## Result Contract

Each feature record settles as:

- `done`: generated compact package passed a real Azure DevOps live proof.
- `pending`: feature has not yet been attempted.
- `running`: a planner child or pipeline run is active.
- `blocked`: an exact external wait is recorded with wait, owner, observer, and
  fallback.
- `error`: repair or diagnosis is needed before the feature can pass.

`blocked` is only valid when the shared blocked contract is satisfied. A compact
feature waiting on a pipeline result must name the exact Azure DevOps run id. If
the run id is unknown, the feature is waiting for dispatch repair or run
discovery, not for pipeline completion.

## Completion Bar

The loop is not complete until every feature has a passing live compact proof or
an accepted terminal disposition that is represented by visible owned work.

Local checks, generated plans, dry-run success, capacity waits, retry-budget
exhaustion, missing specs, or incomplete package status do not complete a
feature by themselves. They must become one of:

- a domain repair task;
- an exact blocked wait;
- an ops repair task linked to the feature;
- an escalation;
- a passing live result.

## Relationship To Other Loops

- The spec loop proves individual specs.
- The feature-reference loop improves official feature understanding.
- The compact loop uses that knowledge to create cheaper feature-level live
  proof.

When a compact plan fails because one selected spec is broken, the compact loop
may link to the single-spec verifier to isolate the failure. When a single spec
needs a shared-cluster carrier, the compact loop can be the right proof path,
but it still must create real AKS resources and pass the live pipeline.
