# Refined core design against implementation — 2026-09-10

**Historical context:** [Architecture](../../2a-design/architecture.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Dated source review and isolated evidence. Implementation priorities
live in the [core review plan](../../proposals/task-runtime-organization.md).
This document is not a deployment record or a new subsystem specification.

## Scope and judgment

Reviewed Host main `6dcb0fa3ea28b20133ae7e5e3f265b124e010fc4` through #110 against
the refined design at workspace main `9d70928053`. May App source was read from
that committed workspace revision. The working Host checkout at `4afaaafb`
has the same production code: #110 changes runtime tests and source guidance only.
PR #111 was open at `88a476fa` when checked; its latest code was not reviewed.

The core largely implements the intended architecture. Keep the four existing
responsibilities and their event connections. The most useful next work is
stronger input failure containment, exact human control, and accepted Request
follow-through. No evidence here justifies a new controller, API server, retry
framework, or broad directory rewrite.

| Responsibility | Implementation examined | Assessment |
| --- | --- | --- |
| App registration and input admission | `core/apps/registry.ts`, definition validation, `app-inbox-host.ts`, `core/state/requests.ts` | Discovery/validation and atomic Task attachment are separated. Preserve this boundary. |
| Events | `core/events/bus.ts`, event admissions, composition routes | Existing publication/routing mechanisms support the design. Durable state retains obligations; change hints prompt rereads. |
| State and storage | SQLite schema, `core/state/requests.ts`, Task resource store and fenced transitions | Atomic attachment and caller readiness are already implemented. Accepted conversational Request identity/closure remains missing. |
| Work runtime | `core/tasks/controller.ts`, Task runtime/reconciler/recovery, executor boundary, `app-inbox-host.ts` | Task settlement/retries and parent-owned repair are implemented. Conversational failure handling is weaker, and exact Stop lacks durable implementation. |

This is a focused boundary review, not an exhaustive audit of every code path.

## 1. High priority: a failed input renewal can terminate the daemon

[`AppInboxHost.#renewClaim`](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/app/app-inbox-host.ts#L1010)
calls `renewAppInboxClaim` in a bare interval callback. It neither catches a
database exception nor handles a false renewal result. The renewal store function
performs a direct write. Production
[`uncaughtException` handling](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/app/daemon-lifecycle.ts#L189)
closes databases and exits the process with code 1.

A portable probe runs the actual input Host with file-backed SQLite and a
synthetic delayed resolver. A trigger rejects the renewal write. With the
production lifecycle handlers installed, the process exits 1 before a turn
result is produced. The control without the rejecting trigger finishes normally.

```text
renewal-control: resolver calls=1, input status=done, exit=0
renewal-daemon:  synthetic renewal write failure, no completed output, exit=1
```

This proves the callback/process boundary, not a full daemon boot or a real disk
outage. Ignored false renewal is a source finding; this probe injects an exception.

**Recommendation:** Contain the callback locally and stop/fence execution when
claim authority is lost or uncertain. Preserve exact ownership checks at every
consequential effect. Cleanup must survive a second storage/reporting failure;
release capacity only after execution stops. A caught exception alone does not
establish safe ownership. When storage is unavailable, retain a local diagnostic
and let later recovery inspect canonical state.

The resolver currently receives `{ app, request }` and returns a Promise of a
decision. `app-request-agent.ts` awaits `manager.callAgentDefinition` without an
input-owned cancellation signal in that path. Existing session controls can
supply the execution adapter, but the exact claim-to-execution binding must be
made explicit. A store helper for associating claim/session identity exists;
inspection found no production caller. Do not assume that binding is complete.

## 2. High priority: conversational execution can retry without a durable bound

The [request-agent adapter](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/app/app-request-agent.ts#L153)
throws when execution fails or produces no structured result.
[`reconcileOnce`](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/app/app-inbox-host.ts#L754)
catches handling errors and releases the input for retry. The default cooldown
is one second. [Release](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/app/app-inbox-store.ts#L854)
returns it to pending; the input schema has no persisted execution-failure allowance.
Task `executionFailures` added in #107 does not cover this path.

The probe uses an always-failing resolver and advances a synthetic clock beyond
the cooldown. It calls production reconciliation six times, closes/reopens the
same database, constructs a new Host, and calls it six more times:

```text
before reopen: resolver calls=6,  input status=pending, no result
after reopen:  resolver calls=12, input status=pending, no result
```

This is database/Host reconstruction within one process. It uses no model,
provider, live input, or real-time retry cadence. The unbounded-retry conclusion
comes from both the release path and repeated persisted-state behavior.

**Proposed default for review:** Failed or invalid completed direct conversational
execution records a truthful failed handling outcome and releases the
Conversation. Another human turn or explicit retry can continue. The accepted
ask remains unresolved. Cheap pre-execution coordination retries can stay.
If automatic execution retries prove worthwhile, bound them durably on the
existing input; do not wrap each conversation turn in a Task.

Scope this change to direct conversational handling first. Task callers and
retained child waits have different completion semantics. An internal `done`
row means handling ended, not that a human ask was fulfilled. Expose failure
explicitly and verify that dependent consumers cannot mistake it for success.

## 3. Accepted interaction design is ahead of source

| Gap | Source evidence | Minimum useful implementation |
| --- | --- | --- |
| Stop/Steer this turn | Conversation messages wait behind the active input claim; low-level session cancel reaches the error/retry path above. No public durable exact-turn Stop contract exists. | Persist Stop against the observed turn/claim before aborting its execution. Fence late effects and recovery. Reuse event control and existing adapters. |
| Accepted Request identity and closure | [Conversation schema](https://github.com/hao1939/may-agent/blob/6dcb0fa3/src/lib/db/schema.ts#L196) stores Topics and Task links; input rows precede intention recognition. Neither records the revised accepted ask and its closure. | Retain accepted-ask identity, current scope/revision, Conversation and Task references, and closure with its explanation. |
| Human follow-through on linked work | [May App at the reviewed workspace revision](../../../../may.app/app.ts) already declares `conversation/follow-up` to read exact linked Tasks and no-op, steer, or report. | Extend this existing path with bounded open-Request context and closure, keeping App judgment outside Host storage. |

The App link above is a workspace navigation link; the comparison used its
committed `9d70928053` contents. It is not evidence about a running installation.

Implement durable Stop before richer steering. Persist corrections and continue
in a new bounded execution when live steering is unavailable. Do not create a
Request controller or a Task per ask. An open Request must not automatically
restart a stopped turn. A Task handoff does not close the ask; discussion can
close it without any Task. A stale closure must not override revised scope.
See the owning [human-control](../../2a-design/human-control-surfaces.md#current-turn-control)
and [message-lifecycle](../../2a-design/message-lifecycle.md#current-implementation-and-gaps)
contracts for full acceptance requirements.

## 4. Existing Task mechanisms deserve preservation

The focused runtime checks passed for missing/restored execution capabilities,
exact executor cancellation, durable retry exhaustion, and parent-owned repair.
#110's two cases exercise the existing parent receiving exhausted child facts,
repairing a prerequisite, unblocking the same child, and separately accepting
the aggregate outcome before caller completion. One case reconstructs the
database/runtime. These are scripted mechanism tests, not proof of model policy.

Task cancellation and parent-owned repair already work through the current
controller/state boundary. #111's finite-Task non-success stop is separate pending
work. Do not duplicate it or claim it supplies current-turn Stop and Request closure.

## 5. Performance and layout: measure before expanding the work

The recovery query uses indexed branches, a UNION, sorting and a final limit.
The [existing query probe](core-simplicity-review-20260910/recovery-query-probe.ts)
was rerun at `6dcb0fa3` with a fixed return limit of 256:

| Eligible Task backlog | Returned | Median, five samples | Query plan |
| --- | --- | --- | --- |
| 256 | 256 | 1.25 ms | Includes temporary B-tree sorting |
| 20,000 | 256 | 24.02 ms | Includes temporary B-tree sorting |

A limited result count does not bound query work. These synthetic, in-memory,
single-process measurements do not establish production latency or a current
bottleneck. Normal recovery already uses event wakes and a nearest-due timer,
with a default 45-second safety query. Measure representative retained state and
control responsiveness before changing indexes/query structure.

Large files remain: `app-task-runtime.ts` has 3,516 lines,
`app-task-reconciler.ts` 4,306 and `app-inbox-host.ts` 1,376 at this baseline.
Size alone does not select a useful extraction. Keep one owner for each
transition, extract coherent operations when they remove duplicate decisions,
and preserve the existing core/adapter/composition direction.

Failure visibility can improve within these slices: input errors currently
surface through info messages, while controller failures carry a legacy
`source: "cron"` field. Retain exact correlation and honest retry disposition in
existing event/operation reads. A new metric service is not required to fix
these failures; the broader error-App discussion remains paused.

## Verification and reproduction

**Focused source tests: 111 passed, 0 failed, 428 assertions.**

- 105 tests across App registry/validation, EventBus, controller, atomic request
  state operations, reporting, startup composition and Host capacity.
- Six Task runtime tests covering the cases above; 105 unrelated runtime tests
  were filtered out.

Commands used from the reviewed Host checkout:

```sh
bun test src/app/core/apps/registry.test.ts src/app/core/apps/definition-validation.test.ts src/app/core/events/bus.test.ts src/app/core/tasks/controller.test.ts src/app/core/state/requests.test.ts src/app/composition/reporting.test.ts src/app/composition/background-startup.test.ts src/app/host-capacity.test.ts
bun test src/app/app-task-runtime.test.ts --test-name-pattern 'omitted workflows|aborts the exact registered executor|recovers a restored named executor|stops controller retries durably|lets an existing parent repair'
```

The [input probe](core-implementation-alignment-20260910/input-boundary-probe.ts)
accepts a Host source root, a fresh temporary database filename, and a mode.
Use a checkout with its dependencies installed at the reviewed revision:

```sh
bun <probe-file> <host-source-root> <new-temporary-db-file> retry
bun <probe-file> <host-source-root> <another-new-db-file> renewal-control
bun <probe-file> <host-source-root> <another-new-db-file> renewal-daemon
```

`renewal-daemon` intentionally exits 1 on the reviewed source. Never pass a live
database. The [normalized evidence](core-implementation-alignment-20260910/evidence.json)
records outcomes and query samples; temporary databases and bulky logs are not
part of this archive.

These checks do not replace full CI, executor/provider tests, live App judgment,
or deployment verification. No Host implementation or live state was changed.
