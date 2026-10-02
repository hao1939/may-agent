# Metrics And Alerts

**Supports:** [System Model](system-model.md#improve-from-evidence-and-make-problems-actionable). Supplies trends, coverage and failure evidence for agents to judge worthwhile follow-through.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#simple-first).

**Design status:** Accepted.
**Implementation status:** `MetricService`, App-defined sources, exact-command
batch sampling, workflow observations and bounded reporting pages are implemented.
The maintenance App source retains a central metric catalog, and some HTTP
reports still encode named Evaluation policy. Those ownership gaps remain in
[the convergence index](../proposals/design-implementation-convergence.md).
Metrics observe work; they do not accept outcomes or choose improvements.

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

The merged source keeps measurements outside core execution: the optional source
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

Incident recovery and recurring system cost are independent observations. An
accepted result can settle current work while the same failure pattern still
warrants investigation. Current state does not erase retained failed attempts;
an aggregate finding does not itself reopen a settled Task. Show counts and
representative exact evidence together so Apps can judge significance, scope and
value. A later success on a long-lived Task establishes recovery of a particular
input only when the input or operation relationship supports that conclusion.

The [Evaluation pattern-review proposal](../../../evaluation.app/design/systemic-pattern-review-20260927.md)
applies these rules to bounded Task-attempt summaries and the existing assessment
path. Host `/api/task-attempts` exposes fixed Task-attempt cohorts; Evaluation's
existing periodic selector supplies those observations to bounded reviews.
The [connected trial](../../../evaluation.app/experiments/systemic-pattern-review-20260927/README.md)
records local deployment and the first recurrence finding. Default workflow-run
measurements alone still do not cover every native agent or Conversation attempt.

The separate [metric-review source candidate](../../../evaluation.app/design/metric-pattern-review.md)
extends the same review loop to metric subjects without requiring a Task. Its
optional Host evidence read calculates fixed-window comparisons and preserves
old/missing observations; App declarations own attention thresholds, Evaluation
owns interpretation, and May owns follow-through. It does not add a retry-count
limit. This is a paired source change, not a claim of installed review coverage.

May's [metric follow-through](../../../may.app/design/metric-condition-follow-through.md)
uses the existing Task/Condition contract. Sampling updates evidence without
invoking an agent. The metric service evaluates the rule; a new breach episode
invites investigation, and a recovery status change can update existing work.
Repeated samples and repeat notifications for an open breach do not commission
another investigation. The agent judges useful work or no change; App code binds
that judgment to its actual owning Task. When only collection remains, finish
the review rather than installing a sample-driven wait.

Requests commission work; caller Conditions observe repair results, human
decisions or a relevant status change. Host retains and delivers these facts.
An existing sample wait is retired through an explicit owner result, preserving
independent obligations. Neither a status change nor a checkpoint accepts
recovery or fulfills the original work. Current deadlines come from the linked
Task and its saved Conditions, not a historical date in a disposition fact.

Session completion is a separate observation from accepted Task settlement.
Dashboard session percentages describe model sessions only; use Task-attempt
reports for failed settlement and recurring Task cost. Neither percentage proves
that an App delivered the requested outcome.

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

The separate read-only SQLite connection described next is the intended source
contract and is implemented by Host PR #286; it is still a candidate until that
exact source is merged and deployed. The currently installed collector must not
be assumed to enforce this boundary from this document alone. Under the
candidate, Runtime opens a separate read-only SQLite connection for each source
query and closes it before using the writable metrics connection to record
samples, alerts, or measurement failures. A failed query cannot leave connection
state that affects the next metric. SQLite preparation executes the first
statement and ignores any SQL tail, so this is capability enforcement for the
executed statement, not a parser-based single-statement guarantee.

A command may also return
`{"samples":{"example.count":{"value":7,"sampleSize":10}}}`. Metrics using
that producer declare the **same exact** `sourceCommand`; the collector runs it
once per sampling pass and selects each metric by its ID. A single due metric
uses the same contract. A missing or invalid entry records a measurement failure,
not zero; undeclared entries are ignored. A failed command is not rerun for each
metric within that pass. Existing numeric and single-sample command output
remains supported; a valid top-level `value` takes precedence over an extra
`samples` field. Query-backed definitions do not execute a command as well.

The collector does not perform filename-specific rewriting of `project-metrics.ts` and
`focus-metric-sample.ts` commands. Existing individual `--json` commands still
execute as declared, but no longer receive implicit batching. A command runs in
the installation root, not its declaring App directory. A command that ships with
an App generation should therefore embed the path resolved from that loaded
App release (for example from `import.meta.dir`) when the definition is built;
it must not assume a mutable source checkout or collector working directory.
Before adopting
this collector on an installation with legacy producers, update their App
definitions and output together, and verify invocation counts/cost. No stored
commands are rewritten automatically. Source support does not prove that
installed producer definitions have changed.

`measureInterval` is the metric's minimum normal sampling cadence. The shared
five-minute event only checks what is due; it does not force every source to
run. Runtime keeps this optional cadence gate in memory, so a restart may take
one harmless early sample. An explicit forced snapshot bypasses the gate.
May declares this event in its ordinary `metric-source-collection` App schedule.
It operates while May is enabled and does not require the platform App to be
enabled. A definition or interval alone does not schedule collection: verify
recurring events and fresh retained samples after activation.

Example:

```ts
ctx.metrics.define({
  id: "scout.source-check-failures",
  owner: "scout",
  project: "scout-knowledge-lib",
  type: "gauge",
  description: "Failures among checks in this observer pass; not a lifetime total",
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

Current metric kinds are `gauge`, `counter`, `health`, and `derived`. These
describe intent and select some alert behavior; `record(id, value, options)`
stores a scalar observation. It does not enforce monotonic counters, handle
resets or store histograms. `health` and `derived` are May classifications,
not additional Prometheus numeric types.
Threshold evaluation is below (`<`) or above (`>`). More specialized rate,
stall, sustained, or consecutive-failure behavior belongs in the definition's
typed configuration and is evaluated by the same service.

A change in meaning requires a new metric ID or an explicit cutover. Retiring
a metric preserves its history, stops new measurement, and resolves or
explains its open alerts.

## Metric semantics and persistence

Use standard metric meanings while keeping the existing SQLite history. A
Prometheus-compatible type is not a requirement to install a Prometheus server.
Run records remain execution truth; `metric_snapshots` retain observations for
graphs. Both survive normal process restarts within their retention limits.
The cached `metrics.current` value is not evidence of a fresh measurement.

| Meaning | Initial use | Recording and graph rule |
| --- | --- | --- |
| Gauge: a value that can rise or fall | Current queue size, disk headroom, rolling-24h outcome counts | Store value and actual sample time. Do not sum overlapping windows as new events. |
| Counter: a cumulative total that only rises until reset | A later, explicitly process-lifetime Host measurement | State lifetime and reset boundary. Only calculate rates across understood resets; pruning retained runs must not reduce a purported counter. |
| Histogram: a distribution of observations | Later duration aggregation, if raw queries become too costly | Preserve bucket boundaries, bucket counts, total count and sum together. State unit, scope and interval/cumulative lifetime. The scalar API cannot yet represent this. |
| Derived value: a calculation over a stated population | Successful executions / finished executions | Calculate numerator and denominator from the same cohort; zero denominator means no percentage. |

The four `workflow.<outcome>-count-24h` definitions are correctly **gauges**.
Do not rename them to cumulative counters or apply counter-rate formulas to
their history. Their independent samples are not one atomic population.
For an exact outcome summary, reporting reads all outcomes and the denominator
from one database snapshot with fixed `[start, end)` bounds and scope.

Initially calculate run duration from retained start/end timestamps, excluding
invalid or missing pairs with the exclusion count visible. Label any statistic
precisely (for example, mean duration), not as an unexplained performance score.
Historical samples and retained runs can support useful time-axis graphs now;
do not add generic bucket storage or rollups just to draw them. A graph of a
rolling count must say so; it is not a count of new events per chart interval.

If a measured need later warrants histogram persistence, design that one
storage/read extension first. Merge only compatible boundaries and scopes;
do not sum successive cumulative snapshots or average stored percentiles.
An average alone loses the distribution. Each observation must enter an
aggregate once, including across refresh or restart; replaying retained runs
into an ever-growing registry would double-count them.

Keep series few and predictable. Use bounded dimensions such as declared App,
workflow and outcome; inspect individual runs through evidence links, not
run-ID labels. Prompts, free-form errors, personal paths and credentials must
not become labels or metric names. Existing definitions/documentation can
state meaning; this does not introduce a generic label or type framework.

### Prometheus client: useful helper, not the database

When recording a real cumulative/distribution measurement or supplying a
Prometheus export, prefer a maintained client over hand-written bucket or
exposition code. As checked on September 11, 2026, the former `prom-client`
project publishes as [`@prometheus-io/client`](https://github.com/prometheus/client_js)
(version `0.16.1`; [rename and runtime requirements](https://github.com/prometheus/client_js/blob/v0.16.1/CHANGELOG.md)).
Its registry lives in memory. JSON/text export does not persist a time series
or provide restart recovery. A short-lived worker may exit before collection.

Keep any client private to the optional reporting adapter, with its own
registry. Apps retain `MetricService`; core execution imports no client types
and never depends on a registry update. For workflow metrics, derive from
stored run facts rather than dual-writing completion into an independent
counter. Do not serialize private registry internals or add worker/cluster
registry coordination to imitate durable storage.

The first page refinement needs neither a client dependency nor another
service: SQLite already records the gauges and source evidence it needs.
Add the client with a concrete histogram/export consumer and verify Bun
compatibility, reset behavior, cardinality and cost for that use. Do not
enable all default process collectors without checking their relevance and
runtime support. Prometheus/Grafana remain optional future readers/backends,
not prerequisites for running May or viewing its current history.

### Bounded reporting reads

The reporting implementation keeps read calculations in optional Host reporting adapters;
HTTP and browser consumers share them. Apps still use `MetricService`.

- Workflow summaries use one SQLite read snapshot and fixed `[start, end)`
  bounds. Top-level runs are the default; including nested runs is explicit.
  Filter by recorded App, workflow and source identity. The outcome selector
  filters the run list, not the balanced summary's denominator or duration
  population. Running executions are a current count, not a historical one.
- Interactive windows are at most 90 days, groups at most 100 and run pages at
  most 50. Group truncation does not truncate the total. End-time/run-ID cursors
  preserve equal-time rows. Invalid durations and unknown outcomes are visible;
  undated finished runs are counted only when their start is in the window.
- Latest observations use sample time, then sample ID to break ties. Missing
  retained history is unknown, regardless of the cached value. Freshness is
  unknown without a positive cadence or for a future-dated observation; after
  two declared sampling intervals it is stale. This tolerance is a display
  heuristic, not proof of Host health or an automatic alert rule.
- Threshold comparison, disabled-alert policy and the latest retained
  collection error remain distinct. P3 priority alone does not mean watch-only.
  A newer sample shows recovery from the prior collection failure without
  deleting its Event evidence; retention still limits that evidence.
- Disabling an alert rule suppresses its derived warning, not its raw threshold
  observation or a retained open alert. Editing the definition does not resolve
  an alert; project and Host cards must keep that recorded alert visible.
- A capped global alert list cannot establish that an unlisted metric has no
  alert. Its alert state is unknown until the exact metric read, which filters
  alerts by that ID before applying the limit and selects the newest one.
- Definition lists cap at 500. History caps at 2,000 samples and 2,000 failure
  events within the selected window, returning the newest subset in time order
  with visible truncation. History and a current read need not share a snapshot.
- Agent/project subsets of a truncated definition list are also incomplete.
  Show partial-data warnings and subset counts, retain visible breaches, and
  never infer no owned metrics or no breaches from omitted definitions. Exact
  metric-ID reads filter before the cap; complete owner/project browsing remains
  outside this bounded view.
- A sample links to a known workflow population only for one of the four
  supplied definitions while its source query remains unchanged. Its link uses
  the sample's observation time, not today's moving window. Re-reading retained
  runs can differ after late settlement or retention; it does not recreate an
  immutable historical population. Arbitrary metric names imply no such link.

These are interactive-view limits, not a complete bulk export. The implementation
adds one workflow end-time index and partial indexes on open alerts ordered
globally and by metric. Resolved history is excluded from those indexes; the
read need not scan or sort that history. No alternate outcome store, registry
or alert-retention policy is introduced.

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

An existing `alertId` groups an ongoing breach across repeated measurements.
Resolution ends that recorded episode; a later breach has a new ID. Resolution
may be manual or configuration-driven, and neither it nor a lower aggregate
proves an affected request was fulfilled. Apps may connect multiple episodes to
one investigation after judging its scope.

Accepted Task facts retain the owner's metric disposition and exact linked work.
The `metric_dispositions` view projects those facts without a new decision store;
the metric evidence endpoint, dashboard and daily digest use it. A published
Evaluation report and an unaccepted execution result are not owner decisions.
The Host indexes candidate attempts before expanding their facts, then applies
the same accepted-fact validation. Exact metric reads must not expand every
Task attempt as history grows; the index changes read cost, not authority.
The App workflow prepares a disposition for ordinary Task result acceptance and
uses the same linked-work reader for direct alerts and Evaluation intake. See
[metric pattern review](../../../evaluation.app/design/metric-pattern-review.md#breach-identity-and-retained-response)
for the fact contract, bounded history and responsibility rules.

### Task-attempt public reporting

`GET /api/task-attempts?appId=example&end=<epoch-ms>` reads two adjacent
24-hour started-at cohorts from one snapshot. Optional `windowMs` is bounded to
seven days per cohort; optional `taskId` adds exact-Task and other-Task rows.
A terminal outcome counts only when finished before that cohort's cut.
`terminal = completed + failed + interrupted`; failure is a subset, and no
activity has no percentage. Undated terminal outcomes and unknown durations are
reported independently. Nested sessions/workflows are evidence, not extra attempts.

With `appId`, `taskId`, and `attemptId`, the same endpoint reads the exact retained
attempt and bounded canonical session/workflow links, including unsuccessful
settlement. Missing identities are unavailable, not guessed from event payloads.
Group/example limits are in the response. The Host reports frequency and recorded
wall time; Apps judge cause, usefulness, cost and whether action is worthwhile.
The first implementation uses indexed App reads without a cache or rollup.
