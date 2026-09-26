# Reporting

Reporting exposes observations; it does not accept or close App work. App
definitions own domain measurements and alert thresholds. The source collector
in `../../metric-source-measurement.ts` executes declared sources and preserves
sample evidence and failures.

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
