# Core simplicity and robustness review — 2026-09-10

**Historical context:** [Architecture](../../2a-design/architecture.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical source review and recommendations; the original review
applied no runtime changes. Subsequent fixes are recorded separately below.
**Source:** Host `d9e7597e93608c45bed4fe649ff1b0fb1d040743`, verified against
GitHub `main` on September 10. The shared checkout remained at `88598a15` with
its unrelated README edit; review and tests used an isolated checkout.

The core has useful, small primitives. The strongest next change is to contain
exceptions at the Task controller boundary, where a failed diagnostic currently
interrupts retry handling. Keep the existing state authority, queue and event
boundaries. Larger restructuring should follow a concrete simplification, not
file size or a desire to introduce more services.

This applies the [design philosophy](../../1-principles/design-philosophy.md)
and [current core focus](../../proposals/task-runtime-organization.md#current-focus-simple-and-robust-core).
The [error/metric and App discussion](error-handling-and-conversation-discussion-20260910.md)
remains paused; this review does not restart that feature work.

## Component assessment

| Component | What is already useful | Recommendation |
| --- | --- | --- |
| App registry | Serializes reloads; validates a complete prospective generation; publishes after consumer preparation succeeds | Keep ordinary registration and replacement; no new discovery framework |
| Events | Persists before effects; distinguishes durable routes from optional observation; bounds listener backlog and contains listener failures | Preserve these distinctions; use events at integration boundaries and calls for local ordering |
| State | Canonical SQLite resources; transitions check resource/generation/attempt fences inside the write transaction | Preserve one authority and one commit boundary; projections and execution records remain evidence |
| Timing, queue and capacity | Small owned timers, deduplicated Task IDs, dirty-wake coalescing, concurrency limits and foreground reservation | Keep these primitives; harden failure cleanup at their controller boundary |
| Attempt coordination and recovery | Normal execution validates results; merged recovery correction prefers workflow redo over reconstructing lost verification | Keep safe, affordable redo; reduce duplicated behavior when concrete changes expose it |

Registry, timer, capacity, queue, controller and recovery scheduler are roughly
53–245 lines each at this revision. The large coordination modules are
`app-task-runtime.ts` (3,495 lines) and `app-task-reconciler.ts` (4,210 lines).
Size alone is not a defect: SQL and type declarations also occupy space.
The useful simplification target is repeated decisions and mixed responsibilities,
not a smaller file count or a uniform directory shape.

## Findings

### 1. A failing error reporter skips the planned retry

**First correction.** In [controller error handling][controller-error],
`onError` runs before retry scheduling and is not contained. If it throws, the
promise chain becomes rejected and the retry timer is never installed.
The `finally` still releases capacity, but the intended retry has been lost.

The [actual runtime callback][runtime-error] publishes `handler.failed` through
the bus. Its required persistence boundary can throw; this is not limited to an
invented callback interface. The resulting unhandled rejection is logged by the
[daemon's process handler][process-errors], which does not restore the missed
retry. Later durable recovery or another wake may still recover the Task; this
finding does not claim permanent work loss.

The isolated probe observed:

- Ordinary failure: `bad -> good -> bad`; one retry, no unhandled rejection.
- Reporter failure: `bad -> good`; reported `willRetry=true`, no retry, and an
  unhandled rejection from the diagnostic callback.

A bare Bun subprocess without a rejection handler exited with code 1. The
normal daemon installs a logging handler, so that subprocess result is not a
claim that the deployed daemon necessarily exits.

**Smallest change:** isolate error reporting from the controller's retry decision
and cleanup. Preserve the original failure, report a diagnostic failure through
an independent bounded logging path, and continue the existing retry policy.
Add a regression where execution and its reporter both fail. No new error App,
event type or framework is necessary.

### 2. A synchronous execution throw bypasses cleanup

**Same boundary, lower immediate exposure.** The [controller invokes its callback][controller-start]
before attaching the promise handlers. A function typed to return a Promise can
still throw before returning one. That throw escapes the controller's local
failure handling and skips its `finally`.

With process exception capture solely for observation, the probe left `bad` in
the running queue, `good` pending, and one capacity slot held. No error callback
ran. The normal daemon exits on an uncaught exception rather than continuing in
that observed state.

The current production reconcile wrapper is explicitly `async`, which already
turns its internal throws into rejected promises. This is a demonstrated hole
in the reusable controller contract, not proof that today's wrapper triggers it.

**Smallest change:** invoke the callback inside an async or equivalent guarded
boundary so both synchronous throws and promise rejection reach the same cleanup.
Keep the existing event-loop yielding behavior. Cover this in the same focused
controller regression work as finding 1.

### 3. Recovery limits output rows, not database work

**Measured scaling concern; not an observed production incident.**
[Recovery candidate selection][recovery-query] combines ready, changed, due and
expired rows, then orders and limits the combined result. SQLite's plan uses
temporary sorting structures. A result limit of 256 therefore does not make
query cost independent of eligible backlog.

Five reads per fresh synthetic in-memory database gave:

| Eligible Tasks | Returned rows | Median query time |
| --- | --- | --- |
| 256 | 256 | 1.15 ms |
| 20,000 | 256 | 21.24 ms |

These figures describe this fixture and machine, not a throughput guarantee.
The query runs synchronously, so its cost matters for event-loop latency as the
backlog grows. This does not justify introducing a second scheduler or queue.

**Recommendation:** describe the bound accurately and compare expected backlogs
with acceptable latency. If that warrants work, first investigate query/index
ordering and bounded candidate reads while retaining cursor fairness and all
four recovery reasons. Do not ship a faster query that silently misses work.
The controller correction has clearer immediate value.

### 4. The controller retry limit does not stop recovery from starting more attempts

**Reliability and cost concern, reproduced at component boundaries.** The
controller's three-retry setting bounds its own delayed requeues. It is not a
limit on total execution for the Task. A [retryable runtime failure][runtime-retry]
uses `releaseStaleAppTaskResult`, whose [transition][retry-release] leaves the
same Task pending and ready. A recovery scan can enqueue it again after the
controller reported `willRetry=false`. The in-memory counter also resets in a
new process.

The [retry-bound probe](core-simplicity-review-20260910/retry-bound-probe.ts) uses
the real controller, recovery scheduler, file-backed SQLite store, claim and
retry-release transitions. A synthetic callback always fails after the same
release used by the runtime. It observed:

- Initial execution plus three retries: four attempts, ending in
  `willRetry=false`.
- Another explicit recovery check: a fifth attempt on the unchanged Task.
- A separate Bun process opening the same database: four further attempts.
- The Task remained generation 1, pending and eligible for recovery throughout.

This establishes the component interaction and loss of the counter across
process restart. It does not measure a live executor, model spend, the complete
daemon startup path or the production timer interval. The probe invokes
`recover()` directly and shortens retry delays to 1 ms. Blocked/invalid-result
paths that already become attention are distinct from this retryable-failure
path. [Captured evidence](core-simplicity-review-20260910/retry-bound-evidence.json)
includes these qualifications.

**Recommendation:** make the proposed execution allowance a durable Task
decision, so unchanged failures remain stopped under passive recovery. Reuse
existing attention and attempt evidence where sufficient; distinguish actual
execution failures from stale-state reconciliation and retain deliberate retry
or meaningful-change paths. A new retry service is unnecessary. The complete
runtime regression belongs in that implementation slice.

Run the probe in a fresh temporary directory, then reopen its database in a
second process:

```sh
retry_probe_dir=$(mktemp -d)
bun "$review_artifacts/retry-bound-probe.ts" "$PWD" "$retry_probe_dir/tasks.sqlite" initial
bun "$review_artifacts/retry-bound-probe.ts" "$PWD" "$retry_probe_dir/tasks.sqlite" restart
```

The first command creates synthetic state; use a fresh directory for each run.
The controller, recovery and resource-store suites were rerun for this follow-up:
**48 passed, 0 failed**. They are a subset of the earlier 172-test run, not 48
additional tests. No Host runtime source changes were made.

## Follow-up: durable retry candidate

On September 10, Host [PR #107](https://github.com/hao1939/may-agent/pull/107)
(`ba119385`, branch `fix/durable-task-retry`) reproduced
finding 4 through the actual Task runtime and a synthetic failing executor:
eight independent reconciliations caused eight executions. The candidate now
records one consecutive-failure count on the existing Task and enforces it at
shared admission. Four failures become attention; ordinary wakes and a fresh
process cannot reopen execution. Explicit retry, execution-spec change and
accepted progress/waits remain possible on the same Task.

This does not change the original probe or its captured measurements. The
[controller proposal](../../proposals/task-controller-pattern.md#durable-retries)
records the candidate's scope and verification. It adds no retry service or
new Task lifecycle, and is not a deployed fix. Findings 1 and 2 were separately
fixed by merged PR #105; recovery-query scaling remains deferred.

## What has already improved

[PR #104](https://github.com/hao1939/may-agent/pull/104) merged on September 9.
The earlier [completion findings](core-design-review-20260909.md) are not new
open defects at this review baseline. The correction:

- declines the shortcut that would accept a recovered workflow handoff without
  its lost verifier and workspace handling;
- retains structured results for supported recovered agent completion; and
- turns rejected or missing workflow verification into attention rather than
  unchanged automatic retry.

This is a useful example of the philosophy: a small change accepts safe repeat
work instead of expanding recovery reconstruction. The 76 Task-runtime tests,
including the new completion regressions, passed on the reviewed revision.

## Suggested sequence

1. Correct and test the Task controller's failure boundary. Keep scheduling,
   capacity release and error reporting understandable together.
2. Make the execution retry allowance survive recovery checks and restart;
   use the component evidence above to build the full runtime regression.
3. Preserve the simple recovery correction. Add recovery machinery only when
   measured redo cost justifies it; keep the App's acceptance requirements.
4. When changing the larger Task modules, remove repeated decisions first.
   App registration/event routing, attempt execution and restart reconciliation
   are useful internal seams, but moving functions alone earns little value.
5. Revisit recovery query cost at a representative backlog. Explicitly accept
   some scheduling delay where that is cheaper than another mechanism.

This sequence does not require the deferred metrics service, App merge or a
universal callback framework. A first patch should be confined to controller
failure handling and meaningful regressions, followed by the normal Host checks.

## Reproduction and coverage

[Controller probe](core-simplicity-review-20260910/controller-failure-probe.ts),
[query probe](core-simplicity-review-20260910/recovery-query-probe.ts), and
[measured evidence](core-simplicity-review-20260910/evidence.json) use actual Host
classes. They create no installed App state; the query fixture uses fresh SQLite.
Set `review_artifacts` to the absolute directory containing those files, then run
from an isolated Host checkout at the revision above with dependencies installed:

```sh
bun "$review_artifacts/controller-failure-probe.ts" "$PWD" normal
bun "$review_artifacts/controller-failure-probe.ts" "$PWD" reporter-throws-observed
bun "$review_artifacts/controller-failure-probe.ts" "$PWD" reporter-throws-default
bun "$review_artifacts/controller-failure-probe.ts" "$PWD" sync-throw
bun "$review_artifacts/recovery-query-probe.ts" "$PWD"
bun test src/app/core/apps/registry.test.ts src/app/core/events/bus.test.ts src/app/core/scheduling/timer.test.ts src/app/host-capacity.test.ts src/app/app-task-controller.test.ts src/app/app-task-queue.test.ts src/app/app-task-recovery.test.ts src/app/app-task-resource-store.test.ts
bun test src/app/app-task-runtime.test.ts
```

The `reporter-throws-default` probe intentionally exits 1 to expose the bare
process failure. The observed modes intentionally catch process-level failures
to show the controller state; they are not proposed production handlers.

**Validation:** 96 tests across the eight core test files and 76 Task-runtime
tests passed: **172 passed, 0 failed**. Synthetic probes reproduced the findings.
No full CI, production workload, deployment or exhaustive core audit is claimed.

[controller-error]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-controller.ts#L211
[controller-start]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-controller.ts#L206
[runtime-error]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-runtime.ts#L2540
[process-errors]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/daemon-lifecycle.ts#L189
[recovery-query]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-resource-store.ts#L971
[runtime-retry]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-runtime.ts#L1938
[retry-release]: https://github.com/hao1939/may-agent/blob/d9e7597e93608c45bed4fe649ff1b0fb1d040743/src/app/app-task-reconciler.ts#L2972
