# Default error handling and metrics: live PoC

**Historical context:** [Metrics And Alerts](../../2a-design/metrics.md). Retained rationale and evidence; this record does not define the current contract.

**Date:** 2026-09-09. **Status:** Isolated experiment completed; prototype is
unpublished and not deployed. The [draft](default-error-handling-and-metrics-draft-20260909.md)
and subsequent [discussion](error-handling-and-conversation-discussion-20260910.md)
were archived on 2026-09-10. Results below are retained experimental evidence;
the next-step recommendations are historical, not an active implementation plan.

The direction worked for a small Task workload. Existing execution handled a
transient failure and an infeasible operation. A small core collector exposed
attempt history without optional reporting or schedules. Metric-write failure
did not prevent Task completion, and restarting the Host did not inflate counts
or rerun completed work. A separate real model recommended a conditional scope
reduction; a fixture owner supplied the missing assumption and applied it through
normal App input to generation 2 of the same Task.

## Scope and artifacts

Host base: `46ebccd145af32b0a0f7ca014fdd4730afdc0c03`, containing the checked-completion
recovery fix on top of `88598a15`. That fix is a prerequisite here, not a result
of this metrics prototype. Source changes were isolated from the shared Host
checkout and installed Apps. All PoC processes were stopped after execution.

- [Portable prototype patch](default-error-metrics-poc-20260909/prototype.patch)
- [Compact execution evidence](default-error-metrics-poc-20260909/evidence.json)
- [Model input packet](default-error-metrics-poc-20260909/judgment-prompt.json)
- [Actual model recommendation](default-error-metrics-poc-20260909/judgment.json)

Real components: Host daemon, admission and attempt workers, control socket,
event publication, canonical SQLite state, metric service, workflow execution,
and restart of the same disposable installation. The provider was a real local
HTTP server returning controlled 503, 409 and successful responses. It produced
fixture exports only. Cost/value assumptions and the reported one-hour manual
effort were synthetic; no real export or business-value improvement is claimed.

Judgment used Codex CLI 0.153.4 with `gpt-6-astra`, high reasoning, on the supplied
packet without tools. The normal local model gateway was unavailable, so this
was a separate model invocation, not a Host-managed owner workflow. The harness
applied an explicit fixture-owner decision; automated decision routing remains
unproven.

## Observations

| Trial | Observed result |
| --- | --- |
| Existing Host baseline | Flaky operation called twice and reached done; unsupported operation called once and reached attention; healthy operation reached done. Four canonical attempts. Three existing metric definitions had no samples; no default attempt baseline. |
| Core collector added | The same initial work produced four finished-attempt observations: two completed, one failed, one interrupted; one retry and one completed-after-interruption attempt. |
| Reporting and schedules absent | Real runtime started without the optional reporting object and without `--cron` or UI. Baseline collection remained active. Basic core reads passed; workflow results also retained the metric values they read. |
| Metric snapshot write failure | Injected SQLite trigger rejected a snapshot after the batch had begun updating current values. Two more Tasks completed. Finished gauge stayed at 4, successful-sample timestamp and all 40 existing snapshots stayed unchanged, and one diagnostic reported the outage. |
| Metric service restored | After removing the trigger and finishing one more Task, the collector recomputed all seven attempts and reported restoration. No telemetry replay queue. |
| Duplicate input | Reusing the admitted input identity returned its receipt. The unsupported Task stayed at attention, with no extra provider call. |
| Conditional scope reduction | Model recommended manual export only if expected benefit exceeded two hours. Fixture owner then estimated four hours of benefit. App admission changed the same Task to generation 2 with explicit manual-only scope and acceptance. That generation reached done; generation 1's failed attempt remained. |
| Restart | Same SQLite and App state: a fresh sample still counted eight attempts, and provider-call counts did not change. A newly admitted Task completed, bringing the total to nine. |

The final attempt gauges were **9 finished, 7 completed, 1 failed, 1 interrupted,
1 retry, 1 recovered attempt**. Seven Tasks were then done, with the export Task
done only under its revised scope. The new generation was not counted as an
unchanged retry or recovery of the original scope.

The transient exception's canonical state was `interrupted`, with
`failureReason: stale-reconciliation-result`; its summary preserved the actual
provider exception and retry evidence. Therefore `failed / finished` would miss
this observed trouble, while calling every interruption an error would also be
wrong. Preserve states and linked evidence before asking a model to infer causes.

The model also distinguished an upper bound on value from expected benefit.
“Worth at most one day” did not establish that a two-hour alternative was worth
doing. The fixture's later four-hour estimate was an explicit assumption,
not a fact invented by the model or measured by the Host.

## What changed in code

