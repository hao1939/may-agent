# Current recovery mechanism review — October 17

This review supports the [unified recovery proposal](../../proposals/unified-agent-recovery-20261017.md).
It inspected existing source, repeated portable checks, and read the local runtime.
It changed no code, deployment, Task controls, budgets or agent messages.

## Scope and revisions

- Apps source inspected: `5edcc47c5f`; active definition release:
  `697cc6c655c8c9e2cc02c0a0194abe220e6aae73-definitions-v5`.
- Host source/runtime: `980f2cda391d36d2a6d10927f81ed02c6bf6b66e`.
  Container command `may-agent --version` returned `may-agent v5.5.0 (980f2cda)`.
  The container and daemon, maintenance and web services were healthy at inspection.
- Later Host #379/#380 do not change the reviewed controller/owner routes.
  Live evidence below is a dated observation, not a continuing health guarantee.

## What works and what is incomplete

| Mechanism | Evidence and limit | Lesson |
| --- | --- | --- |
| Restart retained Task work | The [startup review](container-resume-20261017.md) records resumed Alex implementation work and May investigation, with original inputs and waits retained. | Keep this ordinary recovery path. Perfect history reconstruction is unnecessary for useful continuation. |
| Feedback within an invocation | App recovery tests return report rejection to the same owner; retained results survive restart without another invocation. A prior live agent corrected a SQL column error after receiving the schema. | Give an already running agent the real failure before creating coordination work. Scripted responses establish delivery/acceptance, not general judgment. |
| Indexed code recovery and cleanup | Host tests cover due-work scheduling, saved-answer recovery, cancellation and helper joining. | Retain cheap scheduling and execution cleanup; unchanged waits need no model confirmation. |
| Controller failure reporting | `app-task-runtime.ts` emits `handler.failed`. Alex, May and Scout `app.ts` do not subscribe to that event. Selected selector, evaluation, admission and observer routes exist. | Generic logging does not establish owner action. This does not mean all failure feedback is missing. |
| Owner repair execution | Alex's selector failure targets `runtime/selector-recovery`; normal Alex attempts still declare a Git workspace. `attempt-runner.ts` prepares it before executing the agent, and the worker reloads the App registry. | Another Task may bypass a broken workflow while still depending on the same broken setup. |
| Owner-route tests | The App fixture sets `workspace: undefined` and injects an executor that reports an unverified wait. The Host synthetic failure test declares its own subscription and later lets the fixture restore the prerequisite. | These tests prove consideration and preserved work, not independent setup or actual agent repair. |
| Retry policy | Durable execution failures default to three consecutive failures, with configurable unlimited operation. Controller retries use memory-only counters/timers, 250 ms to 30 s capped delay, without a count limit. Admission backoff caps at one hour, also without a count limit. | Failure boundaries explain accounting differences, not separate high-level recovery rules. Dispatch may repeat real setup work; do not call all retries cheap probes or assume all call models. |
| Cost and ownership | [Startup](container-resume-20261017.md) and [audit](audit-recovery-cost-20261017.md) reviews record expensive review overlap and correction replies. An audit also omitted a known exact Task target. | More observation can amplify work. Reuse the exact owner and original Task; do not infer measured savings from historical token totals. |

Source anchors at the inspected revisions:

- Host `src/app/core/tasks/controller.ts`, `recordFailure`; `app-task-reconciler.ts`,
  `failedExecutionState`; `app-task-runtime.ts`, controller `onError` and startup recovery.
- Host `src/app/core/tasks/attempt-runner.ts`, workspace preparation;
  `src/app/composition/workers/task-attempt-process.ts`, registry/agent bootstrap.
- Host `src/lib/execution-scope.test.ts`; `src/lib/manager.ts`, cancellation and helper drain.
- Apps `projects/alex.app/app.ts`, selector routing and subscriptions;
  `projects/may.app/app.ts` and `projects/scout-knowledge-lib.app/app.ts`, subscriptions.
- Apps `projects/alex.app/recovery-contract.test.ts`, fixture and selector failure trial;
  Host `src/app/core/tasks/app-task-runtime.test.ts`, failed-recovery delivery trial.

The #381 missing-session-metadata case is synthetic, not an established current
live stall. Its initial tests passed, but review found that cancellation was not
proof of completed cleanup. The updated combined revision was not fully validated.
It remains draft, unmerged and undeployed. Promoting it ahead of the general
recovery review was the wrong next step; test counts alone did not establish the
owner's ability to start, repair and resume the assignment.

## Portable verification

Existing tests were rerun without external model calls:

| Suite | Result |
| --- | --- |
| Apps `recovery-contract.test.ts`, with `EVALUATION_AUTO_REVIEW_REVIEWER=evaluator` | 10 passed, 122 assertions |
| Host `controller.test.ts`, `app-task-recovery.test.ts`, `execution-scope.test.ts` | 46 passed, 155 assertions |
| Host `app-task-runtime.test.ts`, filtered to failed-recovery delivery, saved-answer recovery and unconfirmed session recovery | 5 passed, 89 assertions |

Total: **61 passed, 366 assertions, zero failures**. These are existing mechanical
checks. They do not prove the proposed shared allowance, independent repair path,
end-to-end agent repair or live token savings.

The proposal's documentation check (`bun run check:may-design`) passed integrity,
executable examples and App boundaries, with one existing warning for the root
`reports` directory. All 101 relative links in the six changed Markdown files,
including heading targets, resolved; `git diff --check` passed. The check log is
retained alongside the review evidence as `proposal-design-check.log`.

## Bounded live observation

Read-only SQLite observation covered **2026-10-17 06:40:11.637–08:46:41.863 UTC**.
There were 140 `project.task.reconciled` events and no recorded `handler.failed`,
`evaluation.review_failed` or `app.input.admission.failed` in that window.
Attempts started in the window: Alex 101 completed, one interrupted, one running;
May 34 completed; Scout five completed. Attempt completion alone says nothing
about semantic usefulness or complete Task fulfillment.

The interruption was an already documented orderly restart. The selector Task
was converged; no live `runtime/selector-recovery` Task existed. That recovery
route was not exercised in this window.

A Task-phase check at **08:47:26.383 UTC**, excluding cancelled and receipted
work through the same predicates as `HumanTaskService`, found Alex with 510
converged, one running and eight waiting; May with 164 converged and nine waiting;
Scout with 52 converged. No pending or attention Task remained in that selection.
An exploratory query using nonexistent status closure fields had incorrectly
included historical work; it was corrected and is not used as evidence.

Logs and the corrected snapshot are retained at
`/home/hao/workspace-archive/recovery-mechanism-review-20261017/`:
`app-tests.log`, `host-tests.log`, `host-owner-tests.log`, `live-snapshot.json`.
Snapshot SHA-256: `454f24a56173adaee9406cb999436de20839a4b6f0cf33d91b101e6c5da2cb9d`.
This review neither reproduces a live recovery failure nor proves universal
recovery. It identifies source gaps and proof limits that the proposal addresses.
