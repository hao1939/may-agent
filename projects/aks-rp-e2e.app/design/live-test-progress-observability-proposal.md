# Live Test Progress Observability

Status: implementation complete; runner rollout and live proof pending

Date: 2026-07-26

## Decision

Expose live test progress as provider state, not as task state.

The active Vitest runner reports neutral structured progress. The Azure
Pipelines adapter projects that progress into ADO timeline detail records. The
existing pipeline watcher observes those records and keeps one current read
model for the WebUI. It emits an event only for a new nonpassing verdict that
can cause action. The task tree receives a task only when the observation
requires durable work.

The existing watcher now provides the first bounded layer:
`.state/watchers/aks-pipeline-progress.json` combines plan inputs and completed
slice verdicts, and `bun run master-validation:status` renders its counts. That
solves aggregate slice-level reviewability without changing task state. The
remaining proposal begins where that projection stops: queued/running spec
lifecycles and phases before a slice artifact is published.

```text
test runner
  -> neutral progress record
  -> ADO timeline detail
  -> existing pipeline watcher
  -> current progress read model
  -> semantic event only when attention is needed
  -> app owner/task only when action must survive
```

Do not add another controller, a progress database, a polling task, or a second
terminal result format. `result.json` remains the terminal evidence authority.

## Current implementation and rollout

The implementation follows the decision without adding a controller or task
state:

- the active Vitest path initializes one neutral queued record per selected
  spec and marks both generated and direct carriers running through one shared
  setup hook;
- terminal `recordTestResult` calls preserve the authoritative verdict, while
  a failed verdict may remain visible during cleanup;
- the CI adapter forwards ordinary output and translates only owned structured
  progress lines into deterministic ADO timeline detail records;
- the existing AKS pipeline watcher reads each active progressive run's
  timeline once, merges current levels with artifact-backed terminal verdicts,
  and writes the existing progress projection;
- overlapping ADO run-list queries are merged monotonically for each run id:
  a terminal observation cannot be downgraded by an eventually-consistent
  `inProgress` result, and `inProgress` cannot be downgraded to `notStarted`;
  this keeps exact waits wakeable even when filtered provider queries lag;
- standard ADO slice-job records provide a truthful queued/running/draining
  fallback for the slice row when a runner predates per-spec detail records;
  this fallback never guesses which individual spec has started;
- only the first fail/error observation for one run and spec emits
  `pipeline.test.nonpassing`; the event carries validation correlation without
  targeting the sleeping validation task. It wakes owner review for awareness
  only. Even when the same spec and source already have a failure carrier, the
  app never copies that older run's reason, fingerprint, or artifact into the
  new observation. Classification, source changes, and retries wait for the
  current run's later artifact-backed event, which creates or revises the
  durable failure work;
- the AKS domain page and `master-validation:status` read the same projection;
  neither reads task state or raw session logs; and
- ARM polling now exposes an optional bounded progress callback and safe
  one-line diagnostics. The long CCM carrier reports cluster operations and
  cleanup without signed URLs or full ARM bodies.

Local checks prove parsing, projection, deduplication, event routing, safe ARM
diagnostics, direct-carrier lifecycle coverage, and existing artifact behavior.
The current live run predates the runner change, so it cannot prove ADO timeline
behavior. Final rollout proof requires merging the focused runner PR, starting
a later master-validation run from a commit containing it, and observing queued,
running, phase, early nonpassing, cleanup, and terminal correlation in ADO and
the app projection.

## Problem seen in the live master-validation run

Run `173293468` proved progressive observation between slices: each completed
slice published an artifact and the watcher created a failure task before the
aggregate run finished. It did not provide useful progress inside a running
slice.

The exact private-cluster example makes the gap clear:

- slice 06 started `Auth and execute plan slice` at
  `2026-07-22T11:13:42Z`;
- the runner printed a heartbeat every 30 seconds, but every heartbeat only said
  `phase=live-run-private-cluster-vnet-integration-update-private-second-hop`;
- `arm-rest.ts` polled the operation without reporting the current ARM operation
  state;
- the useful diagnosis, `lastPollState=ReconcilingDNS` and
  `lastResourceState=Updating`, appeared only with the terminal failure output
  around `2026-07-22T12:45:47Z`;
- the slice artifact became available only after execution and cleanup ended.

