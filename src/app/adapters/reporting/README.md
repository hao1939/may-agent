# Reporting

Reporting exposes observations; it does not accept or close App work. App
definitions own domain measurements and alert thresholds. The source collector
in `../../metric-source-measurement.ts` executes declared sources and preserves
sample evidence and failures.

## Direct SQL pass evidence

`metric.source-query-worst-ms` notes retain a versioned `cohort` alongside the
three slowest `examples` (a preview only). Historical notes without a cohort
remain historical previews, not complete cohorts. `preview: "top-3"` describes
intentional selection, not loss: `examplesTruncated` is true only if a selected
preview was dropped for space. `cohort.status`, `attempted`, `retained` and
`dropped` reconcile the actual invocation evidence independently. This does not
change reuse eligibility.

Cohort v1 has one prefix-compressed `ids` pair per invocation: prefix length
from the preceding decoded ID, then suffix. `fingerprints` holds normalized SQL
SHA-256 identities (first 64 bits, base64url); no SQL, binds or results are stored
in the cohort. Each `entries` tuple is `[fingerprintIndex, startOffsetMs,
durationMs, outcome?]`, where omitted/0 is success, 1 failure, 2 BUSY and 3 LOCKED.
Offsets and durations have 0.01ms precision. `decodeQueryCohort` expands this wire
format. `cohortFingerprint` hashes the ordered, multiplicity-preserving sequence
of decoded `[metricId, queryFingerprint]` pairs as JSON lines; timings and
outcomes do not change workload identity. A dropped cohort cannot be reconciled
from retained entries alone and is explicitly incomplete.

Pass `start`/`end` use `performance.timeOrigin + performance.now()` for a
same-machine monotonic-epoch timebase, not a repeatedly sampled wall clock.
Contention intervals include offsets and overlapping invocation ordinals. Outer
`stateTransaction` intervals exclude acquisition waits, nested savepoints and
post-commit delivery. Host connections publish their 128-entry writer histories
outside transactions, batched at most once per 100ms and flushed on close. Sixteen
fixed `writer-observations-<slot>.json` sidecars bound disk use and read cost across
processes; PID slot collisions can overwrite evidence, so coverage is unknown.
The collector uses its live local history rather than double-counting its sidecar.
Existing maintenance PASSIVE checkpoints publish a bounded, atomically replaced
`checkpoint-observations.json` sidecar beside the database; measurement only
reads these files, never checkpoints or probes locks. The 16-interval note cap
prioritizes query overlaps (then checkpoint witnesses). Pass-only writers are
summarized as a count and total duration, not allowed to evict query overlaps;
actual interval loss is counted. Optional plans/SQL are trimmed before cohort
entries. Missing, delayed, stale, dropped, colliding and in-flight coverage remains
**unknown**, never evidence of no contention. Native busy/lock
wait counts and times are unsupported by the SQLite APIs and remain unknown;
observed BUSY/LOCKED failures are separate counts, not wait duration estimates.
Overlap is not causation. Capture does not backfill old notes or authorize rollout.

## Command sources

A source command runs in the configured installation root. It may return a
finite number, a sample object, or a map of samples:

```json
{"samples":{"example.count":{"value":7,"sampleSize":10},"example.failures":0}}
```

Metrics sharing the **same exact command string** share one invocation per
sampling pass. The producer chooses its own executable, arguments and batching;
the Host never rewrites them. Each due metric selects its own ID from `samples`,
even when it is the only due metric. Individual samples may include `sampleSize`,
`measuredAt` and `note`. Missing or invalid entries produce failure diagnostics,
not zero observations. Undeclared entries are ignored. A command failure is
shared within that pass and may be retried on the next pass. A query takes
precedence when a definition also supplies a command.

Existing single-sample commands remain valid. The old implicit batching for
scripts named `project-metrics.ts` and `focus-metric-sample.ts` is removed. Before
deploying to an installation using it, adapt the producer and App definitions
together and check invocation counts. Separate per-metric commands otherwise
run separately. There is no automatic rewrite of stored commands or new metric
storage. Host deployment and App adoption are separate operations.

Generic status keeps session and evaluation evidence. Named learning-process
reports belong to their App; a particular Coach or Gym is not required.

## Context usage

The Metrics page (`/metrics`) compares context preparation using automatically
recorded bounded agent invocations. `/api/context-usage` serves the same indexed
observations, with a start/end time window (up to 90 days) and exact App, agent,
preparer, entry hash, model combination, workflow-run and Task filters. It reads
stored summaries, not transcripts. Preparer authors do not register metrics.

Compare matched workloads and inspect session results: the page separates actual
models and execution outcomes, and reports input (uncached/cache read/cache write),
output, replies, tool calls, elapsed time, preparation bytes/time and SDK cost
estimates. Means require finished invocations with usage on every observed reply;
partial observations remain visible. A smaller brief or a successful execution is
not proof of cheaper work or a correct answer. Cost is not an invoice.

Coverage starts when this instrumentation runs; older sessions are not backfilled
or assumed to use the default preparer. Persistent chat, external CLI usage and
provider-hidden retries are excluded. Direct runs return the same usage structure
and save `usage.json` alongside their session artifacts, without importing it into
the hosted dashboard. Entry hashes identify the configured preparer's entry file,
not its imported dependencies or all prompt/configuration changes.

Measurements are passive: a fresh observation identifies each actual invocation,
even if it resumes an existing session. New replies replace a cumulative SQLite
snapshot, and final outcome updates it once more. Inherited messages add no usage.
A crash leaves an unfinished observation; reporting failures warn without failing
work. Existing bounded maintenance retires observations after 30 days without
updates; older session/workflow evidence can expire sooner. There is no collector timer, transcript replay, quality judge or billing
service. The additive table needs no historical migration; execution contracts
and App reconciliation are unchanged.
