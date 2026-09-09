# Task runtime organization

**Design status:** Incremental direction accepted; later stages remain provisional.
**Implementation status:** Stage 1 implemented in Host commit `9331ce18` on
`refactor/task-context`; local CI passed, hosted checks pending. Not merged or
deployed. Runtime ownership, execution, and lifecycle are unchanged.
**Implementation PR:** [May Host #95](https://github.com/hao1939/may-agent/pull/95).
**Date:** 2026-09-09.
**Source baseline:** May Host `b94b4ccf3fc6fd7adf95571b50300b5f7b2daad5`.

The recommendation is to reorganize the existing Task engine in small,
behavior-preserving changes. Extract context construction and attempt execution
from the central runtime, make its in-memory resource ownership explicit, and
clarify admission and recovery boundaries. Preserve the existing lifecycle
rules and transactional writes. Group files into a Task directory after those
boundaries are established.

This proposal concerns internal Host implementation. The governing contracts
remain [System Boundary](../2a-design/system-boundary.md),
[Task Resource Engine](../2a-design/task-resource-engine.md),
[Runtime](../2a-design/runtime.md), and [Events](../2a-design/events.md).
The broader [convergence tracker](design-implementation-convergence.md) and
[authority proposal](authority-boundary-simplification.md) own their existing
behavioral work; this proposal does not reopen those decisions.

**The first implementation change extracts shared App discovery and Task context.**
It is a concrete, comparatively low-risk way to test the proposed separation
before changing runtime ownership or moving transaction code.

The shared App catalog belongs outside the Task engine: both conversation
requests and Task attempts use it to discover available App input contracts.
The Task context module owns child, accepted-wait, and attempt-event projections.
Neither needs the runtime's registries or full options object.

## Problem demonstrated by the current source

At the recorded baseline there were 15 production `src/app/app-task-*.ts` files,
excluding tests and test support, totaling 13,305 lines. Two accounted for
9,282 lines, or about 70%:

| Module | Size | Responsibilities currently combined |
| --- | ---: | --- |
| [app-task-runtime.ts](../../../may-agent/src/app/app-task-runtime.ts) | 4,984 lines | Definition installation, event admission, prompt/context construction, executor integration, dependencies, workspaces, acceptance, recovery, and reads |
| [app-task-reconciler.ts](../../../may-agent/src/app/app-task-reconciler.ts) | 4,298 lines | Intent observation, claims, event batches, lifecycle transitions, Conditions, Task actions, session recovery evidence, cancellation, and mutation construction |

Size identifies where to look; it is not itself the defect. The practical
problems are that a reviewer must cross unrelated responsibilities to trace one
attempt, recovery is spread across misleadingly named files, and in-memory
runtime ownership is hidden in several module-level maps keyed by `EventBus`.

The existing smaller controller, queue, resource store, Condition tracker, and
workspace modules already provide useful boundaries. They should be retained.
The proposal should reduce the number of responsibilities a contributor must
understand for an ordinary change, rather than merely shorten files.

## Scope and preserved behavior

The scope is source organization, dependency direction, and ownership of
existing in-memory resources. It introduces no new public SDK, database schema,
Task lifecycle, service registry, worker protocol, or scheduling system.

Each stage preserves these observable contracts:

| Contract | Behavior to retain |
| --- | --- |
| Durable identity | `(appId, taskId)` owns the outcome; attempts and sessions remain execution evidence |
| Admission | Persist intent or a trigger before waking execution; preserve exact targets and admission idempotency |
| Authority | Preserve generation, resource-version, current-attempt, and action checks and their transaction boundaries |
| Incoming evidence | Keep unaccepted events durable; preserve live incorporation and the rules for retaining progress versus accepting completion |
| Completion | Retire finished `achieve` resources into receipts; retain `maintain` resources for later wakes |
| Waiting | Preserve exact Conditions, child waits, dependency identities, and review deadlines; elapsed time does not satisfy a Condition |
| Capacity | Keep App limits, shared Host capacity, wake coalescing, priority, and event-loop yielding |
| Recovery and cancellation | Recover the same Task; reject obsolete results; persist cancellation before stopping the exact attempt |
| Reload and pause | Keep stable controllers and captured definition generations; paused Apps still admit work |
| Execution and acceptance | Preserve agent/workflow/executor selection, timeouts, leases, capabilities, verifiers, and acceptance methods |

Prompt text, event shapes, SQL predicates, and retry timing are behavior too.
Do not revise them as incidental cleanup during an extraction. A discovered
behavioral defect should receive its own change and regression evidence.

The affected entrypoints include the daemon, persistent admission worker,
one-attempt worker, startup recovery worker, and explicit in-process test/tool
entrypoints. Direct conversational execution remains outside this Task-engine
reorganization; shared execution behavior must continue to work.

## Proposed responsibility boundaries

There remains one Host and one Task engine. The following are private modules,
not independently discovered services.

| Boundary | Owns | Dependency rule |
| --- | --- | --- |
| Runtime composition | Installed App bindings, controller/scheduler lifetime, reload publication, cleanup | Explicitly constructs and connects the other modules |
| Admission | Existing Task attachments, resolved intent, exact event/Condition wakes | Uses lifecycle operations and returns affected Task IDs; never executes an attempt |
| Shared App catalog | Compact installed App descriptions and input contracts for conversation and Task execution | Consumes supplied registry entries; never imports Task runtime or loads Apps |
| Task context | Child/wait projections and attempt-event batches | Pure formatters consume explicit observations; the wait reader receives the existing store and database directly and reads only linked facts |
| Attempt execution | TaskAttempt capabilities, executor selection, lease renewal, workspace and session integration | Invokes existing executors and returns their proposed result/evidence |
| Reconciliation | Claim, invoke execution, establish acceptance, admit completion/wait/attention, return follow-up IDs | Owns the ordering of one attempt; uses the existing transition functions |
| Lifecycle and storage | Valid transitions, action batches, receipts, cancellation, transactional persistence | No dependency on runtime installation, controller maps, or prompt formatting |
| Recovery | Interpret existing recovery evidence and apply existing repair operations | Reuses lifecycle transitions; does not create a parallel execution path |
| Dispatch and recovery scheduling | Queue IDs, acquire capacity, detect indexed due/recovery candidates | Schedule work without deciding App meaning or acceptance |

The main call path becomes easy to locate:

```text
admission -> lifecycle/store -> exact Task IDs -> controller
controller -> existing worker process -> reconcile one Task
reconcile -> claim -> context/execution -> validate -> lifecycle/store
reconcile -> follow-up Task IDs -> controller
recovery scheduler -> indexed candidates -> controller
startup recovery -> repair operations -> existing follow-up path
```

Storage operations remain behind `AppTaskResourceStore`. A `TaskTree` remains a
read/mutation snapshot and projection input, never another durable authority.
Do not add a generic repository interface or convert the engine into a new
event-sourced implementation as part of this work.

## Possible layout, not a file checklist

Consider a single `src/app/tasks/` directory after the useful extractions.
Names below describe responsibility; small helpers can stay together where
their dependencies and callers are the same. Do not create every listed file
to satisfy this sketch. A separate file must make a real responsibility or
dependency easier to follow.

```text
src/app/tasks/
  runtime.ts                 composition, installed bindings, reload, close
  capability.ts              existing Host-facing API
  definitions.ts             descriptor preparation and definition capture
  admission.ts               attach intent and admit exact wakes
  reconcile.ts               one attempt: claim through accepted transition
  execution.ts               executor integration and TaskAttempt lifetime
  context.ts                 bounded Task context projections and scoped wait reads
  dependencies.ts            typed cross-App dependency admission
  lifecycle.ts               existing reconciler transitions and fences
  state.ts                   Host-private persisted record types
  resource-store.ts          SQLite resources, indexes, atomic commits
  snapshots.ts               scoped reads and mutation/cache wrapper
  projections.ts             readiness and structural read projections
  controller.ts              dispatch and App concurrency
  queue.ts                   coalescing and priority
  conditions.ts              exact Condition matching and updates
  events.ts                  attempt-scoped publication and live input
  recovery.ts                repair coordination and recovery evidence
  recovery-scheduler.ts      nearest-due timer and indexed safety query
  workspace.ts               workspace preparation and finalization
  workspace-residue.ts       existing canonical workspace protection
  output-paths.ts            declared output path rules
```

Keep `app-dependency-catalog.ts` in the shared App area, outside `tasks/`.
Keep shared `host-capacity.ts`, public SDK types, database schema, and generic
agent/workflow execution in their current owning areas. Keep process launchers
at the Host boundary initially: `task-attempt-process.ts` and
`task-admission-process.ts` call explicit Task entrypoints and retain their wire
protocol. No new package or export-everything barrel is needed.

Two existing names need particular care:

- `app-task-store.ts` may separate snapshots from projections if their callers
  justify it; the resource store remains the actual persistence implementation.
- `app-task-runtime-state.ts` primarily handles project paths and project
  state. Keep it with project hosting rather than presenting it as Task
  lifecycle state.

## Concrete source moves

| Current source | Proposed destination and treatment |
| --- | --- |
| Schema-summary helpers and `appDependencyCatalog` | Shared `app-dependency-catalog.ts`; conversation and Task execution import it directly; remove the runtime-options catalog wrapper |
| `projectAppTaskReconciliationEvents`, `projectAppTaskChildPromptContext` | Task context module; preserve bounds, ordering, literals, and output shapes |
| `projectAppTaskWaitPromptContext` | Separate the explicit scoped wait reader from the pure formatter; preserve request, original target, and resolved Task identities |
| `runtimeTaskAttempt`, `runTaskExecutorAttempt`, `executeTaskAgent`, `executeTaskCapability`, `runRegisteredTaskExecutor` | Execution module; preserve workflow-specific integration while reusing the existing executor implementation |
| `beginCanonicalAgentResidueGuard` and cleanup helpers | Workspace-residue module; preserve restoration and finalization ordering |
| `admitTaskAppDependencies` and related Condition merging | Dependency module; preserve request/Condition identity, freshness checks, and repair behavior |
| `admitResolvedAppTaskEvent`, attachment and targeted wake helpers | Admission module; supply descriptors and wake callbacks explicitly |
| `installAppTaskRuntimes`, controller bindings and descriptor maps | Explicit runtime instance; retain staged publication, rollback, and captured definitions |
| `reconcileTask` | Reconciliation module; extract coherent steps without moving the acceptance/write boundary |
| `recoverInterruptedAppTasks`, persisted result recovery and session evidence helpers | Recovery module; share acceptance/transition operations with normal reconciliation |
| `claimObservedAppTask`, `completeAppTask`, `deferAppTask`, mutation-scope helpers | Keep together initially in the lifecycle module; split further only around a demonstrated responsibility boundary |

Deployment-receipt guidance is a separate ownership question. During mechanical
extraction, keep it behind a named internal helper and preserve its text and
receipt contract. A later focused decision may move semantic guidance to the
Host Operations App while retaining mechanical receipt reads in the Host.
That move requires inspecting the existing App capability and paired recovery
tests; it is not assumed by this proposal.

## Make runtime ownership explicit

Replace the distributed descriptor/controller/scheduler `WeakMap`s in
`app-task-runtime.ts` with one private runtime instance created by the existing
composition root. The existing capability object can expose that instance's
operations; it should not become an additional runtime layer.

The instance owns App bindings, the existing controllers and recovery
schedulers, subscriptions, and its close operation. Dependencies are passed
directly through narrow typed arguments. Leaf helpers do not look up a runtime
through an EventBus, a global path, or a generic `getService()` function.

Construct that instance once and pass it through startup and the existing
capability. Today startup installs Task runtimes before creating the capability;
independently constructing an instance in each place would duplicate ownership.
Do not replace the maps with a giant mutable dependencies bag passed to helpers.

Daemon instances enable dispatch; workers use the existing manual mode and
exact App scope. Reload replaces immutable descriptor bindings while retaining
controllers. An in-flight attempt keeps its captured descriptor and agent
definitions. Preserve the existing drain behavior.

This stage is a lifecycle change, not a mechanical file move. Current close
deliberately retains the process-scoped session listener. Decide explicitly
whether that listener becomes instance-owned or stays with the process; do not
silently change its lifetime during extraction. Prove close/reinstall on the
same bus, independent-instance isolation, in-flight draining, and failed reload.
Independent event-emitter multiplexing remains outside this change unless its
lifetime must change too.

Update private imports and callers together. Do not add compatibility wrappers
for old filenames or signatures. Durable identity, accepted state, and recovery
behavior need preservation; private source locations do not.

## Implementation stages

Use isolated Host branches based on then-current main. Each stage is a small
review unit or short series of PRs; it must leave the repository working.
The measured baseline is a review reference, not a future merge base.

| Stage | Concrete deliverable | Review and verification focus |
| --- | --- | --- |
| 1. Extract context | Add shared `app-dependency-catalog.ts` and Task-specific `app-task-context.ts`; update callers directly and move focused tests | Same context content, order, bounds, schema summaries, event identity, and exact waits; no lifecycle write changes |
| 2. Extract execution helpers | Move attempt capability/lifetime code, executor integration, and workspace protection out of the runtime; extract dependency handling separately if needed | Same leases, cancellation, workflow behavior, dependency identities, and retained workspace outcomes |
| 3. Expose runtime ownership | Create the private runtime instance; migrate daemon, admission, manual attempt, recovery, read, and cleanup callers | Same reload publication/rollback, pause, startup gates, stable controllers, and complete resource cleanup |
| 4. Separate coordination and repair | Extract admission, reconciliation orchestration, recovery evidence/coordination, and projections; leave transaction-critical lifecycle functions together | Same stale-result rejection, Condition replay, terminal-result recovery, and atomic Task actions |
| 5. Group and document | Group established modules and tests only where navigation improves; update references and current design | Mechanical import changes, process/binary resolution, test discovery, no duplicate implementation path |

Stage 1 is the recommended first review. Stages 2–5 establish the intended
direction; their exact PR boundaries should follow the dependencies revealed by
that extraction. Do not require a file-size target or split a coherent
transaction to reach an arbitrary line count.

### Stage 1 implementation boundary

- `appDependencyCatalog(entries, sourceAppId)` projects the supplied App
  registry entries. It does not import the runtime, discover files, or execute
  definitions. Conversation and Task execution share this helper.
- Event and child formatters receive only the relevant attempt batch or child
  observations. Their existing ordering, truncation, and text stay unchanged.
- `readAppTaskWaitPromptContext(resourceStore, db, taskId)` reads the exact
  Task's linked open Conditions and correlated requests using supplied handles.
  It does not resolve a global database path or receive runtime options.
- `projectAppTaskWaitPromptContext(waits)` formats those observations without
  I/O or mutation. An absent request does not erase an accepted wait, and a
  resolved Task ID never becomes the request's original target.
- Keep existing storage-backed integration checks; move pure catalog and child
  projection tests beside their implementations. Add coverage for missing event
  identities, mixed wait states, and distinct original/resolved targets.

Review this slice before starting another. It is a useful stopping point even
if later ownership and directory changes are deferred.

## Validation and completion

Stage 1 validation on Node 24.20.0 and Bun 1.3.14: `bun run ci` passed with
**2,530 passed, 3 expected installed-agent checks skipped, 0 failed**. This
includes type, SDK, App-boundary, and lint checks plus portable unit,
integration, process, and browser tests. It is not a live deployment claim.
The hosted Container gate remains required before the PR is ready.

The source comparison found 116 original function bodies unchanged across the
runtime and extracted modules. The three changed bodies are the two execution
context call sites and the wait formatter; the old runtime-options catalog
wrapper was removed. Wait guidance is unchanged. The runtime file decreased
from 4,984 to 4,671 lines; that is a navigation result, not a performance claim.

### Recorded pre-refactor baseline

The source review ran 353 tests across 14 files on the recorded baseline using
Bun 1.3.14: **353 passed, 0 failed**, in 13.82 seconds. This is a source-test
baseline, not evidence that any proposed restructuring is implemented or that
a live deployment was validated.

Reproduce the focused baseline from the Host repository:

```sh
bun test --timeout 30000 --parallel=2 \
  src/app/app-task-runtime.test.ts \
  src/app/app-task-reconciler.test.ts \
  src/app/app-task-resource-store.test.ts \
  src/app/app-task-controller.test.ts \
  src/app/app-task-queue.test.ts \
  src/app/app-task-recovery.test.ts \
  src/app/app-task-condition-review.test.ts \
  src/app/app-task-parent-semantics.test.ts \
  src/app/app-task-emitter.test.ts \
  src/app/task-cancellation-fence.test.ts \
  src/app/task-attempt-process.test.ts \
  src/app/task-worker-integration.test.ts \
  src/app/host-capacity.test.ts \
packages/sdk/src/task-contract.test.ts
```

For the extracted implementation, also include
`src/app/app-dependency-catalog.test.ts` and `src/app/app-task-context.test.ts`;
their tests moved out of the runtime suite or cover the newly explicit context
boundary.

Use focused existing tests while developing each stage, adding a regression
only when a changed boundary lacks behavioral coverage. For extraction, move
tests with their responsibility instead of duplicating them around wrappers.
For runtime ownership, exercise two independent runtime instances and closing
one while the other continues, if existing tests do not cover that contract.

Run the required Host CI checks before each implementation PR is considered
ready, including the process and container checks required by
[CONTRIBUTING.md](../../../may-agent/CONTRIBUTING.md). After file moves, verify
worker entrypoint resolution and the compiled binary as well as TypeScript
imports. Source checks use committed fixtures and temporary state.

Review these failure-sensitive cases explicitly:

- repeated wakes and new input during an attempt;
- a late result after revision, replacement, or cancellation;
- acceptance plus Task actions committing as one transition;
- a Condition fact arriving before its wait is persisted;
- terminal session output recovered after parent/worker loss;
- reload during an active attempt, including failed candidate publication;
- paused admission followed by resume;
- completed receipts, maintain-Task wakes, and retained workspace lineage.

The refactor is complete when a reviewer can follow admission, one attempt,
result admission, and recovery through named modules; the main runtime owns
composition and lifecycle of resources; helpers no longer reach back into
runtime registries; and the focused and required CI checks pass. Public
contracts, serialized state, worker protocol, and observable Task behavior must
remain compatible. Compare process-test timing and dispatch behavior with the
baseline and investigate regressions rather than claiming a performance gain
from smaller files.

Each implementation stage should be revertible through its source commit
without a data migration. If implementation reveals a required schema or
semantic change, separate it from this proposal. Publish the final organization
in current design and archive this proposal after completion.

## Decisions for review

The recommended choices are:

1. Adopt incremental extraction, beginning with shared App discovery and Task context.
2. Keep lifecycle transaction rules together during the initial refactor.
3. Replace hidden runtime registries with explicit private instance ownership.
4. Group files after responsibility boundaries and callers are established.
5. Review deployment-specific policy ownership separately from mechanical moves.

Alternatives considered were a directory-only move, splitting both large files
immediately, and leaving all state ownership implicit. A directory move improves
navigation but preserves the current coupling. A simultaneous split makes
transaction and recovery changes harder to distinguish from mechanical edits.
Keeping implicit ownership avoids a migration but leaves lifetime and cleanup
hard to inspect. The staged approach gives each boundary its own behavioral
evidence and permits stopping after a useful completed stage.
