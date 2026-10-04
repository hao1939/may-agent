# SQL and transaction audit — 2026-10-04

## Decision and scope

Reduce unnecessary work before adding contention retries. The existing schema
and query machinery already support several useful corrections. Source fixes
and their validation are recorded in [implementation](#implementation-and-integrated-trial);
this review does not claim deployment or recovery of historical failures. See the [contention investigation](sqlite-contention-20261004.md).

Host source: `6b507d429` (main after #329). App source: workspace `ad8f56849b`;
May's reliability metric definitions last changed in `6036d96990`.
All live database access was read-only. No SQL mutation, index installation,
maintenance pass, Task replay or service restart ran against production.

This is a broad screening followed by focused investigation, not a claim that
every SQL expression has passed a complete semantic/concurrency review:

- Extracted 652 SQL-like source expressions, including schema/control statements,
  fragments and 133 interpolated expressions. These are not 652 unique executed
  queries. Tests, archived code, agent workspaces, research checkouts and probe
  scripts were excluded. Dynamically generated/operator-authored SQL needs its
  actual runtime shape.
- Prepared 404 complete static statements with `EXPLAIN QUERY PLAN` against the
  installed schema using Bun's SQLite 3.53.0. The initial Python 3.45.1 screening
  was repeated with Bun; 17 plan descriptions differed. Parameters were null for
  this broad screening, so concrete-parameter checks remain necessary.
- Read the existing daemon SQL diagnostics and executed all 17 active stored
  metric `source_query` definitions read-only. The broad metric pass had a
  two-second per-query progress limit; none exceeded it. Metric source commands
  are outside that SQL inventory.
- Compared candidate reads against unchanged queries in short, identical read
  snapshots. No result bodies or private parameters are published here.

The [per-expression ledger](sql-query-audit-20261004.tsv) records source, owning
function, query plan or missing runtime shape, and explicit findings. A plan
screen is not a pass/fail judgment: table size, call frequency, transaction
scope, returned payload and semantics matter.

## Findings in correction order

### F1 — exact identity queries miss their existing indexes

Host locations: `src/lib/db-writer.ts:164,734` and
`src/app/core/state/app-inbox-store.ts:674`.

The event and inbox unique indexes are partial: they contain only nonempty
idempotency keys. The queries use a bound equality but omit the nonempty
predicate. SQLite does not infer the full partial-index condition from that
parameter; it searches all matching event types or the destination App instead.
The event lookup runs after `BEGIN IMMEDIATE`, increasing writer lock time.
Inbox admission can also run inside its caller's transaction.

Adding the already-enforced `idempotency_key != ''` predicate selects the
existing unique index. It adds neither an index nor a retry:

| Read-only comparison | Current | Candidate | Result check |
| --- | --- | --- | --- |
| 20 retained event identity lookups, total | 13.92 ms | 1.32 ms | All rows identical |
| Five absent event identities, total | 3.24 ms | 0.30 ms | All results identical |
| Five inbox identity lookups, per call | 16.75–18.81 ms | 0.063–0.237 ms | All rows identical |

Existing daemon telemetry independently recorded the event lookup at up to
12.69 ms in the observed window. The fixture distribution and warm-cache effects
mean these timings are evidence of avoidable work, not guaranteed latency.

Audit the same predicate mismatch in `task-emissions.ts:25`, the bounded inbox
listing, and App-scoped prefix lookups. Keep different identities distinct:
Telegram has its own useful partial index; source-App lineage without a target
App does not automatically fit the target-App index. Adding a condition is safe
only where the caller already requires that condition. Preserve collision
rejection and exact scope/source/hash semantics in regressions.

### F2 — bounded Task history still sorts full attempt bodies

Host location: `src/app/core/state/app-task-resource-store.ts:1098`.

`readTaskContext` ranks all attempts of linked Tasks while carrying
`attempt_json`, then keeps 16 per Task. A small output limit does not prevent
large intermediate reads and sorts. Existing daemon diagnostics recorded this
family up to 131.6 ms. Reopening explicitly reads this context inside a state
transaction; other callers need their enclosing scope checked individually.

The read-only candidate ranks just attempt identities with the same reference
priority and ordering, selects the same 16, then joins those IDs to their bodies.

| Retained attempts in tested Task | Current | Narrow candidate |
| --- | --- | --- |
| 3,809 | 112.60–115.17 ms | 10.57–11.65 ms |
| 674 | 17.34–17.59 ms | 2.95–3.08 ms |
| 506 | 8.14–13.20 ms | 1.84–1.89 ms |

All six comparisons returned the same 16 identities and bodies. This is a SQL
experiment, not an integrated source fix. Multi-Task ranking, reference priority,
clock reversal, ties and empty reference lists still need the owning regressions.
Keep the read in its required snapshot; no stale-state pre-read is proposed.

### F3 — Event preparation happens while holding the writer lock

Host locations: `src/lib/db-writer.ts:699–837` and `prepareEventBody` at line 277.

After acquisition, Event persistence normalizes payloads, computes the idempotency
hash, serializes data and writes large content-addressed body files. The hash is
computed even for unkeyed Events, although it is stored/compared only for keyed
Events. These are source-confirmed costs; their fraction of historical lock
duration has not been measured.

Prepare immutable data before the owning transaction and omit unnecessary
hashing. Retain deduplication checks, current ownership/lease checks, Event rows,
trace/wake changes and related resource writes in the atomic SQL boundary.
The outer transaction matters: moving preparation above a nested savepoint
alone does not release its caller's writer lock. Preserve the existing artifact
contract: a committed row references a complete artifact; a failed SQL commit
may leave an unreferenced content-addressed file.

Exact Task wakes also parse and rewrite retained `trigger_json` under the lock.
That is a separate growing-payload investigation, not justification for dropping
events or inventing another Task authority.

### F4 — some maintenance statements still discover candidates inside DELETE

Host locations: `src/lib/db/maintenance.ts:142,155,177`.

`removeOrphans` and retired-session cleanup already discover candidates before
writing. Several other deletes still use `DELETE ... WHERE id IN (SELECT ...)`,
so their search/sort/protection work runs as part of the write statement.

Read-only execution of only the candidate SELECT measured:

| Candidate selection | Time | Candidates |
| --- | --- | --- |
| Expired closed/orphan pairs | 56.79 ms | 212 |
| Expired Events with reference protections | 55.40 ms | 303 |
| Expired trace links | 2.65 ms | 19 |

The other tested retention selections took under 1 ms. These are selection
timings, not measured DELETE/lock durations. The earlier historical failures
did not coincide with the observed maintenance pass; this is not attribution.

Reuse the existing two-phase pattern where the cost warrants it: discover a
bounded candidate ID set without a writer transaction, then delete exact IDs
while rechecking eligibility and all reference protections. Never weaken those
checks merely to shorten the lock. A batch-size cap alone does not bound rows
examined. Test a candidate becoming referenced between selection and deletion.

### F5 — three App metric queries calculate the same cohort twice

App owner: `projects/may.app/reliability-metrics.ts`, recovery CTE near line 5
and failed-attempt metric near line 145.

The aggregate and evidence examples refer to the same intermediate cohort.
The current planner recomputes it. Materializing that one query-local cohort
produced these same-snapshot Bun comparisons, with a fixed sample cut and
identical complete result rows:

| Metric | Current | Materialized cohort |
| --- | --- | --- |
| Failed Task attempts, 24 hours | 603–664 ms | 136–151 ms |
| Unresolved input recovery count | 108–120 ms | 48–58 ms |
| Oldest input recovery age | 105–116 ms | 48–60 ms |

The daemon had independently recorded the failed-attempt metric at 718 ms.
These source queries run in the collection phase, outside the metric-state
transaction. They stall that synchronous read path but do not themselves hold
SQLite's writer lock. Materialization is an ephemeral query result, not a new
stored cache. Keep these changes in May's App, separate from Host storage fixes.

A general started-at index could further help cross-App attempt queries, but
it adds write cost. Re-measure after removing duplicate work before adding it.
Source metric SQL changes need the existing App reload/release path and stored
definition verification before claiming live improvement.

## Lower-priority observations and healthy boundaries

| Area | Assessment and next action |
| --- | --- |
| Metric sample lookup/calculation | Existing `(metric_id, measured_at)` index serves latest/range reads. Do not move alert decisions out of their atomic snapshot merely because calculation occurs there. |
| Task IDs, attempt IDs, resource fences | Exact primary/unique key plans are in place. Most point reads in observed diagnostics were sub-millisecond. |
| Event-pair closure by correlation | Uses the status index then filters correlation. Only five open/orphan rows were present, so another index has not earned its write cost. Revisit if cardinality grows. |
| Legacy lineage prefix discovery | Source-App-only query scans inbox history; its target-App variant can suffer F1. Prefer exact retained identity where already available. Measure caller frequency before adding a lineage index. |
| Pending admission validation on reload | Scans retained command index, but belongs to startup/reload, not each Event. No pending rows at this cut. Not a priority for ongoing contention. |
| Metrics/catalog/configuration reads | Small-table scans are expected; 179 metric definitions at the cut. Avoid indiscriminate indexing. |
| Startup schema/backfills | Potentially history-sized and atomic; workers already open the existing schema. Review actual migration latency separately from steady-state writers. |
| Explicit trace repair and diagnostic queries | Some full-history scans are intentional offline/diagnostic work. They should not silently become periodic daemon queries. |
| Dashboard/trace views | Several dynamic joins/sorts and text searches remain. Resolve real filters and measure usage before claiming a needed fix. |
| Conversation result discovery | #329 already removes repeated attempt interpretation. Retain that evidence; do not conflate this read with a proven writer lock holder. |

## Remaining measurement gap

Existing SQL diagnostics cover completed `prepare/get/all/run/exec` calls and
five-minute top lists. They show acquisition time through `BEGIN IMMEDIATE`,
but not the whole interval from successful acquisition to COMMIT/ROLLBACK.
JSON work, filesystem work and application code between statements are missing.
The daemon snapshot also does not identify a competing worker's lock interval.

Use a bounded local instrumented trial of the existing transaction boundary to
measure acquisition and hold time separately, with operation/caller identity.
Collect that evidence before extending permanent metrics. SQL optimization and
shorter locks do not by themselves close the pre-admission recovery gap recorded
in the earlier contention review.

## Follow-up and reproduction

1. Replace #328's retry-first direction with the F1 query/index alignment. Check
   other callers of the same partial-index contract without merging unrelated
   identities into one lookup.
2. Implement F2 as a separate narrow query change and retain its identity/tie
   regressions. Combine deployment evidence only after each source fix passes.
3. Measure the Event writer's full lock interval, then narrow preparation scope
   for F3. Apply the existing candidate-selection pattern to demonstrated F4
   cases, retaining current-state rechecks.
4. Give F5 to the owning App. Verify saved definitions and the existing SQL
   latency metrics after rollout; do not add another monitoring controller.

Read-only trial scripts and complete local comparisons are retained under ignored
`.state/sql-audit-20261004/`: inventory, Bun plans, daemon diagnostics, Event and
inbox identity comparisons, Task-context comparison, metric comparison and
maintenance candidate measurements. They require this installation and are not
portable CI tests. The ledger and this report retain the source revisions,
questions, findings and limitations for future review without publishing private
records. Production source, schema, data and PR #328 were not modified by this
audit.


## Implementation and integrated trial

The fixes preserve the existing Host/App boundary and add no schema, index,
cache or retry budget:

| Finding | Source change | Validation |
| --- | --- | --- |
| F1 | [Host #328](https://github.com/hao1939/may-agent/pull/328), `f99b80f64`: six key lookups state their nonempty invariant so SQLite uses existing partial indexes | Production-SQL plan regression fails on main and passes with the fix; identity, collision, legacy receipt and fenced emission coverage retained |
| F2 | [Host #330](https://github.com/hao1939/may-agent/pull/330), `7f0578931`: rank attempt IDs, then join selected bodies by exact App/attempt identity | 36 resource-store tests, including multiple Tasks, cross-App ID reuse, empty references, timestamp ties and clock reversal |
| F3 | #328 prepares identity before its own transaction and skips unused hashes for unkeyed Events | Standalone preparation failure does not acquire the writer slot; existing rollback, fence and body-persistence tests retained |
| F4 | [Host #331](https://github.com/hao1939/may-agent/pull/331), `df1073428`: reuse two-phase cleanup for expired Event and pair candidates | Eleven maintenance tests; a second connection writes during selection, changes eligibility and adds a reference before exact-ID deletion; protected admission/input Events cannot starve a bounded batch |
| F5 | May reliability queries materialize their shared recovery/attempt cohort within each query | 19 App tests, 119 assertions, including production-query plans and unchanged metric values/evidence |

PR #328's prior retry additions are removed from its final diff. Host PRs are
independent. #328 passed full local CI (3,620 tests, three skips, 19,711 assertions)
and both GitHub checks; #330 passed full local CI (3,618 tests, three skips,
19,714 assertions) and both checks. Final #331 review-correction CI results are
tracked on its PR;
no source change here is a deployment claim.

An integrated trial invoked both source implementations of `readTaskContext`
against the same read-only snapshot, with child expansion disabled. All six
complete Task contexts were deeply equal. The 3,809-attempt Task took
158–172 ms before and 14–24 ms after; the 674-attempt Task took 18–19 ms before
and 3.5–4.4 ms after; the 506-attempt Task took 7.5–11.2 ms before and
2.2–2.3 ms after. Each returned the same 16 attempts. This includes surrounding
resource reads and parsing, unlike F2's initial SQL-only trial.

The same trial imported both App metric source revisions and fixed their clock
to one sample cut. All six complete metric rows were equal. Failed-attempt
measurement took 590–810 ms before and 149–152 ms after; unresolved recovery
count took 136–139 ms before and 60–75 ms after; oldest recovery age took
112–113 ms before and 61–63 ms after. Other tests were running on the machine;
these small trials demonstrate avoidable work, not a latency guarantee.

The #331 review found a pre-existing drift between candidate selection and the
retention trigger: pending admission plans and unfinished inbox inputs were
protected at deletion but absent from selection. If the oldest batch contained only protected rows, later eligible Events
could never be selected. The source
query now includes both missing indexed checks, matching all six trigger
reference protections. A batch-size-one regression fails on main and passes on
the correction, proving progress past protected records and cleanup of completed
admission/done-input Events. It checks exact surviving IDs rather than a driver's
change count, which can include a cascading admission-plan deletion.

A separate synthetic Event trial used temporary databases and large payloads,
measuring acquisition and the full acquired-to-COMMIT interval independently.
For standalone keyed writes, average hold time was about 30 ms before and
19 ms after moving identity preparation; total time was about 31 ms and 29 ms.
Unkeyed writes also remove previously unused hashing. Keyed nested writes still
perform their preparation within the outer caller transaction; their timing
variation is not evidence that a nested savepoint releases the writer slot.

The maintenance trial used temporary databases with 20,000 Events and pairs,
200 eligible deletions in each table, and retained/current records around them.
It wrapped the actual DELETE execution in an explicit transaction solely to
measure acquisition and acquired-to-COMMIT time. Both implementations deleted
exactly the same 200 Events and pairs. Event deletion held the lock for 84 ms
before and 13 ms after; pair deletion took 17 ms and 11 ms. Total maintenance
time was 212 ms and 189 ms: discovery still costs time, but it no longer holds
the writer slot. This single synthetic pass is not production performance proof.

Artifact creation remains after the atomic duplicate check: moving it earlier
could turn receipt replay into a new filesystem failure. Broader artifact and
outer-transaction preparation work remains open. The cheap trace-link expiry
query remains unchanged. The historical competing lock holder is still unknown,
and Events with no saved admission plan have not been replayed or recovered.

Reproduction artifacts are in ignored `.state/sql-audit-20261004/`:
`integrated-read-trial.ts`, `integrated-read-comparison.json`,
`event-hold-trial.ts`, `event-hold-comparison.json`,
`maintenance-hold-trial.ts`, `maintenance-hold-comparison.json` and the focused/full CI logs.
The first trial uses read-only installation data; the Event trial uses only
synthetic temporary data. Neither is a live rollout or a model-behavior trial.
