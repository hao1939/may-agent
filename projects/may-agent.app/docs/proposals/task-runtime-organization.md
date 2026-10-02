# Core review: simple, robust, replaceable

**Supports:** [Architecture](../2a-design/architecture.md). Organizes the core around owned guarantees and checks where simplification preserves useful behavior.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#stable-core-replaceable-capabilities); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Active improvement plan at the [reviewed source baseline](../README.md).
The four core boundaries, shared settlement, durable retries, atomic attachment,
finite Task stop and conversational Request/Stop mechanics are implemented.
The [post-merge review](../archive/reviews/core-implementation-post112-20260910.md)
records 229 passing focused tests and three additional reproduced failures.
Later source fixes merged in #121 and #127; the focused Conversation review uses
`99bc1a31` plus that #127 merge status. This plan covers remaining source and
interaction work; deployment has its own evidence.

## Current focus: simple and robust core

The finite-stop references in the dated implementation inventory describe the
earlier controller policy. The [current Task lifecycle](../2a-design/task-resource-engine.md#one-lifecycle-baseline)
owns retry and closure behavior; those historical milestones do not establish a
retry-count requirement. Use the linked source dates as evidence of that work,
not as the current implementation baseline.

> Removal should degrade capability, while preserving the remaining system's correctness.

Keep the four responsibilities in [Architecture](../2a-design/architecture.md#core-responsibilities):
App registration/admission, Events, State/storage and Work runtime. The controller,
event routes, SQLite transactions and bounded executors already fit this model.

Judge each change by its useful outcome, total cost, likely lifetime and cost of
being wrong. Fix reproduced failures first. Prefer affordable redo over elaborate
resume; stop when the required outcome is met. The
[decision guide](../1-principles/core-principles.md#review-rule) owns these tradeoffs.

Before a larger extraction, use the
[system simplification review](authority-boundary-simplification.md#design-choices-before-code-moves)
to decide which execution/recovery paths should remain. It also records the
September 11 source-layout findings and small import/composition improvements;
it does not replace the accepted inbox/state sequence below.

The [one-lifecycle design](../archive/reviews/conversation-input-unification.md) now owns the
accepted common Task lifecycle: explicit outcomes, rest between inputs and
owner-controlled closure. Conversation uses a stable execution Task, retaining
message/Request records and replacing separate inbox execution and supervision.
This lifecycle is implemented in Host source through #158 and subsequent cleanup,
including removal of mode-dependent authoring. Older implementation/migration
checklists below are historical; installation adoption still requires its own
evidence. The September 27 section records the current source cleanup.

## September 27 readability refinement

The current cleanup keeps the established lifecycle and storage authority.
The first slice removes the session manager's unused evaluation classification
(`unevaluated`, including name-based `actionable`/`autoSkippable`) and connects
the agents tool through its existing checked interface. Factual health reads
remain, including the worker-process regression; neither an Evaluation selector
nor a new health service is introduced. No current Host or sibling App source
consumer was found for the removed classification.

The second slice makes waiting settlement a single sequence: fence/finalize the
workspace, validate existing and declared Condition identities, admit/reuse App
dependencies, commit through `deferAppTask()`, then recover saved feedback.
Failures return through the same existing retry/diagnostic settlement. The
executor's proposed result stays unchanged while Host settlement prepares its
observations. Existing waits, accepted facts, failure evidence and useful
continuation remain independent. No persisted format, event, controller or
App authoring contract changes.

This is a focused source refactor. Keep the proposal/settlement distinction local
to the existing attempt runner; do not create another durable result lifecycle.
Keep the current ordering and transaction fences. Tests must continue to cover
Condition conflicts before publication, stale generations, workspace rejection,
independent waits/continuation and feedback already saved before a wait commits.
The existing agent/workflow parity and verifier-handoff cases also exercise
immutable adapter proposals. Context timing is documented in the Host's existing execution guide:
attempt-start discovery files, preparation-time instructions, and a refreshed
decision brief before each model call have different, explicit roles.

Broad file renaming and further reconciler extraction remain deferred until a
specific reading problem justifies the import churn. Source candidates are
[Host #252](https://github.com/hao1939/may-agent/pull/252), `52abb62c`, and
[Host #253](https://github.com/hao1939/may-agent/pull/253), `92c98451`, both based
on merged #251 (`0ee8ed40`). They merge cleanly together in source `0e31a41a`.

Before the rebase, full local CI passed for the manager slice (`56b793b3`:
3,238 pass, three installation-only skips, no failures) and the waiting slice
(`83bde3d7`: 3,240 pass, three skips, no failures), on base `8068c3e3`.
The focused Task suite passed 208 tests. The two strengthened adapter scenarios
fail against base production source and pass on the final waiting candidate:
a waiting workflow result must be accepted without mutation, and an agent result
must retain its proposal while the Host attaches the required verifier.
These are source/adapter contract checks, not live deployment or model-behavior
claims. Final combined CI on `0e31a41a` passed with 3,238 tests, three
installation-only skips and no failures. Both PRs passed GitHub Quality and
Container on the named final revisions. Canonical design integrity also passed
with zero errors/warnings. The Host PRs are ready for human review; this record
does not authorize or establish deployment.

## Task lifecycle review

**Reviewed September 11 against Host `8e242c11`.** Core/external layout and the
#143/#144 fixes are merged. The companion source-map and workflow-evidence
updates are consolidated on workspace `main`; this is a source baseline, not
installation verification.

The common path already has useful boundaries:

```text
App accepts an input
  -> admission stores/attaches the Task
  -> controller obtains execution capacity
  -> reconciler claims the current Task attempt in SQLite
  -> selected executor proposes a result
  -> runtime checks the result and any App verifier
  -> reconciler commits accepted output, a wait, retry, attention, or stop
```

| Question | Source and finding |
| --- | --- |
| Can admission lose its Task link? | `core/state/inbox.ts: attachRequestToTask()` commits the inbox claim, Task admission and applicable links in one transaction. Event admission retains its idempotency identity. Keep those boundaries. |
| Do capacity and claim duplicate authority? | `core/tasks/controller.ts` limits local execution and schedules queue hints. `claimObservedAppTask()` plus resource-store fences owns the exact attempt. The two mechanisms protect different facts. |
| Who can say the outcome is done? | The executor proposes; `establishTaskAcceptance()` checks any verifier; `completeAppTask()` rechecks identity and newer evidence before committing output/actions. A successful executor call alone is insufficient. |
| Can failure loop forever? | `failAppTaskAttempt()` retains unaccepted input and a durable failure count. Invalid results or rejected acceptance need attention/new evidence; cancellation and App stop remain distinct from success. Controller retries are scheduling, not a second durable retry allowance. |
| Does restart need another controller? | No. `recoverInstalledAppTasks()` repairs known interrupted state and queues the same Task. Retained terminal direct-agent output uses existing admission; task-bound sessions bypass generic session resumption. Indexed safety/due recovery restores lost queue hints. |
| Is reload internally consistent? | Attempts pin execution definitions and installation publishes one generation. The session-event listener nevertheless captured the first runtime's adapters while reading current descriptors. Regressions reproduced stale adapter use after reload/close-and-reinstall and rejected candidate options surviving completed rollback. |

### Small source changes from this review

1. **Fix the reproduced reload mismatch.** Keep the process-scoped listener;
   resolve its options from the published runtime when handling each event.
   Do not register another listener or change how an already running attempt
   retains its execution definitions. The regression checks both session start
   cleanup and terminal-session inspection, with no duplicate subscriber.
   Review also found that failed publication restored previous descriptors using
   rejected candidate options. Save and restore the accepted options with those
   descriptors; keep the previous publication callback disabled during rollback.
   When no runtime was previously installed, clear the rejected options after
   rollback. A regression checks that session inspection and explicit recovery
   stay inactive, and a later installation reuses the existing listener.
2. **Separate definition preparation from attempt orchestration.** Move existing
   descriptor construction, seed-authority discovery and project read-model
   projection into `core/tasks/runtime-definition.ts`. The admission worker
   imports its descriptor preparation there. Keep publication, rollback,
   controllers and all reconciliation transitions with their existing owners.
   Add a short Task lifecycle reading table beside the code.

Definition preparation merged in #146 as `e1a0005e` on September 11. The #145
review fix merged as `5857529e`, including rejected initial-publication cleanup.
No SDK, persisted format or App declaration changes are needed; deployment
remains separate.

| Source slice | Local verification |
| --- | --- |
| [Host #145](https://github.com/hao1939/may-agent/pull/145), `148acd7f`, merged as `5857529e`: current session adapters and rejected-publication rollback | Full CI: 2,702 pass, three installation-only skips, no failures; reload, close/reinstall, rejected-reload and rejected-initial-publication regressions pass. The initial rejection case reproduced both rejected session reads and explicit recovery calls before the fix, and verifies successful later installation |
| [Host #146](https://github.com/hao1939/may-agent/pull/146), `11df5e12`, merged as `e1a0005e`: definition preparation | Full CI: 2,698 pass, three installation-only skips, no failures; all eight moved function bodies are unchanged |

Browser coverage ran in both suites. #145's complete local CI includes merged
#146 and both rejected-publication regressions. Hosted Quality and Container
checks passed on `148acd7f`.
#146's checks also passed on its reviewed revision. Canonical design integrity,
examples and App checks passed against #145's updated source.
No installation or model-backed tests ran.

**Value/cost decision:** Fix the observable adapter mismatch with one current
runtime lookup. Extract the preparation code because it is a cohesive concern
with ordinary typed inputs and no execution callbacks; it removes about 180
lines from the orchestration file. This improves reading structure without
claiming to reduce total behavior or prove production performance. Eight moved
function bodies remain unchanged. Existing full CI, including reload/rollback,
admission workers, Task cancellation and SQLite restart tests, is the gate.

Do not split recovery and settlement merely to meet a line-count target: startup
and normal completion intentionally share result admission. Do not replace
atomic mutation with events or add a second registry. Further extraction should
follow a concrete reading or correctness problem; HTTP organization and live
Conversation/Request validation remain independent work.

## Design against implementation

| Core responsibility | Current assessment | Next useful work |
| --- | --- | --- |
| App registration and input admission | Validated registration, generation publication and atomic Task attachment exist | Preserve the boundary; no new loader service |
| Events | Durable admission, declared routes, exact turn control and correlated failure facts are implemented | Preserve those boundaries; choose further diagnostics from an operating question |
| State and storage | SQLite fences, accepted results, Request revisions and closure are implemented | Merged in #129: Conversation/Request/Topic reads and decision commits use the [storage slice](storage-state-service.md#conversation-state-and-handler-extraction) |
| Work runtime | Controller, settlement, retries, waits, finite stop and input containment exist | Merged in #129: generic dispatch and selected handler are separate; preserve the existing model/tool loop |

Completing an input, fulfilling an accepted Request and finishing a Task remain
separate facts. Their records now exist; they need truthful App judgment and
focused usage validation, not another execution lifecycle.

The completed source sequence is the
[seven-step inbox and Conversation plan](storage-state-service.md#implementation-order-and-acceptance):
names, reads, Turn writes, linked work, frontend separation, turn behavior and
final review. The series starts from Host `0d8c7658`; its
[candidate review](storage-state-service.md#candidate-review-and-landing-order)
tracks the three PRs, checks and landing order. The plan owns completion criteria;
the series merged through #129 as `0bedd93a`. The completed fixes below remain regression requirements.

## Implementation order and candidate decisions

### 1. Contain the reproduced input-runtime failures

**Source status:** Completed in [#121](https://github.com/hao1939/may-agent/pull/121)
and [#127](https://github.com/hao1939/may-agent/pull/127). Cleanup attaches before
fallible dispatch/readiness work, detached recovery errors stay contained and
diagnostics have an independent fallback. Persistent dispatch faults wait for
recovery instead of spinning; closing input runtime cancels pending capacity
waits. Durable unstarted input remains available to the next runtime.

Keep these fault/close regressions when extracting the input handler. The
[earlier reproductions](../archive/reviews/core-implementation-post112-20260910.md)
explain the failures; they are no longer an instruction to reimplement the fixes.

### 2. Finish the small human-control interface

**Source status:** Completed in #121, including Console Esc, Telegram/browser
Stop buttons, removal of Console `/stop` and clearer command help. The shortcut
and buttons reuse exact-turn durable Stop; background Tasks retain separate
controls. Keep the existing busy-turn, stale-target, draft and idle checks.
The [human-control design](../2a-design/human-control-surfaces.md#current-turn-control)
owns the contract and the separate steering gap.

### 3. Validate redirection and Request follow-through

**Source status:** The existing mechanics pass the bounded review below. Remaining
work is App judgment and interaction validation; add runtime behavior only for a
demonstrated missing guarantee.

Start with Stop, then a new correction in the same Conversation. Ordinary input
currently queues behind a running turn; do not present that as immediate steering.
If this two-step interaction is insufficient in use, add a way to save the
correction and interrupt/continue from current evidence. No `/steer` command or
seamless resume is required. A completed-target race must retain the correction.

Request identity, revision checks, Task links and closure are already implemented,
as is May's supervision guidance. The documented May/Scout trial shows one useful
handoff/closure path. Check the remaining cases against
[Message Lifecycle](../2a-design/message-lifecycle.md#current-implementation-and-gaps):
correction keeps the same ask, failed/stopped work does not imply fulfillment,
and a completed linked Task still gets its owed explanation after restart.
Tests of stored decisions do not prove the model's judgment in every discussion.

**Accept when:** The human can redirect work without losing the correction or
silently reviving a stopped turn; accepted obligations stay visible until an
explicit outcome. Add implementation only for a demonstrated missing boundary.

#### Request follow-through review

**Reviewed September 11 against Host `5857529e`.** The 89 existing focused tests
passed. [Host #149](https://github.com/hao1939/may-agent/pull/149), `60bd90d9`,
strengthens existing tests without changing runtime or storage behavior; its 14
affected tests pass. Full local CI passed: 2,705 tests,
three installation-only skips, zero failures; browser coverage ran. Canonical
design integrity, examples and App checks passed against that source, including
after integrating the concurrent documentation update. Hosted Quality passed;
Container correctly reported no build needed for this tests-only change. Human
review remains pending.

| Scenario | Checked boundary and source evidence |
| --- | --- |
| Stop, then correct the same ask | `app-turn-control.test.ts` persists Stop before abort, rejects late output, then reopens SQLite with the correction still queued. Its text and original Request reach the new handler; the same Request is revised once and the stopped turn stays stopped. Independent background work is unchanged. |
| Linked work succeeds, exhausts retries, is cancelled by the human, or is stopped by its App | `core/state/conversation-requests.test.ts` uses real Task transitions. The accepted Request remains open and keeps its exact link in every case. Recovery finds it after reopening, including terminal linked work. |
| The Task is finished but its explanation is missing | The same test obtains the normal supervision wake from reopened storage. A failed explanation write rolls back closure and links. An old scope cannot close a newer Request; a valid replay stores one explanation and closure. |
| An explicit decision closes an unfulfilled ask | Fixture decisions use `unfulfilled` with an explanation. Closure does not change the linked Task, its attempts or its retained outcome. An exhausted Task still requiring attention remains independently reviewable after the ask closes. |

The existing `failed completion rolls back closure` test also proves that a saved
frontend decision survives a failed result write and can finish after reopen
without another resolver call. `app-inbox-failure.test.ts` covers interrupted and
failed frontend execution without automatic model replay.

**Decision:** Keep the implementation. This review found a coverage gap, not a
reproduced runtime defect. The candidate adds three non-success cases to the
existing closure fixture and moves correction handling across the reopen boundary.
No new Request worker, recovery mechanism or steering command is justified.

These fixtures supply App decisions; they do not prove that a live model will
recognize corrections or choose truthful closure. Verify those judgments in a
separately authorized usage trial. Current Stop-then-correction remains the
supported redirection path; immediate steering remains conditional on need.

### 4. Improve failure evidence through existing events

**Source status:** Implemented; the earlier TODO was stale. At `5857529e`, Task
controller errors publish `handler.failed` with `source: "app-task-controller"`,
App/Task identity, stage, disposition and retry intent. Inbox failures use
`source: "app-inbox"` with available input, Conversation and claim identity.
Execution reporters retain an independent diagnostic fallback.

`controller.test.ts` and `app-inbox-containment.test.ts` cover failures in the
reporter itself. Keep reporting independent of cleanup and settlement. Apps/LLMs
judge repair, scope and stop; the Host enforces mechanics.

Further measurements or presentation changes need an operating question, such as
which failure repeats or costs the most. The remaining question is usefulness in
operation, not another event schema, core collector or investigation service.
The error-App/metrics placement discussion remains deferred.

## Code homes and boundaries

| Change | Existing home | Responsibility |
| --- | --- | --- |
| Dispatch, recovery and reporting containment | `composition/app-inbox-runtime.ts`; ownership rules in `core/inbox/app-inbox-host.ts` | Own detached work and cleanup; keep execution control with its adapter |
| Esc, buttons and command help | `packages/terminal`, `src/app/transport/telegram.ts`, relevant browser adapter | Capture exact work identity and render control outcome |
| Durable turn Stop | Existing turn-control event route and inbox state | Reuse persisted disposition and exact execution fences |
| Accepted Request meaning and storage | `core/state/conversation-requests.ts`, `conversations/turn-handler.ts`, `projects/may.app/app.ts` | App judges; Host stores and checks revisions |
| Correlated failure facts | Existing event contract, runtime publishers and read projections | Best-effort evidence independent of work settlement |
| Further atomic state operations | `core/state/` and existing resource stores | One transaction owner for each coherent change |

Extract a function or module when it removes duplicated decisions or makes a
failure/transaction boundary independently understandable. Large files are a
reason to inspect the cost, not a reason to move everything. Keep local reads,
executor calls and atomic changes as typed calls. Events carry meaningful input,
changes and wakes; no API server, universal adapter or event for every SQL call.

## Conditional work and deliberate deferrals

Recovery uses indexed branches, union and ordering before its result limit.
A bounded returned page does not prove fixed query cost. The earlier synthetic
review measured about 24 ms with 20,000 eligible Tasks; the post-merge review
ran no new workload benchmark. Measure representative backlog and human-control
latency before optimizing. Preserve current correctness fences.

[Atomic attachment](storage-state-service.md#first-slice-implementation-evidence)
is complete. Further storage extraction needs an actual consistency or maintenance
problem. Error-hook/metric placement and App consolidation remain in the
[paused discussion](../archive/reviews/error-handling-and-conversation-discussion-20260910.md).
Capacity events and an API server require a demonstrated consumer; neither is a
prerequisite for the fixes above.

## Completed work and evidence

The [post-merge review and portable probe](../archive/reviews/core-implementation-post112-20260910.md)
cover the current source. The
[earlier comparison](../archive/reviews/core-implementation-alignment-20260910.md)
records the pre-#112 renewal/retry failures; those particular fixes are merged.
Host #112 includes the earlier #113/#114/#115 conversational slices, so they
are no longer a merge sequence or active implementation backlog.

Core separation, shared settlement, durable retry limits, atomic attachment and
parent-owned repair are complete. Their dated evidence remains in the
[core snapshot](../archive/implementation/core-separation-review-20260910.md) and
[controller snapshot](../archive/implementation/controller-review-20260910.md).
Preserve regression coverage without restarting completed work.

### First stop slice: the current finite Task only

Host #111 merged finite `achieve` Task stop without live direct children. The
[current stop contract](../archive/reviews/task-controller-pattern.md#stop-without-claiming-success)
retains non-success evidence and parent review. It is distinct from turn Stop
and Request closure. Policy quality and live follow-through have separate proof.

## Earlier review links

The Host source guide still links these entrypoints. Their current owners are:

<a id="step-2-separate-app-source-discovery-from-core-registration"></a>

- App discovery and registration: [Architecture](../2a-design/architecture.md#code-organization);
  [original Step 2](../archive/implementation/core-separation-review-20260910.md#step-2-separate-app-source-discovery-from-core-registration).

<a id="step-3-finish-the-taskexecutor-boundary"></a>

- Task/executor boundary: [Task engine](../2a-design/task-attempts.md#one-attempt-interface);
  [original Step 3](../archive/implementation/core-separation-review-20260910.md#step-3-finish-the-taskexecutor-boundary).

<a id="shared-timing-intentional-events"></a>

- Shared timing: [Scheduling and Observation](../2a-design/cron.md#shared-timing-separate-responsibilities);
  [original review](../archive/implementation/core-separation-review-20260910.md#shared-timing-intentional-events).
