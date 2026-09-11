# Metrics And Alerts

**Design status:** Accepted.
**Implementation status:** `MetricService` and App/workflow-owned measurement
are implemented, and Cron is the sole Host snapshot scheduler. Host Operations
still carries a legacy central catalog for Host measurements and domain metrics
not yet moved to their Apps. That remaining authority gap is tracked in the
convergence tracker. The expanded default core-metrics proposal and later
App-subscriber alternative are [archived](../archive/reviews/error-handling-and-conversation-discussion-20260910.md).
The narrower [workflow tracing and health metrics proposal](../proposals/workflow-tracing-and-health-metrics.md)
is now under review; it does not change the accepted contract or activation.
Its [first source slice](../proposals/workflow-tracing-and-health-metrics.md#first-implementation-candidate)
at Host `15b88dbd` adds optional workflow outcome observations and richer metric
reads. It is not deployed; the existing contract below remains the baseline.
An [isolated PoC](../archive/reviews/default-error-metrics-poc-20260909.md) tested a
Task-attempt collector; it is unpublished and does not change current activation
or reporting requirements. The existing metric service contract below remains
accepted.

## Purpose

Metrics are observations about health, progress, quality, or blind spots. They
do not own work and do not decide what an App should do.

```text
App declaration, observer, or workflow
  -> define a metric
  -> Runtime source measurement or App code records an observation
  -> evaluate its alert rule
  -> metric.breach or metric.recovered fact
  -> any explicitly declared App route may react
```

A breach means “inspect this evidence,” not “the project failed.” A recovery
means the alert rule no longer matches, not “all related work is complete.”

## Default failure visibility

The candidate keeps measurements outside core execution: the optional source
sampler installs done/error/blocked/interrupted run-count definitions, without
new timers or automatic alerts. Each sample states its time, retained finished
cohort and denominator; zero sample size is no activity, not proven health.
SDK metric reads expose the latest retained observation's value, `measuredAt`,
`sampleSize`, `note` and `measureInterval`. With no retained observation, value
and evidence are null rather than presenting a cached number as freshly measured.
The definition's `status` remains its lifecycle, not a health verdict. Source
errors preserve prior samples. The sampler emits `metric.measurement.failed`
into the existing Event journal with the metric ID, snapshot-trigger event ID
when present, and a known-secret-redacted reason capped at 2,000 characters.
This is an observation, not a sample, alert, or automatic request for work;
it follows normal Event retention. If journal storage itself fails, the sampler
logs that limitation and continues with other sources. It cannot promise durable
diagnostics without working Event persistence.

Users should get useful error handling and visibility without assembling a
complex system. This remains a product goal. Whether default collection and
investigation belong in core or an ordinary App is deferred; default does not
by itself mean core. The [archived discussion](../archive/reviews/error-handling-and-conversation-discussion-20260910.md)
retains the simple `onError -> event -> App subscriber` alternative.

Current core work preserves truthful execution outcomes and failure evidence.
Measurements should retain recovered failures, distinguish attempt outcomes from
Task outcomes, and state their window, denominator, freshness and coverage.
Unavailable evidence is unknown, not zero; an interruption alone is not a proven
error. Follow the [definition contract](#definition-contract).

A broken collector or investigation must not roll back accepted results or stop
unrelated work. Expose missing or stale observations and reuse retained evidence
where possible. These properties do not require a new telemetry queue or error
framework. Code records observations and evaluates declared rules; Apps and LLMs
interpret uncertain causes and decide whether improvement is worth its cost.

## Public App capability

The supplied metric capability is the supported interface:

```ts
interface MetricService {
  define(definition): void;
  defineMany(definitions): void;
  record(id, value, options?): void;
  evaluate(id?): MetricEvaluationResult[];
  alert(id, message, options?): void;
  resolveAlert(alertId, reason?): void;
  get(id): Metric | null;
  list(filter?): Metric[];
}
```

Apps use this capability rather than writing metric tables directly. The
implementation authority is `projects/may-agent/src/lib/metrics.ts`; schemas
remain authoritative for stored columns.

Stable deterministic sources may be declared directly on `defineApp` through
`metrics`. Runtime installs those definitions when the App generation becomes
current and measures `sourceQuery` or `sourceCommand` on the shared Host
snapshot event. This path creates no Task and calls no agent. A query may return
`value` plus optional `sampleSize`, `measuredAt`, and `note` columns so the
sample retains its evidence.

`measureInterval` is the metric's minimum normal sampling cadence. The shared
five-minute event only checks what is due; it does not force every source to
run. Runtime keeps this optional cadence gate in memory, so a restart may take
one harmless early sample. An explicit forced snapshot bypasses the gate.

Example:

```ts
ctx.metrics.define({
  id: "scout.source-check-failures",
  owner: "scout",
  project: "scout-knowledge-lib",
  type: "counter",
  threshold: 3,
  alertOp: ">",
  priority: "P1",
});

ctx.metrics.record("scout.source-check-failures", failures, {
  sampleSize: checks,
  measuredBy: "scout-source-observer",
});

ctx.metrics.evaluate("scout.source-check-failures");
```

In the accepted model there is no global `ALL_METRICS` catalog or special
metrics-snapshot owner. Definitions live with the App code that understands
their meaning. The current legacy catalog is a migration gap, not a second
accepted authority. Current definitions and values live in `metrics`;
historical samples live in `metric_snapshots`; unresolved alert state lives in
`metric_alerts`.

## Definition contract

Every useful metric should make these points clear:

- the question it answers;
- its owner and optional project;
- its source, sampling window, and blind spots;
- its threshold/direction and priority;
- whether it should alert or only be observed; and
- what evidence explains or closes an alert.

Supported metric kinds are `gauge`, `counter`, `health`, and `derived`.
Threshold evaluation is below (`<`) or above (`>`). More specialized rate,
stall, sustained, or consecutive-failure behavior belongs in the definition's
typed configuration and is evaluated by the same service.

A change in meaning requires a new metric ID or an explicit cutover. Retiring
a metric preserves its history, stops new measurement, and resolves or
explains its open alerts.

## Ownership and routing

The metric service resolves an owner from explicit definition data, project
context, and bounded naming conventions. This is alert attribution, not an
implicit event consumer.

`metric.breach`, `metric.recovered`, and `metric.stalled` are facts. An App
reacts only when its `defineApp` declaration contains a matching event or task
selector. There is no generic owner inbox fallback and no automatic task per
alert.

A matching route may:

- ask an owner to investigate;
- create or revise meaningful domain work;
- repair broken observation or execution;
- calibrate, retire, or replace the metric;
- record an accepted exception; or
- escalate a decision across an ownership boundary.

Task Conditions remain based on their declared watcher or semantic evidence.
Metric age or alert state does not silently satisfy them.

## Measurement placement

Put a measurement beside the code that can state what it means:

- an App declaration defines a deterministic stored query or command;
- an App observer measures external or project state;
- a workflow records evidence produced during one bounded attempt;
- deterministic Host instrumentation measures runtime mechanics; and
- a derived metric reads other stored observations without pretending to be
  their owner.

Measurement must be bounded and independently failure-safe. One broken metric
must not block unrelated App work. Database retention, filesystem pruning, WAL
maintenance, and compaction are Host maintenance, not metric work; see
[storage.md](storage.md).

A collector must not repair the evidence it is measuring. In particular,
missing session lifecycle events remain visible findings; recording a snapshot
cannot synthesize `session.end` rows to clear them. Session lifecycle and
recovery code own any separately justified repair through normal persistence.

A periodic measurement trigger is a record-only fact. It queues measurement
for a later event-loop turn and never accepts semantic event delivery; the next
cadence repairs a missed optional observation.

## Interpretation

Useful categories include:

| Category    | Question                                                           |
| ----------- | ------------------------------------------------------------------ |
| Host        | Are admission, persistence, scheduling, and recovery operating?    |
| Execution   | Are bounded attempts starting, finishing, and recovering honestly? |
| Domain      | Is an owned external or project fact outside its expected range?   |
| Outcome     | Is completed work producing the intended effect?                   |
| Meta-metric | Is measurement stale, pinned, noisy, or structurally invalid?      |

Activity is not impact, and an all-green view is not proof that useful work is
happening. Confirm domain conclusions with project facts, task Conditions,
attempt results, sessions, and traces. Default uncertain project/content
metrics to observation until evidence shows an alert improves decisions.

## Operational handling

Use [metric-alerts.md](../2b-manual/metric-alerts.md) to inspect a breach. Keep
the sequence simple:

1. verify the source and freshness;
2. inspect the owning project's current evidence;
3. choose one concrete response;
4. record the action or reason; and
5. resolve the alert only when the stated recovery evidence exists.

Metrics provide observation. Apps retain judgment and ownership.