Exact proof run `173305150` therefore told the watcher only `inProgress` until
the slice ended. An operator could not tell whether identity creation, cluster
create, subnet RBAC, the private hop, the public hop, or cleanup was running.
Fresh proof run `173316458` confirmed that this is not solved by reading the
active task log: while `Auth and execute plan slice` was running, its ADO
timeline record had `percentComplete=0`, `currentOperation=null`, and no live
`log.id`. The watcher needs explicit provider-native detail records rather than
scraping a log that may not yet be addressable.

The current code explains why:

- the ADO path invokes `runner/execute-vitest-plan.ts`; its
  `runner/vitest-runtime/results.ts` records completed specs, not a current
  per-spec lifecycle;
- `runner/spec-runner.ts` has a useful heartbeat but only one broad phase;
- direct scenario carriers commonly print their assertions at the end;
- `runner/scenario-lib/arm-rest.ts` retains the last poll state only for a
  terminal error;
- `spec-runner.yaml` publishes `slice-*-test-results` only after the slice job;
- `watchers/aks-pipeline.ts` observes run level and terminal artifacts, but not
  live ADO timeline detail.

There is useful prior art in `runner/plan-executor.ts`: the older executor
already models pending, running, and terminal tests, writes current progress,
and prints aggregate and active-test summaries. The active Vitest path should
reuse that convention, not introduce a competing mental model or switch back to
the older executor.

The failed artifact also exposed a logging-quality problem. `arm-rest.ts`
serialized the signed poll URL and a full managed-cluster response into the
terminal reason. That made the most useful facts hard to see and persisted data
that should be redacted. Terminal evidence remains authoritative, but its
summary must be concise and safe. The missing pieces are a small live projection
and bounded terminal diagnostics.

The live review also exposed an event-volume problem in the earlier run-level
watcher. During one ten-minute window it emitted `1,020`
`pipeline-run.state` events plus `1,000` redundant terminal aliases. Most were
unchanged one-minute replays for the same 100 completed runs. The events were
accepted, but both socket and HTTP ingress timed out while the daemon was busy,
delaying a legitimate merged-PR reconciliation. The current convention uses
`pipeline-run.state` for both live and terminal levels. Replaying terminal
history is therefore not a harmless implementation detail; it directly reduces
control-path reliability.

## Mental model

Keep three concepts separate:

1. **Execution state** says whether the process is queued, running, or complete.
2. **Verdict** says whether the test is unknown, pass, fail, error, or skipped.
3. **Phase** says what it is doing now, such as setup, verify, or cleanup.

This separation matters. A test can already have a fail verdict while cleanup
is still running. The UI should say `failed; cleanup running`, not pretend the
test is still unknown and not claim that all work is complete.

Use these conventions:

```text
executionState: queued | running | completed
verdict:        unknown | pass | fail | error | skipped
phase:          preflight | setup | exercise | verify | cleanup | done
```

`phaseDetail` is a short domain label such as `cluster-create`,
`private-apivnet-update`, or `resource-group-delete`. It is descriptive, not a
new state machine.

## Progress record

Every selected spec has one current record:

```json
{
  "testRunId": "test_20260722145923407_33mltk_123456",
  "specId": "spec.private-cluster.vnet-integration-update-private-second-hop",
  "sequence": 8,
  "executionState": "running",
  "verdict": "unknown",
  "phase": "exercise",
  "phaseDetail": "private-apivnet-update",
  "message": "ARM operation ReconcilingDNS; resource Updating",
  "startedAt": "2026-07-22T13:14:59Z",
  "updatedAt": "2026-07-22T13:42:59Z",
  "elapsedSeconds": 1680
}
```

Rules:

- `sequence` increases per spec; consumers ignore older records.
- Emit immediately on execution-state, verdict, phase, or message change.
- During a long unchanged phase, refresh the record at most every 60 seconds.
- Messages are short and redacted. Never include bearer tokens, signed poll
  URLs, request bodies, certificates, or full ARM resource bodies.
- A terminal record carries the same concise reason and category later written
  into the spec result. Existing diagnostic artifacts retain safe supporting
  detail; the progress record does not duplicate it.
- Cleanup updates the phase. It does not erase an already known verdict.

The active Vitest runtime writes one atomically replaced file per spec:

```text
runs/test-results/<run-id>/progress/<safe-spec-id>.json
```

Per-spec files avoid a shared-file race between Vitest workers and match the
existing `tests/<safe-spec-id>.json` convention. They contain only the latest
level state and are included by the existing slice artifact. Existing
`steps.jsonl`, child status, stdout/stderr, and terminal result artifacts remain
the diagnostic history. No second progress-history format is needed.

