# Task Reconciliation Closeout Tracker

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted, delivered, and archived

**Design authority:** [Task Resource Engine](../../2a-design/task-resource-engine.md)

**Related current design:**
[Default Project UI](../../2a-design/default-project-ui.md)

## Goal

Finish the accepted task-resource migration without adding another task model.
The closeout must prove that May reconciles the latest canonical task intent,
while app-owned workflows retain domain policy and evidence.

## Current state

| Area                     | Current state                                                                  | Remaining work                                              |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Canonical reconciliation | Implemented and tested locally                                                 | Reproduce from a clean checkout and run the delivery canary |
| Persistent-task policy   | Project paths no longer select the workflow; the prompt marker is gone         | Reproduce the focused guard tests from a clean checkout     |
| Scout proof case         | Deterministic access, failure, no-op, evidence, and path-admission tests pass  | Run the optional credential-backed deployment smoke test    |
| `tree.json` projection   | Compact current-state projection and canonical WebUI read path are implemented | No remaining closeout work in this tracker                  |

Delivery proof completed with the canonical App rollout. The immutable Apps
artifact loaded Scout against the exact SDK, clean-checkout gates passed, and
the deployed `library-maintenance` reconciliation consumed current XHS
credential evidence, completed its workflow attempt once, and converged with
an evidence-backed no-op rather than fabricating an artifact, duplicate task,
or unexplained Condition. The retained canonical state records the exact
credential failure, watcher recovery boundary, trigger, attempt, and result.

## Accepted boundary

- `.state/tasks/state.json` is the only mutable task authority.
- Queues carry task IDs, not copied task specifications.
- A worker claims the latest canonical generation and trigger atomically.
- Stale handler results are rejected.
- One SDK-owned result schema governs admission.
- The app owns desired state and domain policy.
- The generic controller owns reconciliation mechanics.
- Workflows belong to agents and preserve repeatable process.
- Maintain tasks converge and wait for a real trigger.
- `tree.json` is a disposable current-state projection.

This closeout does not add a scheduler, controller type, task state, execution
profile, history service, or source-specific May API.

## Local closeout changes

### 1. Persistent-task selection is explicit

The shared guard no longer treats a `project:` path as a workflow request. A
path identifies context; it does not select an execution mechanism.

The rule is:

> Require `persistent-task` only when the request explicitly selects it.

Focused tests prove:

- a project path alone can finish directly;
- an explicit persistent-task request is still enforced;
- an actual workflow tool call satisfies the request; and
- an opt-out marker cannot override an explicit request.

The agent runtime remains unaware of controllers and task resources. Prose
claiming the workflow ran is not execution evidence, and a negated workflow
mention does not select it.

### 2. Scout has a deterministic source boundary

Normal CI must not depend on XHS credentials, network availability, rate
limits, or mutable source content. Inject status and search results at the app
boundary and cover both outcomes.

Success:

```text
given current XHS access is observable
and stale blocked notes exist
when a source event targets explore-xhs
then the trigger is persisted
and the current task generation is claimed once
and Scout checks current status and search results
and only current source evidence can justify an artifact
and the task converges with concise evidence
```

Failure:

```text
given the current source check fails
when explore-xhs runs
then the exact failure is reported
and no blocked-scan artifact is written
and waiting is used only with an observable Condition
```

A credential-backed run remains an optional deployment smoke test, not the
normal regression test.

### 3. Scout evidence is reviewable

Keep the generic `evidence: string[]` contract. For a Scout source run, concise
evidence should state:

- source and access result;
- query or inspected page;
- returned count or stable source identifiers;
- created or updated output path, when any; and
- an evidence-backed no-op when nothing useful was found.

The workflow now reports current access and search evidence, rejects output
outside its absolute allowed roots, records an evidence-backed no-op for an
empty current search, and does not dispatch the artifact-writing agent after a
current source failure. A session ID is a trace link, not the acceptance
explanation.

## Remaining work: prove delivery integrity

From a clean checkout:

1. install and build;
2. run focused May tests and type checks;
3. run focused Scout tests and checks;
4. start or deploy a disposable May instance;
5. run the deterministic Scout scenario; and
6. confirm convergence without duplicate current attempts, pending triggers,
   or unexplained Conditions.

Commit and deployment boundaries follow the normal repository and operational
approval process.

## Acceptance

Closeout is complete when:

- clean-checkout tests reproduce the intended behavior;
- a project path no longer selects persistent-task implicitly;
- project-task execution has no compatibility marker;
- deterministic Scout success and failure paths pass;
- task status contains concise acceptance evidence;
- Scout converges without duplicate work or unexplained waits; and
- the delivery canary succeeds.

Projection and WebUI improvements are tracked separately and do not block this
closeout unless they reveal a correctness defect in canonical reconciliation.

## Cost and risk

- The policy cleanup is small but changes legacy direct-project behavior.
- The deterministic Scout scenario is moderate test work with low expected
  flake cost.
- Clean-checkout and canary verification require delivery access.
- Canonical-state compaction is higher-risk recovery work and is outside this
  tracker.
