# Scheduling And Observation

**Design status:** Accepted.
**Implementation status:** Shared scheduler implemented; canonical App
input/event schedules are implemented while legacy cron handlers are being
removed from App-owned work.

## Purpose

Time is a wake source, not a work authority. The shared runtime owns timer
mechanics; each App declares what a due slot means.

```text
due slot -> App input admission
         -> fact publication
         -> bounded observer run -> facts
```

Schedules never directly launch an agent or workflow. Model execution begins
only after an admitted App request or persisted task reconciliation requires it.

The scheduler implementation retains the historical internal name `Cron`, and
the long-running CLI flag remains `--cron`. Those names do not expose cron
handlers as the canonical App authoring model.

## One scheduler

One process-wide scheduler owns:

- interval calculation, jitter, and restart-safe next-fire state;
- timer registration and replacement during atomic App reload;
- bounded dispatch and lifecycle metrics;
- event-schedule publication; and
- observer cadence.

App loading prepares a prospective complete schedule set. The registry and
scheduler publish it atomically only after every App definition validates. A
failed reload keeps the previous generation active. Repeated reload cannot
duplicate timers or subscriptions.

Only the long-running host starts the scheduler. Direct, Gym, test discovery,
read-only CLI, and Web UI processes may load App definitions but cannot fire
their schedules or claim autonomous work.

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

The host validates the input against the App schema and derives idempotency from
App ID, schedule ID, and slot. `latest` may admit only the newest missed slot
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

The shared event runtime persists the fact. A declared task subscription may
resolve it to `TaskIntent`; otherwise it remains observation only. No inbox item
or owner session is manufactured. Event schedules do not replay missed facts.

## Observers

An observer periodically reads external state and returns semantic facts:

```ts
const providerObserver: AppObserver = {
  id: "provider-state",
  intervalMs: 300_000,
  async run(ctx) {
    const state = await readProviderState();
    ctx.log.info(`observed provider revision ${state.revision}`);
    return [{
      type: "sample.provider.observed",
      data: state,
      target: { appId: "sample", project: "sample" },
    }];
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

## Choosing the route

| Timed responsibility | Canonical declaration |
| --- | --- |
| Every due slot requires independent judgment/result | Input schedule |
| Time wakes one standing desired outcome | Event schedule -> task subscription |
| Time publishes a diagnostic/lifecycle fact | Event schedule -> observation only |
| Time must first read an external provider | Observer -> facts |
| Time repairs generic runtime mechanics | Internal runtime maintenance, not an App schedule |

A scheduled “owner request” that deterministically selects the same standing
task is a task-wake event, not an inbox input. Conversely, a real periodic
review whose result must be tracked independently is an input schedule even if
the source is the system rather than a human.

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

Scheduler failure is operational evidence. It does not create an App owner
request by default. Runtime health surfaces missed/late fires, registration
failure, observer error, and publication/admission failure.

On restart:

- input schedules apply their declared catch-up policy;
- event schedules resume without replay;
- observers run from current external state rather than reconstructing a fact
  backlog; and
- existing App inbox/task state recovers independently of the scheduler.

An observer or event-schedule failure may be retried mechanically within a
bounded host policy. Persistent ambiguity becomes runtime attention; it cannot
silently start an owner agent.

## Legacy cron compatibility

Historical `cron.json`, named handlers, workflow-backed handlers, and
auto-heartbeats remain only for genuinely standalone agent/system duties. App
schedules, observers, and task resync are hosted directly by the canonical App
runtime; cron handlers cannot own App requests or task wakes.

Each App migration classifies every legacy entry as:

- input schedule;
- event schedule;
- observer;
- shared runtime maintenance;
- explicit offline maintenance CLI; or
- deletion because another canonical route already owns it.

No legacy handler may run in parallel with its canonical replacement. App code
must not add new `cron.json`, direct handler-to-agent dispatch, or
`createWorkflowHandler` routes.

## Metrics

The runtime records generic scheduling health: due/late fires, admission and
publication latency, observer duration/failure, duplicate registration, and
restart catch-up. Apps record domain measurements through their observer or
workflow metric capability.

Metrics observe the scheduler. A metric breach becomes a fact and follows the
normal App/task/observation classification; it is not a second scheduler.

## Integrity checklist

- One shared scheduler owns timer mechanics for all canonical Apps.
- Every App schedule has exactly one input or event destination.
- Input schedules create correlated inbox obligations; event schedules create
  facts and no callerless inbox items.
- Observers return facts and never launch model work or mutate durable state.
- Timer/task coalescing happens only after current intent and trigger evidence
  are durable.
- Reload is atomic and cannot duplicate timers, observers, or subscriptions.
- Only the long-running host fires schedules.
- Legacy cron handlers never dual-consume work with canonical routes.
