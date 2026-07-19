# Evaluation Task Tree

The task tree records desired evaluation outcomes and their current observed
state. Events only wake reconciliation. Workflow runs, agent sessions, reports,
and database rows are evidence linked to a task generation; they are not extra
task-state authorities.

The normative schema and authoring rules live in
`projects/may-agent.app/docs/3-proposals/app-task-reconciliation-model.md`.

## Stable Responsibilities

`tasks/seed.json` contains only responsibilities that remain true for the life
of the app. They use `reconcile_mode: "maintain"`:

| Task | Desired state |
| --- | --- |
| `evaluation-system` | Independent evaluation stays current, useful, and reliable. |
| `session-audit` | Eligible terminal sessions have traceable evaluations or structured skips. |
| `project-app-audit` | Every watched app has a current independent health assessment. |
| `finding-delivery` | Actionable findings reach owners and useful human decisions without duplicates. |
| `evaluator-reliability` | Evaluation's own workflows and control path remain reliable and bounded. |
| `pipeline-health` | Coverage, throughput, review delivery, and anomaly state remain observable. |
| `criteria-and-calibration` | Criteria remain versioned and calibrated against concrete samples. |
| `drift-detection` | Comparable cohorts expose meaningful quality drift without speculative work. |
| `system-integrity` | Evaluator-local state, routing, ownership, and reports remain internally consistent. |

Completed migrations, retired ideas, incidents, and dated repair tasks do not
belong in the seed. They are bounded `achieve` children and leave the live graph
after their result is absorbed.

## Reconciled Tasks

`app.ts` maps known events to task intent:

| Task key | Mode | Handler | Convergence |
| --- | --- | --- | --- |
| `runtime/session-aftermath/<session>` | `achieve` | `evaluator-aftermath` | The exact session has a durable evaluation or structured skip. |
| `runtime/deep-eval/<session>` | `achieve` | `evaluator-deep-eval` | The requested session has one workflow-traced deep judgment. |
| `runtime/pipeline-monitor` | `maintain` | `evaluator-pipeline-monitor` | The current snapshot is recorded and unchanged state creates no owner wake. |
| `runtime/aftermath-backfill` | `maintain` | `evaluator-aftermath` | At most one missed session is recovered, or no eligible candidate exists now. |
| `runtime/deep-eval-scan` | `maintain` | `evaluator-deep-eval` | At most one candidate is reviewed, or none exists now. |
| `runtime/project-audit/<target>` | `maintain` | `project-health-evaluator` | The target fingerprint is current and any due report/feedback is persisted. |
| `runtime/owner-review` | `maintain` | evaluator owner | Typed task actions are applied atomically, or the owner records a justified no-op. |

Changing trigger payloads are observations. They are passed to the handler as
the trigger event, not copied into a standing task's desired specification.
Only stable configuration belongs in a `maintain` task input. This prevents a
metric timestamp or manual review reason from creating a new task generation.

## Ownership And Waits

Task execution follows one rule:

```text
explicit task workflow -> reusable workflow
no workflow or workflow exception -> evaluation.app owner entry
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
