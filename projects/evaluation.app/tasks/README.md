# Evaluation Task Resources

Task resources record desired evaluation outcomes and their current observed
state. The generated tree presents their relationships; it is not an authority.
Events only wake reconciliation. Workflow runs, agent sessions, reports, and
database rows are evidence linked to a task generation, not extra task-state
authorities.

The normative schema and authoring rules live in
`projects/may-agent.app/docs/2a-design/task-resource-engine.md`.

## Ingress Routing

The App inbox owns addressed work that requires an independently correlated
result: project comments, explicit owner requests, and replies addressed to the
evaluator. Evaluation facts do not create transient inbox items. Canonical
`tasks.subscriptions` reduces them directly to task intent and wakes the
reconciler:

```text
addressed request -> App inbox -> bounded disposition
evaluation fact  -> task resolver -> task reconciliation
```

Periodic background work follows the same fact path: App event schedules emit
typed wake facts instead of manufacturing callerless inbox items.

Eligible `session.end` facts resolve directly to exact per-session tasks and
never create inbox items. Failed or interrupted sessions, May sessions, and
direct sessions are eligible. Successful workflow-internal sessions remain
durable facts unless explicitly requested; auditing every internal call would
create work without adding proportional evidence. Explicit per-session actions
use the same task identity and always remain eligible.

## Stable Responsibilities

`tasks/seed.json` contains only responsibilities that remain true for the life
of the app. They use `mode: "maintain"`:

| Task                       | Desired state                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `evaluation-system`        | Independent evaluation stays current, useful, and reliable.                                                                         |
| `session-audit`            | Eligible terminal sessions have traceable evaluations or structured skips.                                                          |
| `project-app-audit`        | Every watched app has a current independent health assessment.                                                                      |
| `finding-delivery`         | Actionable findings reach owners and useful human decisions without duplicates.                                                     |
| `evaluator-reliability`    | Structural parent for evaluation's bounded reliability responsibilities; it reflects child state without starting an agent session. |
| `pipeline-health`          | Structural parent for coverage observation; changed anomaly signals wake explicit review work instead.                              |
| `criteria-and-calibration` | Criteria remain versioned and calibrated against concrete samples.                                                                  |
| `drift-detection`          | Comparable cohorts expose meaningful quality drift without speculative work.                                                        |
| `system-integrity`         | Evaluator-local state, routing, ownership, and reports remain internally consistent.                                                |

Completed migrations, retired ideas, incidents, and dated repair tasks do not
belong in the seed. They are bounded `achieve` children and leave the live graph
after their result is absorbed.

## Reconciled Tasks

`app.ts` maps known events to task intent:

| Task key                              | Mode       | Handler                                 | Convergence                                                                                                                                       |
| ------------------------------------- | ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime/aftermath-coverage-snapshot` | `achieve`  | `evaluator-aftermath-coverage-snapshot` | One fresh trailing-3h eligible/evaluated count and coverage metric sample is persisted.                                                           |
| `runtime/session-aftermath/<session>` | `achieve`  | `evaluator-aftermath`                   | An eligible or explicitly requested session has a durable evaluation or structured skip.                                                          |
| `runtime/deep-eval/<session>`         | `achieve`  | `evaluator-deep-eval`                   | The requested session has one workflow-traced deep judgment.                                                                                      |
| `runtime/deep-eval-scan`              | `maintain` | `evaluator-deep-eval`                   | At most one candidate is reviewed, or none exists now.                                                                                            |
| `runtime/evaluation-feedback/<agent>` | `maintain` | `evaluation-feedback-projection`        | The latest durable evaluation fact is reflected in Evaluation-owned generated feedback for that agent.                                            |
| `runtime/project-audit/<target>`      | `maintain` | `project-health-evaluator`              | The target fingerprint is current and any due report/feedback is persisted.                                                                       |
| `runtime/owner-review`                | `maintain` | `codex-goal`                            | Codex resumes the evaluator role against bounded Task events and child facts; typed child actions are applied or it records a justified no-op.    |

Changing trigger payloads are observations. They are passed to the handler as
the trigger event, not copied into a standing task's desired specification.
Only stable configuration belongs in a `maintain` task input. This prevents a
metric timestamp or manual review reason from creating a new task generation.

For automatic aftermath, each eligible `session.end` resolves directly to the
exact `runtime/session-aftermath/<session>` task. Independent session tasks use
the App's declared concurrency. Durable Event delivery is the recovery path;
there is no second scanner competing to evaluate the same session. Durable
`evaluation.recorded` facts and their runtime projection hold evaluation
history; task resources hold only desired work and bounded receipts.

## Historical Aftermath Migration

The automatic per-session migration completed in August 2026 and its one-time
mutation command has been retired. Do not bulk-delete
`runtime/session-aftermath/<session>` state: those IDs now represent legitimate
explicit evaluation requests and their immutable receipts. Any future stored
task-state migration must use the versioned runtime maintenance boundary with
a lock, backup, validation, and receipt; ordinary App code and scripts do not
import task persistence helpers.

## Ownership And Waits

Task execution follows one rule:

```text
explicit task workflow -> reusable deterministic workflow
open-ended Evaluation judgment -> resumable codex-goal executor
workflow returns needs-agent -> one evaluation.app owner judgment
named workflow unavailable -> attention until the binding is repaired
```

Handlers return a structured disposition, summary, evidence, optional actions,
and optional Conditions. They do not edit the tree. The generic reconciler
checks the task generation and applies allowed actions atomically.

An external wait is not a blocked-task narrative. A bounded handler records an
exact Condition, returns `waiting`, and ends. A later Condition change wakes
the same task. Supervision only repairs broken delivery or attempt invariants;
it does not duplicate evaluation judgment.

Project-app findings remain owned by the target app. `evaluation.app` writes
reports, sends evidence-backed owner feedback, and optionally asks a human for
a concrete decision. It does not create evaluator-owned remediation tasks for
the target project's domain problem.
