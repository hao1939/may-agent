# Keep recovery from blocking ordinary Host requests

**Design status:** Proposal; repairs the existing Host/App boundary.
**Implementation status:** Query repair [#280](https://github.com/hao1939/may-agent/pull/280),
helper completion [#281](https://github.com/hao1939/may-agent/pull/281), and SQL
diagnostics [#282](https://github.com/hao1939/may-agent/pull/282) are merged and
deployed together at `dc92e4f5`. Bounded recovery isolation remains pending. Host PRs
[#277](https://github.com/hao1939/may-agent/pull/277) and
[#278](https://github.com/hao1939/may-agent/pull/278) are merged and deployed;
that is not proof that all runtime timeouts are resolved.

## Decision in plain language

The Host must remain able to receive, acknowledge and control work while it
checks old work. Keep ordinary operations small, use exact indexed reads, and
give background recovery a bounded execution opportunity. Keep the existing
Task, input and Event records as authority. Apps still decide what evidence means
and whether more work is useful.

First repair the demonstrated query defects. Then verify responsiveness under
load and move any remaining unbounded recovery work through the existing private
background execution boundary. Raising the read timeout hides the symptom;
adding another work registry would duplicate responsibility.

The owning contracts remain [Architecture](../2a-design/architecture.md),
[Host/App Boundary](../2a-design/system-boundary.md),
[Events](../2a-design/events.md), [Storage](../2a-design/storage.md), and
[Scheduling and Observation](../2a-design/cron.md).

## What the investigation establishes

Source reviewed: Host `1c2f8366` for Conversation and runtime code,
`18785a27` for the metric projection. The live binary is the older `5449fa34`
candidate; its installed App definition release is recorded in the linked
[review](../../../may.app/docs/reviews/review-process-20261001.md).

| Evidence | Finding and limit |
| --- | --- |
| Exact metric evidence over 73,079 copied attempts | The old projection expanded unrelated history. #278 preserves all 1,091 projected rows; the full-index exact-read comparison improved from about 3.0 s to 0.13 s. This is a web/read cost, not proof of daemon recovery speed. |
| Actual `listPendingConversationTaskChanges` called against a read-only live connection | Two calls took 3.87 s and 3.73 s to return one change. The function runs synchronously in `app-inbox-route`. `LIMIT 100` bounds returned rows, not work performed. |
| Same query on a consistent seven-table copy | There were 6,595 linked attempts, 18,666 admissions and 17,911 inputs. A later snapshot returned zero pending changes and still took roughly 2.5–3.2 s. Empty results do not mean cheap reads. |
| Query plan | Correlated admission checks used only `app_id` from the existing expression index. SQLite comparison affinity prevented use of the target Task and generation terms. Conversation availability was also checked repeatedly. |
| Snapshot trial | Aligning comparison affinity and computing available Conversations once reduced the query to about 0.51–0.60 s. Results matched with zero pending changes and with nine pending results created by removing 12 delivery receipts in a rolled-back snapshot transaction. This is promising, still too slow for an interactive callback, and not comprehensive semantic proof. |
| Other trial variants | Moving the handled check earlier or materializing all pending candidates did not solve the problem; some were slower. Splitting an exact notification query into a UNION alone also chose broad scans. An explicit existing-index variant helped that small query, but does not explain the much larger callback cost. |
| Actual Task recovery selection | Indexed candidate/next-due calls across May, Evaluation, Gym and Scout took under 1 ms in this sample. Do not replace these working mechanisms. |
| Other input recovery selectors | Pending human-event lookup took 1.9 ms, pending admission plans 0.3 ms, and a 256-item input dependency page 2.3 ms. These pages already yield between items. Five distinct dependency views in that page took 0.8–47 ms each; the page read itself is not the multi-second bottleneck. |
| Retained slow-subscriber logs | Conversation supervision callbacks reached 2.71 s. Reconciliation and Task-change callbacks also repeatedly took tens to hundreds of milliseconds. Log counts are a selected window, not a measured error rate. |
| SQLite contention | Current daemon connections already use a 50 ms busy timeout. The retry helper additionally sleeps synchronously; its configured delays total 1.275 s before SQLite waits. The sampled log window mostly showed 5/10/20 ms retries, so the maximum is a risk, not the demonstrated cause of every stall. |

Cheap socket reads also timed out at six seconds while the daemon's main thread
was busy. The final twelve-sample probe, after the offline query trials stopped,
had three socket timeouts; a trivial HTTP 404 ranged from about 1.4 ms to 3.03 s.
This supports shared-thread contention, but does not attribute each
timeout to one SQL statement. The metric query, Conversation recovery, and
cumulative synchronous callbacks are distinct contributors. Provider latency,
queue delay and local CPU work must not be conflated.
The 15-minute Conversation sweep alone cannot explain the daemon's sustained
CPU usage or every timeout burst. Before claiming full resolution, capture
timings at the remaining coordinator/observer boundaries and correlate them
with external latency. A process CPU average is not attribution to a callback.

Private scripts, query plans, snapshot identities, failed trials and timings live
under `.state/review-pilots/telegram-noise-20261001/timeout-review/`. They are not
public PR fixtures. The original Python SQLite trial was interrupted after slow
execution; final SQL comparisons use the shipped Bun runtime and restored planner
statistics. Initial HTTP probes used the wrong endpoint and are excluded; socket
samples remain separate evidence. No live records or schema were changed.

## The small contract to enforce

1. **Acknowledge only what is durable.** A successful publication means the
   existing Event/input receipt is stored. Completing recovery is not a
   prerequisite for acknowledging that receipt. A failed pre-commit write
   returns unavailable, not accepted. Retry keeps the same identity.
2. **Bound the actual work.** Exact reads start from indexed identity. Background
   queries must bound candidates examined, not just output length. Scheduling
   another callback or wrapping synchronous SQL in an async function does not
   make it nonblocking.
3. **One operation budget travels downward.** Caller cancellation reaches the
   HTTP/socket reader and source adapter. A shorter source limit can apply, but
   nested calls cannot restart the caller's allowance. A JS timeout cannot
   interrupt synchronous SQL on its own thread.
4. **Failure leaves the obligation visible.** A read timeout is unknown evidence,
   not healthy state, Task closure, Condition resolution or permission to repeat
   an uncertain external effect. Existing receipts and fenced settlement decide
   what can safely be replayed.

These rules do not create another public API, Task type or agent workflow.

## Implementation trials: October 2

### Latest rollout and new measured lead

Merged Host `dc92e4f5` is installed. The standalone receipt
`projects/may-agent/.state/deploy-receipts/merged-280-281-282-20261002.json`
reports healthy readiness and identical artifact/loaded hashes, with the matching
SDK activated. PR #282's numeric-masking correction passed its regression, full
local CI (3,386 passes, three installation-only skips), and both GitHub checks.
App definitions are still the earlier release at this checkpoint; a Host rollout
does not activate the companion metric or review policy.

The first live SQL snapshot identified `taskRequester` in
`src/app/human-task-service.ts` as the largest measured cost: 18 calls consumed
26.85 seconds, averaging 1.49 seconds and peaking at 1.61 seconds. A read-only
query-plan inspection starts with a scan of Condition routes and then an inbox
lookup using only App identity. This is a concrete investigation lead, not yet a
verified fix or attribution of every timeout. Preserve the original link semantics
when comparing an exact indexed lookup on copied data.

Running the candidate App metric read-only against three real heartbeats returned
72.2% SQLite wall time over 135.48 seconds; the metric query itself took about
2.1 ms. This is an early post-startup sample, not steady-state health or a registered
collector/threshold event. The automatic Evaluation → owner decision → repair →
verification chain remains to be demonstrated. Private measurements and query-plan
evidence remain alongside the earlier trial records. The following entries retain
their earlier source and deployment states.

### Earlier source comparisons

The authorized rollout of merged Host `ebe39a5f` completed with healthy readiness
and matching binary/SDK/UI provenance. Its receipt is
`projects/may-agent/.state/deploy-receipts/merged-277-278-20261002.json`.
The installed SDK's `followUp` description delegates durable work; reply policy
lives in `response` and permits quiet background delegation. App definitions
remain their previous release; this rollout did not install the companion App
review/cancellation changes. A short post-rollout probe still found daemon socket
timeouts while the trivial web endpoint remained responsive. CI was also running;
this is a loaded sample, not an idle benchmark or proof of one remaining cause.

Host `937f0bf4` repairs the admission lookup using an indexed explicit TEXT Task
key, with the original generation comparison as a covered index value. It does
not use unary `+` or coerce generations. Available Conversations are computed
once per scan. The production function returned identical results on the retained
snapshot with zero pending outcomes and nine deliberately missing deliveries.
Three paired samples took roughly 2.9–3.4 s before and 0.6–0.7 s after. Other
trials materializing more intermediate data added complexity without sufficient
gain and were not adopted. The source regression checks a populated index upgrade,
legacy numeric/text/invalid JSON identities and the actual query plan. Full local
CI passed: 3,376 tests, three deployment skips. PR #280 is merged as `04b13a3c`;
this source is not deployed.

Host [#281](https://github.com/hao1939/may-agent/pull/281), source `cbefd905`,
repairs another confirmed defect from the retained token audit: ordinary helpers
can successfully call `finish` without ending their invocation. The separate
candidate marks valid base completion terminal and uses the existing runner hooks
to stop mixed batches and leave queued input for later work. Five regressions fail
against merged main; targeted direct/managed/required/schema-backed, rejected
completion and queued-input cases pass with the candidate. Valid results still
survive shutdown. Full local CI passed: 3,382 tests, three deployment skips.
The common rule belongs in [Sessions](../2a-design/sessions.md),
not in a special agent's retry policy. This does not prove all model/provider
timeouts have the same cause.

Host [#282](https://github.com/hao1939/may-agent/pull/282), source `f734ee6c`,
adds the SQL observations described below. Full local CI passed on top of merged
#280: 3,378 tests, three installation-only skips, no failures. The final retained
snapshot trial ranked a 2.65-second query first by cost and 100 cheap reads
(0.31 ms combined) first by frequency. This tests attribution, not a new query
optimization. The May metric suite passed all six tests, with the full May suite
at 150 passes and one existing skip; type checks, bundle and design integrity
also passed. Host and App SQL changes remain undeployed. GitHub check/review
status belongs to the PR, separately from this local verification record.

The proposal at `projects/may.app/design/token-efficiency-proposal-20261002.md`
also covers the separate Evaluation clock, meaningful Condition selection and
context costs. #277 already reduces automatic reference expansion; it does not
establish a universal final-context budget. The prepared Evaluation companion
fix bases routine eligibility on successful publication and separates capacity
from same-metric cadence. Its clock choice differs from that proposal's immutable
review-completion timestamp and must be reconciled before claiming the latter's
replay guarantee. No additional retry cap or semantic wake filter is adopted here.

## Implementation boundaries

**State queries first.** Repair `returnedAttemptSql` and its existing
`idx_app_task_admissions_target` use in `conversation-task-turns.ts`. The same
eligibility predicate serves event admission and missed-event recovery. Check
canonical string Task IDs and integer generations, malformed/legacy values,
selected reports, seeded work, cancellation, multiple Topics and old unhandled
outcomes. Unary `+` demonstrated the affinity problem; it is not automatically
the final solution because removing affinity can change comparisons for mixed
types. Choose a clear typed predicate/index pair and test its meaning as well
as its query plan. Preserve exact current admission links and every independently
eligible result; do not substitute newest-attempt-only or a recent-time cutoff.

**Recovery execution next.** `app-inbox-runtime.ts` currently performs the whole
Conversation discovery read inside the synchronous Event route. Recovery should
use the already retained review Event and existing admission coordinator. If
bounded indexed selection still exceeds the callback budget, extend the existing
private admission worker with that specific read/selection operation. Do not add
a generic job service. Keep one recovery request in flight, bounded candidate
pages and a real yield between pages, so recovery cannot monopolize ordinary
admission in that worker either. The parent reuses exact IDs and normal admission;
the worker does not judge outcomes or own new durable work.

Scan position is an execution optimization. An interrupted sweep can restart
from retained links; handled input IDs suppress duplicates. Each completed sweep
starts again so later acceptance of an old attempt is not skipped by a permanent
high-water mark. Mark the review handled only after its required scan/admissions
have completed. Failure preserves its existing pending delivery. Recheck current
eligibility at admission; a stale selected row is not authority to act.

**Keep transactions short.** Preserve synchronous atomic settlement. Do not put
`await` inside a transaction or globally replace the SQLite retry helper. Move
expensive reads out of write transactions where current-state revalidation can
remain cheap. Audit callers separately: after durable acceptance, transient
delivery failure can use existing recovery; before acceptance, return a clear
retryable failure. Worker/startup retries can remain longer. Reducing daemon
retries requires proving that each caller retains or rejects its obligation;
otherwise it trades latency for lost events.

**Complete cancellation in readers.** The companion Apps change already forwards
the observer signal to HTTP and socket readers and closes cancelled sockets.
Keep observer occupancy until the underlying read settles. Starting a second
read merely because a timeout fired would compound load. CPU-heavy App inspection
needs an execution boundary; a cooperative AbortSignal alone does not provide
preemption. Do not move every observer to a new pool without demonstrating need.

## Recovery and diagnosis when this mechanism fails

Use existing subscriber timing logs, observer health, heartbeat and status
diagnostics. Add only the missing measurements to those surfaces: operation
identity, elapsed handling time, last successful check and overdue age. Keep
one bounded summary per existing observation interval, not one new Event or
Telegram message per timing sample.

### SQL visibility and routine review

The existing status diagnostics expose process CPU/memory, and subscriber logs
time larger callbacks; neither identifies SQL cost. The separate candidate
instruments the shared SQLite adapter and exposes bounded SQL summaries through
the existing `status` read with `diagnostics: true`. It records completed prepare,
get, all, run and exec calls, errors, elapsed time, averages and maxima; ranks
query shapes by total time, worst time and frequency; and reports untracked work
when its cap is reached. Bound parameters, result rows, database paths and error
messages are omitted; literal values/comments in displayed SQL are masked. This
is diagnostic context, never another authority for work or an action registry.

Counters are cumulative for one process lifetime, identified by PID and `since`.
Query rankings rotate in five-minute windows, retaining the current and previous
window with explicit timestamps. Each window tracks at most 512 operation/shape
pairs and returns the top ten by total time, worst time and calls. Rotation keeps
startup shapes from permanently filling the tracker. Lifetime totals include all
measured calls, including work omitted from bounded rankings; a nonzero untracked
counter warns that the ranked set is incomplete. Empty or old windows are not
proof of current health.
They cover the shared adapter in that process, not every child, external CLI or
raw driver connection. Compilation and execution are separate operation groups.
SQLite lock waits are included in call time; sleeps outside the adapter are not.
The prototype's bounded shape cache reduced repeated preparation overhead from
roughly 6–8 microseconds to about 1–2 microseconds per cheap read in a small local
trial. Those noisy samples are not a production overhead guarantee.

For routine review, use existing measurement/observer scheduling and Evaluation's
normal review path. Compare count/error/total-time deltas across samples from the
same process; reset the comparison on restart. A lifetime maximum is an
investigation lead, not evidence of a new incident. Rank total cost as well as
individual latency: many cheap calls can monopolize the daemon. An unavailable
read or untracked cost is a coverage gap, not a healthy result. May owns whether
the finding warrants a fix and retains the same investigation while it does.

Compact counters also travel in the existing minute heartbeat; top-query details
do not. May's companion metric uses the existing five-minute collection schedule
and indexed, recent heartbeat reads to calculate SQL time as a percentage of
observed daemon time. It separates process lifetimes and leaves missing/stale
coverage unknown. An initial App threshold is 25% across three consecutive
samples, requesting ordinary Evaluation/May investigation, not cancellation or
restart. Tune that attention policy from experience; it is not a Host invariant.
The portable App test exercises real collection, counter deltas, restart and
missing/stale data. A real isolated daemon test verifies heartbeat persistence
and the public diagnostic read. Neither is a claim of live automatic review.

Roll out the Host before installing this metric definition. Recent heartbeat
history supplies the comparison window without a new sampling loop, query log,
registry or database write per query. Worker/web attribution remains follow-up
guidance if daemon totals and recent on-demand rankings prove insufficient.
The existing stale-heartbeat check provides liveness evidence while
the daemon cannot publish a new sample; an old SQL rate cannot certify current
health.

Evaluation judges repeated latency and coverage loss across successful and failed
work; May decides whether an existing investigation owns it or a new one is
worthwhile. An isolated successful retry does not erase recurring cost. Conversely,
a timeout alone does not prove the source metric or domain outcome failed.

A daemon cannot reliably detect its own event-loop stall while it is stalled.
Its heartbeat timestamp must be readable from the existing web/maintenance
process or operator diagnostics. If storage itself is unavailable, process logs
and the existing process supervisor are the fallback; an App-based `/todo` cannot
be guaranteed writable then. Automatic restart on heartbeat age alone is not
proposed. Preserve the diagnostic evidence and apply normal fenced recovery
after restart. Evaluation and May remain normal Apps, not required for Host
mechanical recovery.

## Validation and rollout

Keep #277 and #278 focused and mergeable independently. Integrate the companion
App policy/read changes after the Host supports quiet delegation. Do not add the
remaining timeout redesign to either PR.

For the subsequent timeout implementation:

- Use portable fixtures invoking the production selector, with many irrelevant
  admissions/attempts and a few old unhandled results. Assert eligibility, order,
  exact identities and indexed selection. Include mixed types and cancellation;
  matching an empty production result is not sufficient.
- Exercise a real isolated daemon with background recovery and concurrent status,
  read and control requests. Verify progress and bounded responsiveness, not
  merely that a timer was installed. No live model or production deployment in CI.
- Inject contention before commit, a lost reply after commit, and worker exit
  between selection and admission. Verify truthful acceptance and eventual
  recovery of the same identities without duplicate Tasks or lost outcomes.
- Verify cancellation releases the actual HTTP/socket work and retained timeout
  evidence never becomes a success. A deliberately blocked worker must not stop
  the daemon's status/control handling.
- After separately authorized rollout, measure latency and pending age over at
  least two Conversation review cycles, alongside observer success and useful
  human replies. Initial trial targets: ordinary-read p95 below 250 ms, no
  six-second timeouts, no multi-second synchronous background callbacks, and
  continued recovery progress. These are acceptance targets to evaluate under
  declared load, not timing assertions on every CI machine or hard real-time promises.

## Value, cost and lessons reused

The immediate value is cheaper exact reads and a responsive control path as
history grows. Query repair costs little new machinery; existing worker reuse
adds IPC/cleanup paths and can itself suffer head-of-line delay. That is why the
implementation order is query repair, measurement, then only the necessary
bounded isolation. A new database, queue, cache authority, Task cleanup policy,
or notification classifier is not justified by this evidence.

[SQLite's affinity rules](https://www.sqlite.org/datatype3.html#affinity_of_expressions)
and [expression-index matching](https://www.sqlite.org/expridx.html) explain the
measured plan. The [event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
supports keeping synchronous work bounded, not arbitrarily adding workers.
Scout's [unattended execution review](../../../scout-knowledge-lib/knowledge/agent-runtime-unattended-execution-and-replay.md#cadence-attempt-and-settlement-are-different-clocks--talon-github-september-2026)
reinforces that cancellation and elapsed time do not prove external settlement.
Its older [background-overhead finding](../../../scout-knowledge-lib/shared/knowledge/entries/KE-044.md)
is a useful lead to measure below the model-session layer, not current-runtime
proof or a reason to remove periodic recovery.
