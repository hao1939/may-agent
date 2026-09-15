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

## Observer health read

Ordinary App observers can read the optional [Host health snapshot](host-health.md).
It exposes bounded facts and coverage limits, not SQL, verdicts or recovery controls.
