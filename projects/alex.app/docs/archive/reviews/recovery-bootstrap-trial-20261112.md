# Recovery bootstrap boundary trial — 2026-11-12

**Supports:** [Connected recovery acceptance](../../proposals/unified-agent-recovery-20261017.md).
**Status:** Source inspection and disposable subprocess trials. No production
runtime change, deployment, live-state mutation or external model call.

## Finding and smallest useful response

An independently configured Task recipient can still depend on another App's
module initialization. Task workers load the accepted App catalog before
selecting the target App. An unavailable prerequisite used by an unrelated
top-level module can therefore prevent the recipient from starting.

The first response is to keep optional business initialization at the operation
that needs it. The same fixture prerequisite placed in an unselected business
workflow no longer blocks the independent recipient. This establishes that an
existing boundary can contain this particular failure; it does not demonstrate
repair of the original work or justify a new recovery service.

Invalid new source is a different case. Existing registry/discovery tests confirm
that rejection preserves the whole previous generation. Retain that rule and the
complete accepted address/routing catalog when considering any later Host change.

## Revisions and reproduction

- Host source: **a84c6918ed404cc9793c98930df815a00551544e**, fetched main after
  merged #455, #456 and #457.
- Harness: **f1294bf20346edf628cb4c270054b95f21983ae9**, local linked branch
  **experiment/recovery-bootstrap-20261112**.
- Checkout: `/home/hao/workspace-worktrees/may-recovery-bootstrap-20261112`.
- Harness file: `test/integration/recovery-bootstrap-trial.test.ts`.
- Reused fixture: `test/integration/fixtures/task-worker-scenario.ts`.

From that checkout:

```sh
bun install --frozen-lockfile
bun test test/integration/recovery-bootstrap-trial.test.ts src/app/adapters/discovery/app-definitions.test.ts src/app/core/apps/registry.test.ts
bun run check
bunx --no-install eslint test/integration/recovery-bootstrap-trial.test.ts
```

This remains a linked experiment, not a new permanent CI requirement. Node 24.20.0
and Bun 1.3.14 are used. The production source is unchanged from the base revision.

## What actually ran

The existing fixture supplies temporary App source, SQLite, a retained pending
Task, the ordinary deterministic workflow, a real child process and production
worker entry/IPC. Both App definitions load successfully in the parent while an
external fixture prerequisite exists. The normal source-release store captures
their code, and the worker request retains both accepted App directories.

The failure injection removes only that external prerequisite. Captured code
and accepted selection stay unchanged. The unrelated App's top-level import
then throws before the worker can claim the recipient's Task. The positive
contrast places the check in an unselected workflow. The harness neither repairs
the prerequisite nor synthesizes an outcome. Its deterministic workflows use no
model provider. Fixture cleanup closes workers/runtimes and removes temporary state.

| Case | Observed outcome |
| --- | --- |
| Prerequisite available during worker execution | Independent recipient runs in a real subprocess and accepts the expected workflow outcome. |
| Prerequisite lost after acceptance; check at App-module top level | Recipient startup rejects with the exact prerequisite error. Its Task stays pending without a current or observed attempt, cancellation or closure receipt. |
| Same unavailable prerequisite checked in the other App's workflow | Independent recipient still runs and accepts the expected outcome. The prerequisite stays absent; the other workflow is not executed and no repair is claimed. |
| Same module failure through the ordinary parent controller | Durable **handler.failed** names the exact App/Task, error, stage and scheduled retry. No **project.task.reconciled** event is emitted; the Task remains pending without an attempt. |

The last case uses normal controller dispatch; it does not manually reconcile
the Task. It stops after observing the first failure and closes the runtime, so
it does not measure prolonged backoff, total repeated cost or restart behavior.

## Failure route and verification gap

At the inspected revision:

- `src/app/composition/workers/task-attempt-process.ts:527` loads the accepted
  registry; target selection follows at line 536.
- `src/app/composition/workers/task-admission-process.ts:166` also loads the
  catalog before preparing admission descriptors. This is source inspection;
  admission-worker failure was not exercised by these trials.
- `src/app/core/tasks/app-task-runtime.ts:643` publishes controller failures as
  **handler.failed**, with original App/Task references.
- `src/app/core/tasks/controller.ts:289` owns dispatch backoff, starting at
  250 ms and capped at 30 seconds; that cap is not a retry-count limit.

These are pre-attempt controller failures. An attempt-exhaustion subscription
cannot be assumed to receive them. Reviewed May/Alex source routes cover specific
admission failures, reconciliation and review events; that does not establish
an installed recipient for this controller fact. No installed route was changed
or tested here. A missing route must remain an explicit unresolved delivery.

Earlier Git-workspace trials loaded both App modules successfully. Registry
tests established atomic publication, while scripted IPC failure tests established
transport behavior. Neither crossed this shared bootstrap dependency. The lesson
is to trace the producer, actual recipient startup and return together; another
passing isolated failure handler is insufficient.

## Validation and limits

The final selected run passed **19 tests, 79 assertions, zero failures** in
**4.81 seconds**: four experiment cases and 15 owning registry/discovery cases.
The reproduced blockage is an expected negative result, not successful recovery.
Host TypeScript checking, targeted ESLint and whitespace checks passed.

An expanded type check explicitly including the experiment also traverses the
reused subprocess fixture, which ordinary Host checking excludes. It reports ten
existing fixture errors, including missing Bun globals and outdated event/type
shapes. Checking that fixture alone produces byte-identical diagnostics. This
experiment therefore has no clean expanded-type-check claim; those unrelated
fixture errors were not changed to make the experiment pass.

The full App documentation command **bun run check:may-design** passed integrity,
executable examples, canonical App boundaries and model-surface checks in the
current shared workspace, with 15 existing layout warnings. Link/heading checks
found no new broken targets; 20 existing archive issues remain. These checks do
not establish agent behavior or live adoption.

Logs, both expanded-type configurations and SHA-256 checksums are retained at
`/home/hao/workspace-archive/recovery-bootstrap-20261112/`.

The original Task is seeded through the existing retained-state fixture. There
is no original human ask, caller return, autonomous diagnosis, applied repair,
human adapter delivery or live-installation observation in this experiment.
Those remain acceptance requirements in the active proposal. The next connected
trial should use independently loadable App declarations, a workflow-local
failure and its actual saved-caller/operational feedback path. Retain this
pre-attempt contrast so a successful attempt route is not mistaken for universal
startup recovery.