## Runtime boundary

The core runner must not know about ADO, May, the task tree, or EventBus.

Extend the existing Vitest result runtime with neutral operations equivalent to:

```text
selected(spec ids)
started(spec id)
phase(spec id, phase, detail, message)
verdict(spec id, verdict, reason, category)
completed(spec id)
```

The runtime atomically updates the spec's current progress file and writes one
prefixed JSON stdout line. `execute-vitest-plan.ts` initializes every selected
spec as queued. `runScenarioTest` records start and completion for both direct
and generated carriers. `recordTestResult` supplies the terminal verdict and
reason. Long scenario carriers may add named phase calls for better detail.

The neutral record uses the runner's `testRunId`; it does not contain an ADO
build ID or slice ID. The CI adapter adds pipeline run and slice correlation
from its environment when it creates timeline detail records.

Do not parse existing human log lines to infer state. The structured line is a
notification produced alongside the human-readable log.

The ARM helper may accept an optional neutral progress callback. It reports only
state transitions and a bounded refresh, for example
`ReconcilingDNS / Updating`; it must not expose the signed operation URL or the
full response body.

The same safe projection must improve terminal errors. An ARM timeout reason
should contain the debug label, elapsed time, HTTP status, last operation state,
and last resource state. If more response detail is useful, write a redacted,
bounded diagnostic artifact. Never persist signed query strings, bearer tokens,
certificates, request bodies, or complete managed-cluster documents as the
one-line reason.

## Azure Pipelines adapter

Use the existing `Auth and execute plan slice` step. Wrap the runner command in
a small CI adapter that forwards ordinary output and translates neutral progress
lines into Azure Pipelines logging commands:

- one `task.logdetail` timeline record per spec;
- `task.setprogress` for the slice summary;
- deterministic detail IDs derived from pipeline run, slice, and spec;
- an adapter-owned detail type and controlled `currentOperation` payload carrying
  execution state, verdict, phase, and short message;
- `Initialized` while queued, `InProgress` while running, and `Completed` with
  `Succeeded`, `Failed`, or `Skipped` when terminal.

The adapter validates the notification schema, bounds field lengths, and
escapes Azure Pipelines logging-command properties and messages. The watcher
parses only this adapter-owned detail type, never arbitrary task output.

This gives ADO a live table without scheduling one job per spec. We preserve
slice grouping, cluster sharing, bounded parallelism, and current artifacts.

ADO is only an adapter. Local runs still get the same progress files and plain
structured console lines.

## Watcher and events

Extend the existing pipeline watcher; do not create a progress watcher.

For active AKS spec-runner builds, the watcher reads the ADO timeline and
selects only the adapter-owned spec detail records. It writes one app-local
projection:

```text
.state/watchers/aks-pipeline-progress.json
```

The projection contains current run/slice/spec levels and derived counts:

```text
queued  running  pass  fail  error  skipped
```

Ordinary queued, running, phase, pass, and refresh changes update only the read
model. The watcher emits one deduplicated `pipeline.test.nonpassing` event when a
spec first reports `fail` or `error`. This wakes the owner early without filling
EventBus with progress traffic. The existing artifact-backed
`pipeline.failure.observed` event remains the terminal evidence path and should
correlate to the same durable investigation rather than create duplicate work.

Apply the same rule to existing run-level observations:

- persist the current run level in the watcher read model;
- emit a run-state event only when that level changes;
- refresh active relevant runs in the read model without emitting an event when
  nothing changed;
- never replay every completed run on every scan;
- when a Condition is registered after a transition, evaluate it once against
  the current read model or request one targeted provider check instead of
  relying on global terminal-event replay.

This preserves the Kubernetes-style level model: the durable read model holds
current observed state, while the event only queues reconciliation when the
state changes or an explicit targeted check is needed.

If an active record has no update for three minutes, mark it stale in the read
model. Do not classify the test as failed until ADO or terminal test evidence
says so.

A nonpassing verdict can wake the app owner immediately. The owner may inspect
current provider progress from the run and spec identity, but must not classify
the issue, change source, or queue a retry before artifact evidence exists. If
the same source already has a stable failure carrier, the app may wake that
carrier without creating another task. When the terminal artifact appears, the
existing `pipeline.failure.observed` path supplies the authoritative reason,
category, artifact path, and cleanup proof.

The task tree does not store heartbeats or progress rows. It stores the durable
investigation/fix/wait only after the app decides one is needed.

