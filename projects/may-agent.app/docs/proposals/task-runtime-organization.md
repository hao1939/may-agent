# Core review: simple, robust, replaceable

**Status:** Active improvement plan at the [reviewed source baseline](../README.md).
The four core boundaries, shared settlement, durable retries, atomic attachment,
finite Task stop and conversational Request/Stop mechanics are implemented.
The [post-merge review](../archive/reviews/core-implementation-post112-20260910.md)
records 229 passing focused tests and three additional reproduced failures.
Later source fixes merged in #121 and #127; the focused Conversation review uses
`99bc1a31` plus that #127 merge status. This plan covers remaining source and
interaction work; deployment has its own evidence.

## Current focus: simple and robust core

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

## Design against implementation

| Core responsibility | Current assessment | Next useful work |
| --- | --- | --- |
| App registration and input admission | Validated registration, generation publication and atomic Task attachment exist | Preserve the boundary; no new loader service |
| Events | Durable admission, declared routes and change hints connect components | Reuse exact turn control and improve failure correlation |
| State and storage | SQLite fences, accepted results, Request revisions and closure are implemented | Consolidate Conversation/Request/Topic reads and decision commits through the [storage slice](storage-state-service.md#conversation-state-and-handler-extraction) |
| Work runtime | Controller, settlement, retries, waits, finite stop and input containment exist | Separate generic inbox dispatch from conversational handling; preserve the existing model/tool loop |

Completing an input, fulfilling an accepted Request and finishing a Task remain
separate facts. Their records now exist; they need truthful App judgment and
focused usage validation, not another execution lifecycle.

The next ordered implementation work is the
[seven-step inbox and Conversation plan](storage-state-service.md#implementation-order-and-acceptance):
names, reads, Turn writes, linked work, frontend separation, turn behavior and
final review. The series starts from Host `0d8c7658`; its
[candidate review](storage-state-service.md#candidate-review-and-landing-order)
tracks the three PRs, checks and landing order. The plan owns completion criteria;
prepared source is not yet merged. The completed fixes below are preserved regression requirements.

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

### 4. Improve failure evidence through existing events

**Value:** Runtime handling keeps work moving; later investigation identifies
which failure repeats and whether repair is worth its cost.

The controller already has a best-effort `onError`. Its current runtime wiring
uses `handler.failed` with `source: "cron"` and embeds identity/retry details in
strings; input failures use free-form `info`. Add useful work identity, stage,
reason and disposition to existing event payloads/readers. Report the actual
origin when known; do not label all Task controller failures as schedule work.
Choose measurements only when they answer an operating question, for example
failure frequency or repeated execution cost.

**Accept when:** An operator can follow a failure to its exact work and subsequent
disposition without parsing prose. Diagnostic failure cannot prevent cleanup or
settlement. Apps/LLMs judge repair, scope and stop; the Host enforces mechanics.
A new core collector or investigation service is not required. This small change
does not reopen the paused error-App/metrics placement decision.

## Code homes and boundaries

| Change | Existing home | Responsibility |
| --- | --- | --- |
| Dispatch, recovery and reporting containment | `app-inbox-runtime.ts`; ownership rules in `app-inbox-host.ts` | Own detached work and cleanup; keep execution control with its adapter |
| Esc, buttons and command help | `packages/terminal`, `src/app/transport/telegram.ts`, relevant browser adapter | Capture exact work identity and render control outcome |
| Durable turn Stop | Existing turn-control event route and inbox state | Reuse persisted disposition and exact execution fences |
| Accepted Request meaning and storage | `conversations/requests.ts`, `projects/may.app/app.ts` | App judges; Host stores and checks revisions |
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
[current stop contract](task-controller-pattern.md#stop-without-claiming-success)
retains non-success evidence and parent review. It is distinct from turn Stop
and Request closure. Policy quality and live follow-through have separate proof.

## Earlier review links

The Host source guide still links these entrypoints. Their current owners are:

<a id="step-2-separate-app-source-discovery-from-core-registration"></a>

- App discovery and registration: [Architecture](../2a-design/architecture.md#code-organization);
  [original Step 2](../archive/implementation/core-separation-review-20260910.md#step-2-separate-app-source-discovery-from-core-registration).

<a id="step-3-finish-the-taskexecutor-boundary"></a>

- Task/executor boundary: [Task engine](../2a-design/task-resource-engine.md#one-attempt-interface);
  [original Step 3](../archive/implementation/core-separation-review-20260910.md#step-3-finish-the-taskexecutor-boundary).

<a id="shared-timing-intentional-events"></a>

- Shared timing: [Scheduling and Observation](../2a-design/cron.md#shared-timing-separate-responsibilities);
  [original review](../archive/implementation/core-separation-review-20260910.md#shared-timing-intentional-events).
