# Evaluation Task Tree

The task tree records desired evaluation outcomes and their current observed
state. Events only wake reconciliation. Workflow runs, agent sessions, reports,
and database rows are evidence linked to a task generation; they are not extra
task-state authorities.

The normative schema and authoring rules live in
`projects/may-agent.app/docs/2a-design/task-resource-engine.md`.

## Stable Responsibilities

`tasks/seed.json` contains only responsibilities that remain true for the life
of the app. They use `reconcile_mode: "maintain"`:

| Task                       | Desired state                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluation-system`        | Independent evaluation stays current, useful, and reliable.                                                                                    |
| `session-audit`            | Eligible terminal sessions have traceable evaluations or structured skips.                                                                     |
| `project-app-audit`        | Every watched app has a current independent health assessment.                                                                                 |
| `finding-delivery`         | Actionable findings reach owners and useful human decisions without duplicates.                                                                |
| `evaluator-reliability`    | Structural parent for evaluation's bounded reliability responsibilities; it reflects child state without starting an owner session.            |
| `pipeline-health`          | Structural parent for pipeline observation and the aftermath frontier; changed anomaly signals wake explicit review work instead.               |
| `criteria-and-calibration` | Criteria remain versioned and calibrated against concrete samples.                                                                             |
| `drift-detection`          | Comparable cohorts expose meaningful quality drift without speculative work.                                                                   |
| `system-integrity`         | Evaluator-local state, routing, ownership, and reports remain internally consistent.                                                           |

Completed migrations, retired ideas, incidents, and dated repair tasks do not
belong in the seed. They are bounded `achieve` children and leave the live graph
after their result is absorbed.

## Reconciled Tasks

`app.ts` maps known events to task intent:

| Task key                              | Mode       | Handler                      | Convergence                                                                                    |
| ------------------------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `runtime/aftermath-backfill`          | `maintain` | `evaluator-aftermath`        | The highest-priority eligible missing evaluation is recorded (failed/interrupted first, then done sessions inside the recent 3h coverage window, then older done backlog); the same task continues while more remain. |
| `runtime/session-aftermath/<session>` | `achieve`  | `evaluator-aftermath`        | An explicitly requested session has a durable evaluation or structured skip.                   |
| `runtime/deep-eval/<session>`         | `achieve`  | `evaluator-deep-eval`        | The requested session has one workflow-traced deep judgment.                                   |
| `runtime/pipeline-monitor`            | `maintain` | `evaluator-pipeline-monitor` | The current snapshot is recorded and unchanged state creates no owner wake.                    |
| `runtime/deep-eval-scan`              | `maintain` | `evaluator-deep-eval`        | At most one candidate is reviewed, or none exists now.                                         |
| `runtime/project-audit/<target>`      | `maintain` | `project-health-evaluator`   | The target fingerprint is current and any due report/feedback is persisted.                    |
| `runtime/owner-review`                | `maintain` | evaluator owner              | Typed task actions are applied atomically, or the owner records a justified no-op.             |

Changing trigger payloads are observations. They are passed to the handler as
the trigger event, not copied into a standing task's desired specification.
Only stable configuration belongs in a `maintain` task input. This prevents a
metric timestamp or manual review reason from creating a new task generation.

For automatic aftermath, `session.end` is first reduced to a compact
`evaluation.aftermath.scan` event. The workflow discovers work from the session
and evaluation tables, evaluates one session in order, and emits the same
compact wake when another eligible session remains. The database and session
eval trails hold per-session history; the task tree holds only the standing
frontier. Explicit requests may still use a short-lived per-session task.

## Legacy Aftermath Migration

The one-time migration removes the former automatic
`runtime/session-aftermath/<session>` live resources, triggers, attempts, and
receipts. It does not remove evaluations, session transcripts, eval trails, or
reports. Any terminal session without an evaluation is rediscovered by the
standing frontier. It also removes the legacy executable resources named
`evaluator-reliability` and `pipeline-health`. Their same-named groups remain,
making those parents structural as declared by the current seed and design.
Session and event stores retain the old owner-run history outside task state.

Run it only with evaluation reconciliation paused and attempts drained:

```text
bun run migrate:session-aftermath --pause
# reload project apps and wait for running evaluation attempts to finish
bun run migrate:session-aftermath
bun run migrate:session-aftermath --apply --expected-revision=<dry-run revision>
bun run migrate:session-aftermath --resume
# reload project apps again
```

After the one-time legacy cleanup, use `--structural-only` for a later repair
of the two parent resources. This preserves explicit per-session task receipts
created after the migration:

```text
bun run migrate:session-aftermath --structural-only
bun run migrate:session-aftermath --structural-only --apply --expected-revision=<dry-run revision>
```

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
