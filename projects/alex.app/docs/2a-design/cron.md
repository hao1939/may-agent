# Scheduling And Observation

**Supports:** [Events And Task Admission](events.md). Provides declared observations and due inputs without a second work scheduler.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Accepted.
**Implementation status:** Daemon Task activation and recovery are independent
of `--cron`, which enables optional App schedules. Input/event schedules and
observers use the canonical App runtime. Fixed retention, watchdog/liveness
checks and metric sampling remain Host code. Configurable `cron.json` handlers,
maintenance reload/API wiring and the cron editing tool are retired.

## Purpose

Time is a wake source, not a work authority. The shared runtime owns timer
mechanics; each App declares what a due slot means.

Under the accepted [one-lifecycle baseline](task-resource-engine.md#one-lifecycle-baseline),
ordinary work, maintenance and Conversation use the same Task engine. Any may
receive timer input; none needs it merely to remain open. Quiet Tasks do not
trigger model work. An owner closes a Task explicitly, and later timer input
cannot reopen it. Shared execution and explicit closure are implemented in #158.
New Task intent has no mode; mode fields in older persisted records are
compatibility evidence.

```text
due slot -> publish required App-input event
         -> publish record-only fact
         -> bounded observer run -> facts
fixed Host timers -> retention/liveness/metrics
```

Canonical App schedules never directly launch an agent or workflow. Execution
begins only after durable input is admitted to a Task and a bounded attempt is
claimed. Fixed Host upkeep has no App authoring or reload surface. There is no
`HostMaintenance` adapter or public cron tool; nonempty or malformed retired
`cron.json` declarations fail loading. The `--cron` flag controls App schedules,
while Task recovery and required housekeeping remain independent.

## Shared timing, separate responsibilities

Share timer registration, replacement, cancellation, and cleanup. This does not
require one physical timer, a scheduler registry, or a universal job protocol.
Producers retain interval/slot meaning and successful-publication semantics;
observers recollect external facts; private maintenance owns its own cadence;
Task recovery rereads indexed authoritative deadlines. Timing mechanics dispatch
bounded callbacks and do not own outcomes or acceptance.

Shared timing lives in `src/app/core/scheduling/timer.ts`. Its callers retain
slot semantics and domain ownership. The [implementation record](../archive/implementation/core-separation-review-20260910.md#step-4-implementation-shared-timing)
preserves the separation proof.

App loading prepares a prospective complete schedule set. The registry and
scheduler publish it atomically only after every App definition validates. A
failed reload keeps the previous generation active. Repeated reload cannot
duplicate timers or subscriptions.

Only the long-running host starts the scheduler. Direct, Gym, test discovery,
read-only CLI, and Web UI processes may load App definitions but cannot fire
their schedules or claim autonomous work.

The owning daemon runs Task controllers and required recovery with optional
schedule publication disabled. Declared event
routes and observers remain active, admitted work is retained, and explicitly
disabled handlers stay disabled. Startup and definition reload use the same
activation choice. Inbox schedules, observers and recovery retain their own
registrations while reusing shared timer lifecycle mechanics.

## App schedules

The public declaration is a discriminated union:

```ts
type AppSchedule = {
  id: string;
  enabled?: boolean;
  intervalMs: number;
} & (
  | {
      input: AppInput;
      catchUp?: "none" | "latest";
      event?: never;
    }
  | {
      event: AppEvent;
      input?: never;
      catchUp?: never;
    }
);
```

The host rejects missing or ambiguous destinations.

### Input schedule

Use an input schedule when each admitted slot creates a distinct App
obligation that deserves its own correlated disposition:

```ts
{
  id: "weekly-owner-review",
  intervalMs: 7 * 24 * 60 * 60 * 1000,
  input: { kind: "owner-review", data: { lane: "weekly" } },
  catchUp: "latest",
}
```

The Host validates the input, derives idempotency from App ID, schedule ID, and
slot, and publishes `app.input.requested`. Its standard required route creates
the linked App request. `latest` may admit only the newest missed slot
after downtime; `none` resumes from the next live slot. Catch-up never replays
an unbounded backlog.

### Event schedule

Use an event schedule when time merely publishes a fact or wakes deterministic
desired task work:

```ts
{
  id: "pipeline-review",
  intervalMs: 300_000,
  event: {
    type: "sample.pipeline.check",
    data: { reason: "scheduled" },
    target: { appId: "sample", project: "sample" },
  },
}
```

The shared event runtime persists the fact. A declared input translator may
resolve it to `TaskIntent`, or an exact target may wake its task; otherwise it
remains observation only. No caller request or agent session is manufactured.
Event schedules do not replay missed facts.

## Observers

An observer periodically reads external state and returns semantic facts:

```ts
const providerObserver: AppObserver = {
  id: "provider-state",
  intervalMs: 300_000,
  async run(ctx) {
    const state = await readProviderState();
    ctx.log.info(`observed provider revision ${state.revision}`);
    return [
      {
        type: "sample.provider.observed",
        data: state,
        target: { appId: "sample", project: "sample" },
      },
    ];
  },
};
```

Observers receive only bounded read and logging capabilities. They may call an
explicit provider adapter owned by the App, but cannot:

- launch agents or workflows;
- mutate inbox or task state;
- access raw SQL or global runtime paths;
- publish through a second side-effect path; or
- implement their own durable retry/ownership loop.

The host publishes returned facts only after a successful bounded run. Provider
poll retry and rate limits may live inside the bounded adapter; durable work
recovery remains with App requests/tasks.

## Host-private scheduled maintenance

Fixed retention, watchdog/liveness checks and metric sampling are implemented
in Host composition. They have explicit code owners, bounded/non-overlapping
runs and visible failure. Changes to these duties go through Host source review.
They do not load agent-local handlers, own domain Tasks or gain an App workflow
interface to raw SQL and runtime paths.

Domain periodic work belongs in App schedules and observers. A duty requiring
private ledger mutation belongs in fixed Host upkeep or a reviewed offline
operation. Inventory old configured duties before upgrade: move needed domain
work to its App, retain a justified Host duty in code, or deliberately retire it.
Do not silently drop a duty because the old loader is gone.

## Choosing the route

| Timed responsibility                                          | Canonical declaration                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Every due slot requires independent judgment/result           | Input schedule                                    |
| Time wakes one standing desired outcome                       | Event schedule -> exact task/Condition            |
| Time publishes a diagnostic/lifecycle fact                    | Event schedule -> observation only                |
| Time checks for missed conversational follow-up                | Event schedule -> bounded state query -> eligible conversation input |
| Time must first read an external provider                     | Observer -> facts                                 |
| Time inspects Runtime-owned ledgers or repairs host mechanics | Fixed Host housekeeping or an explicit offline operation        |
| Time repairs generic runtime mechanics                        | Internal runtime maintenance, not an App schedule |

A scheduled “owner request” that deterministically selects the same standing
task is a task-wake event, not caller input. Conversely, a real periodic
review whose result must be tracked independently is an input schedule even if
the source is the system rather than a human.

The [conversation follow-up design](conversation-execution.md#timer-safety-net)
reuses an App event schedule as a safety net. An empty pending-work query
creates no model work, and repeated ticks reuse already admitted reviews.
Removing this schedule degrades fallback discovery; required Task and inbox
recovery still use Host-owned timing. It introduces no standalone reconciler.

## Coalescing and backpressure

Timer coalescing reduces execution pressure only after the corresponding
request admission, event publication, or task intent/trigger is durable.

- Input-schedule idempotency preserves one obligation per admitted slot.
- Event publication preserves the fact before task resolution.
- Task resolution persists the newest desired intent and trigger before the
  stable task ID is coalesced in the controller queue.
- A running task receives one fresh pass after a newer trigger arrives.

Dropping a timer callback before persistence is not valid deduplication.

## Failure and restart

Scheduler failure is operational evidence. It does not create an App Task or
request by default. Runtime health surfaces missed/late fires, registration
failure, observer error, and publication/admission failure.

On restart:

- input schedules apply their declared catch-up policy;
- event schedules resume without replay;
- observers run from current external state rather than reconstructing a fact
  backlog; and
- durable App request/Task state is sufficient for recovery without replaying
  schedule slots. Daemon startup activates Task recovery/controllers whether or
  not optional schedules are enabled.

An observer or event-schedule failure may be retried mechanically within a
bounded host policy. Persistent ambiguity becomes Runtime attention; it cannot
silently start an agent.

A publication failure is not a successful scheduled slot. Keep the last accepted
slot unchanged and publish only the latest due slot on the next ordinary scan;
do not accumulate a replay queue. One failed publication must not prevent other
due schedules from being attempted or escape the timer callback and terminate
the Host. If persistence itself is unavailable, report to the process error log
instead of recursively publishing a failure through that same unavailable path.
Observers likewise contain failure-report publication errors and recollect
current provider facts on their next normal observation. This failure boundary
does not claim to eliminate database contention or accept an unpersisted fact.

## Host maintenance boundary

Apps supply meaning and periodic demand; Host code owns storage retention,
liveness and scheduling mechanics. App code cannot add `cron.json`, dispatch
agents from a handler, or create a parallel timer/recovery owner. No retired
handler runs beside its replacement.

The explicit stopped-runtime conversion procedure is owned by
[Operations and Recovery](../2b-manual/app-operations-recovery.md#upgrade-retired-task-contracts).
It preserves saved obligations; it is not a configurable maintenance service.
A recorded message or fact alone still does not prove work acceptance.

## Metrics

The runtime records generic scheduling health: due/late fires, admission and
publication latency, observer duration/failure, duplicate registration, and
restart catch-up. Apps record domain measurements through their observer or
workflow metric capability.

Metrics observe the scheduler. A metric breach becomes a fact and follows the
normal App/task/observation classification; it is not a second scheduler.

## Integrity checklist

- Owners share timer mechanics without sharing work authority or requiring one physical timer.
- Every App schedule has exactly one input or event destination.
- Input schedules create correlated requests and tasks; event schedules create
  facts and no callerless requests.
- Observers return facts and never launch model work or mutate durable state.
- Timer/task coalescing happens only after current intent and trigger evidence
  are durable.
- Reload is atomic and cannot duplicate timers, observers, or subscriptions.
- Only the long-running host fires schedules.
- Retired cron declarations reject loading rather than silently losing duties.
- Fixed Host upkeep never becomes a configurable App execution route.
