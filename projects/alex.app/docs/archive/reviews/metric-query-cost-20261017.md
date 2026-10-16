# Metric-query cost and asynchronous execution — October 17, 2026

**Status:** profiling complete; direct SQL stays on the main thread for now by
user decision. The accepted metric-query target is under 100 ms. A Host/App
implementation covers metric-query cost and retained plans. Host #377 is merged
and deployed; the App policy is activated. Asynchronous SQL execution remains
deferred. Initial profiling changed no installation state; subsequent authorized
rollout is recorded below and does not establish a performance improvement.

**Supports:** [Purpose and value](../../1-principles/purpose.md): keep work
responsive and steerable while avoiding unnecessary machinery and model calls.
**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first)
and [Host mechanics, App meaning](../../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics).
The [Metrics contract](../../2a-design/metrics.md) owns source execution; the
[Host proposal](../../proposals/host-contract-improvements-20261016.md#5-measure-metric-query-cost-before-adding-isolation)
tracks the remaining monitoring and containment work.

## What was measured

A read-only SQLite backup captured a consistent installation database of
2,368,008,192 bytes. Its 17 active SQL-backed metric definitions were each run
three times in separate profiling processes using Host `68bc5c7cf` and Bun SQLite
3.53.0. Every run opened its own production read-only connection, prepared and
executed the stored query, closed the connection, and observed a queued timer.
Plans were collected on the copy. No installed command-source producers were
executed for this inventory, and no expensive trial query ran against live data.

There were 82,672 retained Task attempts and 31,659 inbox items. Observations:

| SQL metric | Copied-query elapsed time, three runs | Plan characteristic |
| --- | --- | --- |
| Failed attempts over 24 hours | 78.1, 84.5, 79.0 ms | Full attempt-table scan, materialized recent cohort |
| Oldest unresolved input recovery | 50.0, 52.4, 45.5 ms | Full inbox scan plus JSON recovery expansion |
| Unresolved input recovery count | 42.8, 41.0, 44.0 ms | Same recovery scan |
| Evaluation unsuccessful attempts | 28.9, 16.5, 18.5 ms | App-prefix index scan plus recovery reads |
| Other 13 SQL sources | Approximately 0.9–7.4 ms | No severe copied-query stall observed |

Queued timer delays closely matched query elapsed time. A fresh connection does
not imply a cold disk cache. Queries use the real clock, so these are timing
observations rather than a fixed-cohort equivalence test. No index or query
rewrite was trialed; a scan alone does not establish that another index is worth
its storage and write cost.

## Live evidence differs from a copied benchmark

A read-only diagnostic status request at 2026-10-16 19:48 UTC returned in about
8 ms. The process had approximately 2.5 hours of observations: 417,452 SQLite
calls, zero reported SQL errors, 41.39 seconds total SQL time and a 302.73 ms
maximum completed call. These are adapter measurements, not a full Host latency
profile or proof that no work was delayed.

The recent failed-attempt metric query took 94.99 and 105.18 ms in adjacent
windows. Recovery metrics reached 68.54 and 54.94 ms. The worst current call,
302.73 ms, was a conversation-link query rather than a metric source. The latest
retained aggregate SQL-time sample was 0.542%, and the latest worst-call sample
was 302.73 ms. The 105.18 ms metric query already crosses the new 100 ms target;
it should not be described as meeting that target.

Retained history changes the interpretation. In the preceding 24 hours there
were 224 worst-call samples, nine above one second. They are sampled overlapping
windows, not nine independent incidents. At 2026-10-16 06:10 UTC, the same
failed-attempt query fingerprint (`get:c2578eb640700e60`) recorded **7,303.63 ms**,
and the recovery-age query recorded **3,359.61 ms** in the retained note.
Conversation-link queries also had multi-second observations in that interval.

The copied benchmark and recent window therefore do not establish that the
historical slowdown is resolved. These wall-clock observations cannot by
themselves distinguish query CPU, I/O, lock contention or process scheduling.
Bounded returned examples do not bound how many historical rows SQLite scans.

## Existing monitoring and Alex's action

The installation already collects both `may.daemon-sql-time-percent` and
`may.daemon-sql-recent-worst-call-ms` through ordinary metric collection. The
former requests review above 25% for three consecutive samples; the latter
requests review above 1,000 ms. These are existing App policies, not Host timeout
limits. The recent retained samples have 5–10-minute gaps; the declared
five-minute minimum interval is not an exact sampling guarantee. The current
contract and implementation also preserve missing/invalid samples as failures.

The all-SQL gauge is useful but is not a separate history or budget for every
metric query. Coverage excludes workers, raw drivers and waits outside the
shared adapter. Rankings and retained query notes are bounded. A query still
running cannot yet contribute its completed duration.

This was more than an unconsumed alert:

- Retained breach Event `6671451`, alert `4986`, was accepted by Alex's automatic
  metric-breach route.
- Evaluator report Event `6671640` used that same alert and requested better
  evidence for the recurring SQL concern, naming the existing investigation
  `may/goal/appdep_8106e125148535483a34ec10`.
- The linked investigation had selected no change because several unrelated
  queries slowed together and historical evidence did not isolate a cause.
- Alex's retained completion says May accepted bounded parameterized query-plan
  capture. [Host #352](https://github.com/hao1939/may-agent/pull/352) supplies that
  mechanism; Alex's follow-up [#362](https://github.com/hao1939/may-agent/pull/362)
  corrects its boundary to capture successful reads at **at least** 1,000 ms.
  GitHub confirms #362 merged on October 16 at `88259cb41`.
- That completion explicitly records no deployment or restart. This review did
  not establish later installation of either change. The result is a diagnostic
  improvement, not verified reduction of these queries' runtime.

The initial inspection also found an App evidence gap:
`scripts/daemon-sql-latency.ts` retained fingerprints, shapes and timings but
omitted the Host ranking's optional plan. The evaluator's ordinary evidence read
could not recover a plan after it expired from diagnostics. The implementation
below adds bounded plan retention; the merged Host capture alone did not complete
that evidence path.

## Asynchronous comparison

A disposable database and the production `measureSourceMetrics` collector were
paired with the production control socket and client. Before each collection,
the client requested `status`. The same SQL ran directly and through the existing
command-source subprocess path, three times each. No model, installed App or
live database participated.

The expensive fixture was:

```sql
WITH RECURSIVE seq(n) AS (
  VALUES(0)
  UNION ALL SELECT n + 1 FROM seq WHERE n < 2000000
)
SELECT SUM(n) AS value FROM seq;
```

| Path | Control reply during expensive collection | Total expensive collection | Trivial `SELECT 42` collection |
| --- | --- | --- | --- |
| Direct SQL | 433–519 ms | 432–518 ms | 4–13 ms |
| Existing command subprocess | 2.6–3.3 ms | 566–653 ms | 49–64 ms |

All samples had the same expected value and no collection failure. Collection
includes connection setup, persistence and the collector's final yield. These
small local trials do not establish a throughput or production latency bound.
They show that the existing asynchronous process path frees the serving thread,
while process startup adds cost. They did not test cancellation, worker crashes,
process-tree termination or scheduled recovery, and are not evidence that a new
SQL worker implementation is ready.

Adding `async` or `await` around the current synchronous SQLite call would not
provide that isolation. Moving work to another process also removes its SQL time
from current Host-process counters; a lower gauge would not imply less total
resource usage. CPU, memory and disk remain shared resources.

## Decision and remaining work

Keep direct SQL on the main thread for now, as requested. Do not introduce a
worker, change collection policy, or pretend the historical spikes disappeared.
The target is **under 100 ms for each metric query**, separate from the existing
all-SQL one-second alert. The implementation records actual query cost,
keeps routine samples quiet and routes App-declared breaches through Alex. It
also retains available captured plans. None of this changes the execution
thread or allows Host to choose a mitigation.

### Source implementation and portable evidence

Host [PR #377](https://github.com/hao1939/may-agent/pull/377), candidate [`3089c4371a`](https://github.com/hao1939/may-agent/commit/3089c4371aeb00bacf8e2845aa49c60a9f3b11db),
based on `68bc5c7cf`. Companion App code is in `may.app/reliability-metrics.ts`
and `may.app/scripts/daemon-sql-latency.ts`; owning policy is
[SQL cost review](../../../../may.app/design/metric-condition-follow-through.md#sql-cost-review).

The Host adds `metric.source-query-worst-ms`, one maximum-duration sample per
collection pass, with bounded slow-source references, attempted/failure counts
and available plan evidence. It has no default threshold. The App sets `>= 100`.
No additional SQL execution or EXPLAIN is performed to collect the cost sample.
The all-SQL App adapter now retains matching plans from its existing status read.

The paired fixture runs production SQLite collection, App definitions, metric
evaluation and Alex's event mapping. A controlled monotonic clock proves that
99 ms stays healthy, 100 ms creates one breach, repeated 100 ms stays in that
episode, a no-query pass creates no sample or recovery, and 80 ms recovers the
gauge. It verifies the original query result remains unchanged. Host fixtures
also cover failed sources, preserved App calibration/retirement, optional plans,
bounded notes and a slow source followed by many fast sources.

The first paired run exposed unsupported inclusive operators: an unknown `>=`
fell into the evaluator's below-threshold branch and breached at 99 ms. The
candidate adds inclusive operators to the shared SDK declaration and aligns
Host evaluation/readers and served UI comparisons, with boundary regressions.

The first hosted Quality run failed an existing Conversation browser fixture:
clearing the input did not mean its previous send had finished refreshing the
Conversation. A controlled delayed-refresh trial reproduced the ignored next
click. The fixture now waits for send completion; no Conversation runtime change
or automatic test retry was added. Its 11 owning HTTP/browser tests pass.

Validation uses disposable databases and synthetic timing/plan fixtures:

- Host focused collector/profiler/metric/report tests: 99 passed.
- Served HTTP/browser health tests, including boundary labels: 8 passed.
- Full Host `bun run ci`: 3,800 passed, three installation-only tests skipped,
  zero failures. Final Host/SDK types, App boundary and ESLint: passed.
- GitHub [Quality and Container](https://github.com/hao1939/may-agent/actions/runs/38961424576)
  both passed on `3089c4371a`; PR #377 merged as
  `8eabb85d1b3af4c7e578359c61ff437d5b54282e`. Merge CI also passed.
  Deployment is recorded separately below.
- Companion `may.app/reliability-metrics.test.ts`: 20 passed.
- `check:may-design` in the isolated source worktree: zero errors; existing
  unclassified `reports` warning. The integrated shared checkout passes document
  integrity and examples but its canonical-App check reports three pre-existing,
  untracked disabled App directories without `app.ts` (`evaluation.app`,
  `gym.app`, `may-agent.app`). This change did not alter those directories.

These are source-contract tests, not a measured performance improvement or proof
that Alex has mitigated a live incident. Plans still require an existing slow-read
capture at 1,000 ms. The metric covers attempted SQL sources in each pass, so a
later lower maximum alone does not establish that the same slow query reran.
Install Host support before activating the App policy, then verify real samples
and investigation follow-through through the ordinary rollout process.

If evidence later warrants isolation, Host should execute the same declared
query off-thread without requiring Apps to manage workers. Measure overhead,
prove bounded execution and cancellation, preserve failures, and verify the next
scheduled sample. No mechanism is justified merely by renaming a function
`async`, nor is a merged diagnostic patch proof of improved query performance.

Private raw inventory, plans, timing outputs, status capture and trial scripts
are retained together in the operator's `metric-query-profile-20261017` evidence
archive. They contain installation state and are not fixtures for public Host CI.


## Rollout verification

The user authorized rollout after #377 merged. The supported deployment path
built immutable Host commit `8eabb85d1b3af4c7e578359c61ff437d5b54282e`, including
#376 recovery changes, and settled successfully at `2026-10-16T20:30:39Z`
(October 17 local time). The deployment correlation is
`host-metric-query-8eabb85d-20261017`; its exact receipt is under the Host checkout's
`.state/deploy-receipts/host-metric-query-8eabb85d-20261017.json`.
The loaded and requested artifact hashes both equal
`ccd239be7834fc19e2737d6be52dee139b47f316f3bc7c92e5c07bff8b44a198`;
health is healthy and `duplicateDeploy` is false. Binary version, SDK release,
UI release, supervisor processes and control-socket readiness were checked.

App activation separately pinned commit
`6b1cf88cb66560084a0b5fd9ad6b46f0982aba47`. Reload request Event `6677262`
completed successfully as record-only Event `6677264`; the active definition
link matches that commit. The live gauge now reports owner `may`, threshold
`100` and operator `>=`. Restart alone retained the prior App release, so the
explicit activation was necessary. No synthetic sample or alert was inserted.

The three enabled App definitions loaded against the deployed SDK. The broader
optional source-boundary scan stopped at a pre-existing broken symlink inside
Scout's retained research workspace; the underlying App/artifact compatibility
check passed separately. No workspace was removed to make the scan pass.
Deployment's 68 control checks passed, as did both merge CI jobs. Native CLI
versions were unchanged; no model-backed compatibility claim is made.

The first natural collection completed at `2026-10-16T20:35:44.975Z`: 17 SQL
sources attempted, zero failures, maximum **5,905.7 ms**, total **6,472.7 ms**.
The slowest source was `may.failed-task-attempts-24h`; its bounded note retained
fingerprint `get:c2578eb640700e60` and an available plan showing an
`app_task_attempts` scan. Other retained examples took 312.1 ms and 122.1 ms.
This was after restart and while local source tests ran. It establishes real
latency, not its cause or steady-state performance. No extra diagnostic SQL ran.

Normal evaluation created alert `4989` and breach Event `6677292` at
`2026-10-16T20:36:37.861Z`. The Event was accepted by Alex's ordinary metric route
with no pending admission error. It admitted the exact Task
`runtime/metric-review/evaluator-deepseek/a6b77df2b98b9cd7f45a01f4`.
The workflow retained the obligation as `waiting` / `budget-deferred` because
its shared semantic allowance was exhausted, with `reviewAt` and `nextEligibleAt`
both `1792183200000` (`2026-10-16T20:40:00Z`). This proves sampling, threshold
evaluation, routing and durable deferral; it does not yet establish a completed
assessment or mitigation. The metric remains breached and no query repair is
claimed.

At `2026-10-16T20:40:03Z`, the same review Task was observed `running`, after
its saved budget deadline. No manual wake, new Task or budget override was used.
Its previous accepted summary still describes deferral; running is evidence of
resumption, not a completed judgment or query repair.
