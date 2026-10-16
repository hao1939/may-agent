# Metric-query cost and asynchronous execution — October 17, 2026

**Status:** profiling complete; direct SQL stays on the main thread for now by
user decision. The accepted metric-query target is under 100 ms. Separate
per-metric cost alerting and asynchronous SQL execution remain unimplemented.
No Host source, installed metric, production state or deployment was changed.

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

There is still an App evidence gap: `scripts/daemon-sql-latency.ts` retains
fingerprints, shapes and timings but does not copy the Host ranking's optional
query plan into the saved sample. The evaluator's normal metric-evidence read
therefore does not automatically recover that ephemeral plan. The App should
retain bounded plan evidence if its later investigation depends on it. Do not
claim the merged Host capture alone completes that evidence path.

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
all-SQL one-second alert. That new target is documented but not yet covered by
a dedicated automatic metric.

The next useful monitoring change is to retain metric-query duration and source
identity from the actual execution, then let App policy flag durations at or
above 100 ms.
Reuse existing observations where possible, keep routine samples quiet, and
send declared breaches through the existing Alex review path. Preserve captured
plans needed for later diagnosis. None of this requires changing the execution
thread or allowing Host to choose a mitigation.

If evidence later warrants isolation, Host should execute the same declared
query off-thread without requiring Apps to manage workers. Measure overhead,
prove bounded execution and cancellation, preserve failures, and verify the next
scheduled sample. No mechanism is justified merely by renaming a function
`async`, nor is a merged diagnostic patch proof of improved query performance.

Private raw inventory, plans, timing outputs, status capture and trial scripts
are retained together in the operator's `metric-query-profile-20261017` evidence
archive. They contain installation state and are not fixtures for public Host CI.