| Home | Prototype responsibility |
| --- | --- |
| `core/metrics/task-baseline.ts` | Recompute a one-hour cohort from canonical attempts; write existing metric definitions/history atomically; preserve representative attempt IDs and summaries; report sample freshness and bounded outage diagnostics |
| `app-runtime.ts` | Start and close collection with normal background work, independently of optional schedules and reports |
| `core/reads/app-read.ts` | Supply the existing metric view from core storage when no optional reader is supplied; missing record returns null, unavailable storage rejects |
| `scripts/poc/` and `test/e2e/fixtures/` | Real Host runner, reporting-free composition, controlled provider/App, fault injection, explicit scope change and restart |

No lifecycle rewrite, new schema, error hierarchy, telemetry queue or recovery
supervisor was needed. Existing error-handling code was exercised unchanged.
The collector uses the existing `SqliteDb`, `MetricService`, event bus and owned
timer. Event observations request a later read; startup and a periodic timer
provide recomputation independently of event delivery.

Two failed iterations were retained in the evidence summary. First, the collector
used a transaction method absent from the Host database wrapper: Tasks settled,
but collection failed. Explicit `BEGIN`/`COMMIT`/`ROLLBACK` fixed it. Next, the
fault-injection connection hit `SQLITE_BUSY` removing its trigger; that run proved
containment but did not reach restoration. Bounded fixture DDL retry fixed the
harness. The full scenario then passed. Type checking also caught an untyped
dynamic observation name; the prototype follows the existing emitted name.

## Reproduce

Use a disposable checkout of the Host at the base above, with its documented Bun
and dependency prerequisites. Set `poc_artifacts` to the absolute directory
containing the four linked artifacts. Run from the Host checkout:

```sh
bun install --frozen-lockfile
# First apply only the portable harness, leaving Host runtime behavior unchanged.
git apply --include='scripts/poc/*' --include='test/e2e/*' "$poc_artifacts/prototype.patch"
bun scripts/poc/error-metrics-live.ts baseline .tmp/error-metrics-poc
# Add the experimental core changes.
git apply --exclude='scripts/poc/*' --exclude='test/e2e/*' "$poc_artifacts/prototype.patch"
bun scripts/poc/error-metrics-live.ts candidate .tmp/error-metrics-poc
cp "$poc_artifacts/judgment.json" .tmp/error-metrics-poc/judgment.json
bun scripts/poc/error-metrics-live.ts resilience .tmp/error-metrics-poc
bun run check:ci
bun test src/app/app-runtime.test.ts src/app/core/reads/app-read.test.ts test/integration/metrics.test.ts
```

Reusing the archived recommendation reproduces the controlled application path;
it does not make a new model call. To repeat judgment, use an authenticated model
client with the linked packet and preserve its exact response separately. The
recorded call was equivalent to:

```sh
timeout 90s codex exec --sandbox read-only --ephemeral --skip-git-repo-check --color never \
  -o .tmp/error-metrics-poc/judgment.json - < "$poc_artifacts/judgment-prompt.json"
```

A different recommendation or an unmet condition should stop scope application,
not be edited to satisfy the harness. Each run writes evidence, stops its Host
and provider, and retains its disposable directory for inspection.

Validation executed: Host and SDK type checks; changed-file ESLint; **18 runtime
and read tests**, **7 MetricService integration tests**, and the live runs above.
Full CI and deployment were not run. The metric integration tests cover existing
rule behavior, not default end-to-end rule activation in this prototype.

## Limits and next decision

The next useful step is a small production slice of default Task measurement,
with explicit freshness and a bounded query/cadence. Do not promote this patch
unchanged:

- The collector limits returned rows to 5,000, but its global time-window query
  lacks a matching index. That does not bound SQLite scan/sort time. Measure and
  bound actual read/lock costs before making this a frequent core operation.
- Samples are gauges for attempts **started within the previous hour**. They
  omit older starts and retry chains crossing the window. Sum of recorded
  attempt durations is not total elapsed, worker-startup, token or money cost.
  `recovered` describes an attempt sequence, not a proven successful Task.
- The PoC refreshes on events with 100 ms coalescing and has a 60-second fallback.
  Production cadence, snapshot growth, repeated evidence-note size and retention
  need a cost decision. The periodic missed-event repair and overload cases were
  not separately fault-tested.
- Freshness is available through a separate last-success metric and logs. Basic
  `MetricView.status: active` means the definition is active, not that its value
  is fresh. A supplied optional reader can still override the core fallback.
  Definition installation and rule wiring also remain partly in reporting;
  finish that separation before claiming a complete core capability.
- No generalized abandonment path, automatic App-owner judgment, unknown external
  effects, admission-wide error coverage, source-revision aggregation or sustained
  before/after improvement measurement was established. Scope change was an
  authorized fixture App input, not a new generic LLM mutation power.

Keep the demonstrated simple approach: truthful execution state, one source of
attempt evidence, recomputable measurements, and explicit owner decisions. Add
the remaining protection where expected recurring value justifies its cost.
