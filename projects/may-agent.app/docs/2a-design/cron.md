# Scheduling And Observation

**Design status:** Accepted.
**Implementation status:** At the [source baseline](../README.md), daemon Task
activation and startup recovery are independent of `--cron`. Shared timing
serves core duties and optional registrations. App schedules publish input or
facts; named Host maintenance has no standalone workflow execution path.
The installed maintenance App still declares metric snapshots in an agent-local
Cron job; Runtime samples App-defined sources on that event and applies each
source's cadence. This is a remaining installation coupling, not a required
named owner in the [accepted boundary](../proposals/app-policy-and-host-boundary-cleanup.md).

## Purpose

Time is a wake source, not a work authority. The shared runtime owns timer
mechanics; each App declares what a due slot means.

Under the accepted [one-lifecycle baseline](task-resource-engine.md#one-lifecycle-baseline),
ordinary work, maintenance and Conversation use the same Task engine. Any may
receive timer input; none needs it merely to remain open. Quiet Tasks do not
trigger model work. An owner closes a Task explicitly, and later timer input
cannot reopen it. Shared execution and explicit closure are implemented in
#158; removal of old SDK mode names is tracked separately.

```text
due slot -> publish required App-input event
         -> publish record-only fact
         -> bounded observer run -> facts
         -> host-private maintenance job -> evidence/facts/repair
```

Canonical App schedules never directly launch an agent or workflow. Model
execution begins only after an admitted App request or persisted task
reconciliation requires it. A Host maintenance job invokes only its explicitly configured deterministic
handler; it is not an alternative App execution route.

The scheduler implementation retains the historical internal name `Cron`, and
the long-running CLI flag remains `--cron`. Those names do not expose cron
handlers as the canonical App authoring model.

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

Some system duties cannot be honest App observers because their inputs are
Runtime-owned ledgers rather than a bounded external provider. Use an explicit
host-private scheduled handler only when the job:

- needs Runtime-private query, path, recovery, or operational-delivery ports;
- is deterministic observation, reporting, or mechanical repair rather than
  domain judgment;
- has one named owner, bounded execution, idempotent output, and observable
  failure; and
- hands any resulting domain work to a canonical App route by publishing a
  fact, never by mutating App inbox/task state.

These handlers are configured by `cron.json` and typed against a local
structural host contract. They are not `WorkflowContext` consumers, are not
exported through `@may-agent/sdk`, and cannot be invoked as App workflows.
Enabled handlers are compiled and bundled against the paired Runtime alongside
the canonical workflow compatibility gate.

`cron.json` is read at startup. The Cron tool applies an authorized edit by
calling the scheduler's explicit `reload()` boundary immediately; an external
file edit takes effect after an explicit process restart. The Host does not
poll or hash every Cron configuration in the background.

The May operations health packet and daily operations digest are current
examples: both read host-owned operational ledgers; the digest may use the host
delivery adapter; both emit facts when App-agent judgment is needed. Their
former App schedules/task routes were removed so there is only one timer and
one execution authority for each duty.

## Choosing the route

| Timed responsibility                                          | Canonical declaration                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Every due slot requires independent judgment/result           | Input schedule                                    |
| Time wakes one standing desired outcome                       | Event schedule -> exact task/Condition            |
| Time publishes a diagnostic/lifecycle fact                    | Event schedule -> observation only                |
| Time checks for missed conversational follow-up                | Event schedule -> bounded state query -> eligible conversation input |
| Time must first read an external provider                     | Observer -> facts                                 |
| Time inspects Runtime-owned ledgers or repairs host mechanics | Host-private scheduled maintenance handler        |
| Time repairs generic runtime mechanics                        | Internal runtime maintenance, not an App schedule |

A scheduled “owner request” that deterministically selects the same standing
task is a task-wake event, not caller input. Conversely, a real periodic
review whose result must be tracked independently is an input schedule even if
the source is the system rather than a human.

The [conversation follow-up design](message-lifecycle.md#timer-safety-net)
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

The Host retains `cron.json` only for named deterministic handlers.
Workflow-backed jobs and automatic heartbeat discovery are removed: model work
uses App schedules and Tasks. App schedules, observers, and task recovery are
hosted directly by the canonical App runtime; maintenance handlers cannot own
App requests or Task acceptance. When upgrading an older installation, reject
or convert obsolete declarations explicitly; do not silently drop configured work.

Composition prepares these duties independently of agent tool presets and
activates them after publication. The narrowed `cron` tool lists/statuses and
updates existing enabled/interval declarations; it does not create jobs or
author prompts. Passive maintenance buffers are bounded, best-effort observations,
never a durable-work acknowledgement. Single-flight ownership remains until a
timed-out callback actually settles. Failure diagnostics remain visible.

The message tool records `message.created` for declared routes. Priority does
not launch a heartbeat, and a recorded fact does not prove work acceptance.

Each App migration classifies every legacy entry as:

- input schedule;
- event schedule;
- observer;
- shared runtime maintenance;
- explicit offline maintenance CLI; or
- deletion because another canonical route already owns it.

No legacy handler may run in parallel with its canonical replacement. Domain
App code must not add `cron.json`, direct handler-to-agent dispatch, or
`createWorkflowHandler` routes. A new host-maintenance entry is acceptable only
under the explicit boundary above; co-location beside an App operations agent
does not make it an App route.

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
- Legacy cron handlers never dual-consume work with canonical routes.
- Host-private maintenance handlers are separately typed, bounded, and hand
  domain work to canonical App routes rather than owning it.