## WebUI

Add one `Live Test Progress` section to the existing AKS page:

- exact run, branch, commit, target, start time, and ADO link;
- aggregate queued/running/pass/fail/error/skipped counts;
- one row per slice and spec;
- current phase, short message, elapsed time, and last update;
- sort fail/error first, then running, queued, and pass;
- show `failed; cleanup running` when verdict and execution state differ;
- link terminal rows to the downloaded artifact when available.

The first useful screen is a table, not a new trace product. Detailed raw logs
remain an investigation drill-down.

## Delivery plan

### 0. Stop unchanged terminal-event replay

- Keep current run levels in the existing watcher state.
- Emit transition events once and update refresh-only observations in place.
- Evaluate late Conditions from the current level or one targeted check.
- Add a regression test proving repeated scans of 100 unchanged completed runs
  emit no events and do not delay project action ingress.

This is the smallest reliability fix and should land before adding more live
progress signals.

### 1. Safe, readable ARM diagnostics

- Replace signed URLs and full ARM bodies in timeout reasons with the bounded
  state summary.
- Add an optional progress callback to ARM polling.
- Add regression tests proving signed query strings and full bodies do not enter
  progress records or one-line terminal reasons.

This immediately makes current logs safer and easier to diagnose, even before
the WebUI projection exists.

### 2. Generic lifecycle on the active runner

- Add the neutral progress record and tests.
- Extend `execute-vitest-plan.ts`, `vitest-runtime/results.ts`, and
  `vitest-runtime/steps.ts`; do not revive or duplicate `plan-executor.ts`.
- Ensure generated specs and direct carriers always emit queued, running,
  verdict, and completed state.
- Include progress files in the existing slice artifact.

This alone answers which tests are queued, running, passed, failed, or errored.

### 3. Live ADO projection

- Add the thin CI adapter and ADO timeline detail records.
- Extend the existing watcher to read detail records for active relevant runs.
- Persist the current read model and emit only the deduplicated nonpassing event.

### 4. Useful phases

- Instrument shared setup, scenario execution, verification, and cleanup.
- Add safe ARM poll-state transitions through the optional callback.
- Start with the long master-validation carriers; do not require a broad
  one-shot rewrite before the generic lifecycle ships.

### 5. WebUI and early wake

- Render the current table and counts.
- Wake the app owner on a new nonpassing verdict.
- Keep the current artifact-backed failure task path as terminal authority.

## Acceptance

The design is working when:

- within two watcher intervals of a run starting, every selected spec is shown
  as queued or running;
- within two watcher intervals of a phase transition, the WebUI shows the new
  phase and a safe short message;
- completed specs update pass/fail/error/skipped counts before the whole
  aggregate run completes;
- a failed spec remains visible while cleanup runs;
- the same terminal artifact and cleanup evidence used today remain available;
- refresh-only scans do not create duplicate semantic events or tasks;
- 100 unchanged completed runs produce zero refresh-only EventBus events;
- a project action remains acknowledged while pipeline observation is active;
- no secret or signed ARM URL appears in the progress read model, event, or
  one-line terminal reason;
- task-tree size and controller count do not increase merely because tests are
  running.

## Cost and risks

The cost is moderate: small extensions to the active Vitest runtime, one CI
adapter, one timeline read in the existing watcher, a small WebUI table, and
focused tests. It avoids the much higher cost of one ADO job per spec and
preserves current cluster sharing.

Risks and controls:

- **Event noise:** only a new nonpassing verdict emits a progress-derived event;
  all other changes update the read model only.
- **Out-of-order updates:** use monotonic per-spec sequence values.
- **ADO API load:** query timeline only for active relevant runs and cap the
  number of runs per scan.
- **Secret leakage:** allow only controlled fields and redact before console,
  persistence, terminal summaries, and events.
- **False terminal state:** terminal artifacts remain authoritative; progress
  is explicitly current observation.
- **Partial adoption:** the generic lifecycle is mandatory; detailed phases are
  incremental and convention-driven.

## Non-goals

- Replacing `result.json`, JUnit, or the existing slice artifact.
- Saving raw logs in the task tree or EventBus.
- Creating one task for every running test.
- Creating a new controller or scheduler.
- Splitting every spec into its own ADO job.
- Parsing arbitrary human log text as product truth.

The resulting model stays small: runners report facts, infrastructure exposes
and observes them, the app organizes action, and tasks track only work that must
survive.
