# Core implementation after #111 and #112 — September 10, 2026

**Historical context:** [Architecture](../../2a-design/architecture.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Dated source review, retained as evidence. The
[active improvement plan](../../proposals/task-runtime-organization.md) owns next
steps and the [human-control design](../../2a-design/human-control-surfaces.md#current-turn-control)
owns the accepted Esc/button interface.

Reviewed Host `main` at `b81a5d622bd1d2990d483d1b536a228b4f9b3157`, including
finite Task stop (#111) and conversational ownership/Requests/Stop (#112).
[Revisions](core-implementation-post112-20260910/revisions.txt) record the checkouts
at the original review. No product source or live state was changed by the probes.
This evidence was copied from the external review archive during doc refinement;
these tests were not rerun for that documentation change.

## Assessment

The four core responsibilities remain appropriate. Registration/admission,
events, SQLite authority and the Work runtime already implement their principal
boundaries. The remaining work is small correctness fixes and clearer human
controls; this review found no reason for an API server or a replacement controller.

Merged source includes finite non-success Task stop, input-lease renewal
containment, bounded failed conversational outcomes, exact durable turn Stop,
and accepted Request scope/revision/link/closure records. Closure is stored
with its explanation; completing an inbox input does not fulfill its Request.
May App guidance already uses these records. Tests of stored App decisions do
not prove the quality of model judgment in real discussion.

## Reproduced failure boundaries

Each mode used the production registry, inbox, event and storage paths with a
temporary SQLite database and fake resolver. Temporary process handlers recorded
escaped errors; the probes did not run against a live daemon.

| Injected fault | Observed escape | Source at the reviewed revision |
| --- | --- | --- |
| One ready-work SQLite read fails | `uncaughtException` | `app-inbox-runtime.ts:751`, through timer callback at line 714 |
| One dependency-recovery SQLite read fails | `unhandledRejection` | `app-inbox-host.ts:753`; detached promise at `app-inbox-runtime.ts:790` |
| A failed turn cannot persist its diagnostic `info` event | `unhandledRejection`; two persistence attempts | `app-inbox-runtime.ts:702` and catch at line 760 |

The daemon's `uncaughtException` handler closes databases and exits with code 1
(`daemon-lifecycle.ts:189`). Its unhandled-rejection handler logs without exiting;
the last two probes therefore do not prove a daemon crash.

In the ready-read path, work starts before the readiness read; completion and
cleanup handlers attach afterward. Catching only the outer timer cannot repair
that ordering: local active-count cleanup can be skipped. Attach cleanup first,
guard rescheduling, handle the entire detached recovery promise, and use a
best-effort local diagnostic fallback independent of the failing event store.
The probe observed released HostCapacity in all three modes, but did not prove
recovery of every local runtime counter or progress in another Conversation.
Those are acceptance criteria for the fix, not results of this review.

The [portable probe](core-implementation-post112-20260910/failure-probe.ts) runs
from the Host repository. In the normal workspace layout:

```sh
cd projects/may-agent
bun ../may-agent.app/docs/archive/reviews/core-implementation-post112-20260910/failure-probe.ts ready-read
bun ../may-agent.app/docs/archive/reviews/core-implementation-post112-20260910/failure-probe.ts dependency-read
bun ../may-agent.app/docs/archive/reviews/core-implementation-post112-20260910/failure-probe.ts report-write
```

Exit zero means an escaped failure was observed, not that containment passed.
Use an isolated checkout of the recorded revision to reproduce historical
behavior after the production fix changes these paths.

## Other findings

Console `/stop` uses the exact observed turn/revision and persists Stop before
abort. Telegram lacks a turn Stop control, and Console has no Esc binding.
Ordinary input queues behind the current turn. Task cancellation and watch
controls are separate. These facts motivated the now-accepted Esc/button design.

The controller has a best-effort `onError`; runtime wiring emits `handler.failed`
with `source: "cron"` and string-encoded work/retry details (`app-task-runtime.ts:2669`).
Inbox reporting uses free-form `info`. Existing events/readers can expose exact
work identity, failure stage and disposition without a new metrics service.

The controller is 257 lines; Task runtime/reconciler and inbox runtime are much
larger. Size alone is not a defect. Extract coherent failure or transaction
boundaries when that removes duplicated decisions. Recovery uses indexed union
and ordering before a result limit (`app-task-resource-store.ts:1004`); a bounded
page is not proof of constant query cost. No new workload benchmark ran here.

## Focused verification

[The retained log](core-implementation-post112-20260910/focused-tests.txt) records
229 passing tests, zero failures and 1,612 assertions across 10 files:

```sh
bun test --timeout 30000 \
  src/app/core/apps/registry.test.ts \
  src/app/core/events/bus.test.ts \
  src/app/core/tasks/controller.test.ts \
  src/app/core/state/requests.test.ts \
  src/app/app-task-runtime.test.ts \
  src/app/app-inbox-failure.test.ts \
  src/app/app-inbox-ownership.test.ts \
  src/app/app-turn-control.test.ts \
  src/app/conversations/requests.test.ts \
  src/app/composition/reporting.test.ts
```

The three fault probes expose boundaries outside those passing checks. These
are focused source checks, not full Host CI, model evaluation or deployment proof.
The older [pre-#112 review](core-implementation-alignment-20260910.md) records
renewal/retry failures that have since been fixed; do not treat them as new defects.
