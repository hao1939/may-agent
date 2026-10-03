# Metric coverage audit — October 3, 2026

**Supports:** [May's efficiency proposal](token-efficiency-proposal-20261002.md#5-detect-recurrence-through-existing-metrics). Identify useful existing coverage before adding another signal.
**Choice basis:** [Simple first](../../may-agent.app/docs/1-principles/core-principles.md#simple-first). Repair collection, meaning and ownership before extending the catalog.
**Status:** Audit followed by [October 4 source fixes and isolated verification](#october-4-implementation). No runtime changes, assignments, model calls or deployment. May remains stopped.

We have a working metric mechanism and several useful signals. The immediate
problems are catalog drift, an unreachable collector-health threshold, and a
missing connection between recorded execution effort and review selection.
Failure counts correctly measure failure; they cannot establish whether accepted
work was worth its cost.

## Evidence and limits

Source reviewed: Host `e2486a6c7` and Apps `3b0c142c60`. The saved registry contains
176 definitions. Freshness is compared with the last retained daemon heartbeat,
**2026-10-03 00:27:14.690 UTC**, before the deliberate shutdown. Current saved
definitions are not historical definition snapshots. This is neither a live
health check nor proof that current source was installed at that time.

Read-only inventory, query results and the temporary-database retirement replay
are retained locally under `.state/metric-coverage-audit-20261003/`. Private Task
identities and evidence remain there. The earlier accepted-work replay is under
`.state/accepted-work-audit-20261003/`. This document retains aggregate findings
and source references rather than copying runtime conversations.

| Saved registry | Count |
| --- | ---: |
| Active | 63 |
| Retired | 100 |
| Closed | 7 |
| Paused | 6 |
| Active with query sources | 16 |
| Active with command sources | 1 |
| Active relying on explicit recording | 46 |

Of the 63 active definitions, 18 have a sample within an hour of the cutoff,
33 last sampled about 22.7 days earlier, and 12 have no retained sample before
the cutoff. Those last two groups need ownership review; sample absence alone
does not prove an event-driven metric is broken.

## Existing coverage and recommended disposition

The groups below account for all 63 active definitions.

| Group | Count | Finding and recommendation |
| --- | ---: | --- |
| May reliability | 7 | Keep. SQL occupied time/worst call, unresolved input recovery count/age, failed attempts, unfinished Evaluation review age and unsuccessful Evaluation attempts all have recent samples. Preserve their stated scope and denominators. |
| Host collection/delivery | 3 | Keep stale-collector and subscriber-failure detection; recalibrate the former. Review the meaning of `event.unhandled-signal-count-1h` before treating every counted event as lost work. |
| Workflow outcomes | 4 | Keep as descriptive rolling gauges. They count top-level workflow runs, not useful Task outcomes; no thresholds are declared. |
| Old query-backed checks | 3 | Review `event.pair-orphan-count` and the two `session.finish-blocked-*` queries for retirement or deliberate migration. Fresh queries against legacy records do not establish coverage of today's Task model. |
| Scout library health | 1 | Keep. `scout.knowledge-preamble-coverage` has a recent explicitly recorded sample. It measures one structural aspect of the library, not content quality or delivered value. |
| Legacy maintenance catalog | 33 | These `tech-lead`-owned explicit-record definitions last sampled about 22.7 days earlier. Includes old handler, guard, project, session and runtime checks. Identify useful current equivalents, then retire obsolete definitions or migrate a specific needed collector to an active owner. Keep the platform App paused. |
| Gym | 11 | No samples. Six producers are in archived `improve-agent.ts`; five receipt-based replacements have `supersedes` metadata but no current collector was found. The current Gym App declares no such sources. Retire obsolete meanings; add only a justified measurement of the current comparison process. Do not fabricate zero observations or periodic cadence. |
| Platform migration | 1 | `may-agent.migration.legacy-app-count` is transition-only, has no sample and belongs to the paused platform App. Retire after checking the migration's disposition; do not keep commissioning missing-data investigations indefinitely. |

The 33 legacy definitions include `agent.*`, `handler.*`, `guard.*`, `project.*`,
old provider/planner/session checks, and explicit-record infrastructure checks.
Their owner field is a legacy agent name. Evaluation resolves ownership against
the installed App catalog; a name that cannot resolve uniquely is an evidence
gap, not an implicit assignment to a new owner.

All saved `aks-rp-e2e` definitions are already inactive: 39 retired and 7 closed.
Keep them that way. Of 6,464 measurement-failure events in the preceding day,
6,456 belong to definitions now retired. Eight concern active definitions. In
the last hour there is only one measurement failure, a SQLite lock while reading
the unhandled-signal metric, followed by a newer sample. Historical totals do
not justify repairing the retired AKS producer.

### 1. The collector-health threshold cannot fire for today's population

`metric.stale-active-count` selects active metrics with a positive declared
sampling interval, excluding itself. Only **13** current definitions qualify,
but its saved threshold and Host startup definition are **greater than 45**. Even all 13
being stale cannot open that alert.

Keep the existing metric and its grace period: a missing sample is counted only
after `max(15 minutes, two sampling intervals)`. Propose an attention threshold
of **greater than zero**, with the affected collector identities in evidence.
Correct the existing startup definition as well as the installed value: Host
currently redefines this metric when attaching the collector, so a database-only
calibration would be lost. The stale population is useful evidence; the threshold
is attention policy. Moving these default policies into App declarations remains
the existing ownership cleanup, not a prerequisite for correcting 45.

This does not detect the whole daemon being down: the collector and evaluator
cannot run then. Routine deployment/process supervision owns that outside view.
It also deliberately excludes event-driven definitions without cadence. Their
ownership and applicability belong in catalog review, not a fake freshness clock.

Source: Host `src/app/metric-source-measurement.ts` (`STALE_ACTIVE_SOURCE_QUERY`
and default definition).

### 2. Retired definitions can retain open alerts

Three retired Evaluation definitions still have unresolved alert rows:
`evaluator.aftermath-coverage-rate-3h`, `eval.llm-coverage-lag-h`, and
`eval.llm-evals-24h`.

An isolated replay with the current `MetricService` confirmed the boundary:
`define({status: "retired"})` changes the definition; evaluation skips it;
its old alert remains open. Existing `resolveAlert()` closes it without a
`metric.recovered` event. No new lifecycle is needed for this cleanup.

Retirement work should explicitly close those administrative alerts and retain
the retirement reason in its normal source/Task evidence. The existing resolution
method does not persist its optional reason argument. Administrative closure
neither proves measured recovery nor fulfills associated Tasks. Owners still
judge what remains of an investigation. Only consider making retirement and
closure atomic in the existing service if repeated use warrants it.

### 3. Some definitions invite investigation of the monitoring itself

The latest-hour unhandled-event population includes workflow-dispatch,
daemon-heartbeat and skill-loaded observations. Several such observation types
are outside the saved query's exclusions. Delivery status `unhandled` alone
cannot establish that a required effect was lost. Check expected consumer
responsibility before changing a threshold or expanding an exclusion list.
The existing subscriber-failure metric already covers thrown subscriber errors;
neither signal proves a business outcome was delivered.

There is real follow-through, but repeated accepted judgments are not proof of
repair. In the preceding day's attempts, `gym.model-trials` appears in 119 accepted
metric dispositions; `gym.regressions-prevented` appears in 192. Each group belongs
to one investigation Task. These are retained facts, not necessarily that many
distinct judgments or defects. They show why catalog cleanup matters and why
review should inspect outcomes as well as activity.

## Does the review path exist?

Yes. May's App schedules source collection every five minutes. Host records
samples, calculates the metric condition and persists breach/recovery transitions.
Evaluation subscribes to those transitions and also has a bounded rotating
selector, with routine per-metric reconsideration defaulting to daily. May's
`metric-response`/`metric-follow-through` paths retain accepted dispositions and
exact linked work. Evaluation operation signals route directly to May for
independent judgment.

The preceding day contains 132 metric-report publication events and accepted
dispositions for both current and obsolete metrics. Thus review and handoff have
operated; this does not prove every alert got an appropriate response, every
linked action ran, or any fix worked. Source wiring and report publication are
only intermediate evidence.

The same historical period contains 594 breach events, 588 marked `repeat:true`.
Merged Host #300/#301 implements quiet collection, separate calculation and
transition-only notification. Verify those sources when the operator resumes
deployment; do not add a second deduplication mechanism for old evidence.

Known selection limits remain: no-cadence freshness is unknown, not stale;
unknown responsibility needs judgment; bounded rotation has no immediate guarantee
for every newly interesting metric. A missing metric definition cannot trigger
its own alert. These limits explain why a catalog audit is useful in addition to
reviewing breached values.

## The missing coverage: effort that still produces accepted results

The retained usage table already stores App/Task/attempt identity, model replies,
token categories, estimated cost and tool calls. One row is the cumulative usage
of one invocation, updated after assistant replies and at completion. It can
observe a running invocation without waiting for terminal success.

No saved source query reads `execution_usage`, and no metric ID in any status
identifies a token, cost, budget, spend or efficiency signal. The only active
command source measures SQL latency. Existing usage telemetry is available for
reporting, but the audited catalog has no matching attention signal. The
accepted-work replay confirms the narrower point:

| Synthetic attempts | Existing matching failure metric |
| --- | --- |
| 71 accepted/converged attempts, empty considered-input lists | 0 |
| 71 accepted/converged attempts, nonempty considered-input lists | 0 |
| 4 failed attempts | 4, breaching its threshold |

Those failure metrics work as named. Neither empty coverage nor unchanged
requirements proves waste: intermediate artifacts and legitimate partial work
can be useful. Supply the evidence to a reviewer rather than rejecting results.

### What a first attention signal would select

At the audit cutoff, group cumulative replies from invocations whose usage row
was updated in the preceding hour by exact App/Task. The leading groups are:

| App / kind of work | Observed replies | Invocations |
| --- | ---: | ---: |
| May / recovery investigation | 339 | 99 |
| May / human Conversation | 235 | 65 |
| May / SQL and reconciliation diagnosis | 51 | 6 |
| May / metric follow-through | 43 | 7 |
| Scout / library maintenance | 37 | 2 |

A provisional threshold of 100 replies selects the first two for attention;
50 selects three and 30 selects five. A busy Conversation may be justified by
human input. These are calibration candidates, not waste labels or evidence of
savings. One historical cut cannot establish false-positive rate or the best
threshold. The [refined proposal](token-efficiency-proposal-20261002.md#5-detect-recurrence-through-existing-metrics)
defines this cohort precisely and requires a trial before enabling alerts.

### Accounting limits that must remain visible

- These are whole-invocation totals for recently updated invocations, **not**
  replies or spend occurring exactly within the last hour. An older running
  invocation retains its full total; a recently inactive one later ages out.
- Saved rows overwrite cumulative snapshots, so exact historical minute-by-minute
  consumption cannot be reconstructed. Do not promise historical alert replay
  from those rows alone.
- Managed invocations have coverage. In the preceding day's attempt sample,
  all 56 Evaluation `codex-goal` attempts had no linked `execution_usage` row.
  The managed collector also skips persistent chat. A code-only workflow may
  correctly have no model usage; absence alone does not prove telemetry failure.
- Provider pricing can be missing or zero despite real usage. Estimated cost
  is not a bill. The first threshold should use observed replies; preserve
  measured-token/pricing coverage alongside supporting evidence.
- A hung provider call before a reply has no new reply observation. Existing
  execution/error/age evidence remains complementary.

The audit aggregation took about 13 ms over 15,339 usage rows but scanned the
table: there is no `updated_at` index. Before scheduling it, add an ordinary
index for the chosen time-filtered read and check its query plan. Do not turn a
small current table into an assumed bound or add a rollup service prematurely.

## Recommended sequence

1. Correct the stale threshold and perform a reviewed catalog cleanup through
   supported definition/alert operations. Preserve history and independently
   accountable work. No moving or deleting Task records.
2. Add the proposed effort observation in calibration mode, using current usage
   records and existing metric collection. Show coverage limits explicitly.
3. Connect its two responsibility scopes to the existing review paths: Evaluation
   reviews other Apps; May reviews Evaluation. Prove accepted judgment and linked
   follow-through, not just event emission.
4. Compare suspected churn with useful expensive work and a genuine wait. Only
   then enable the chosen threshold. The stopped runtime needs a separately
   authorized trial; this audit has not changed it.

Native usage coverage is a factual Host adapter gap to address through the
existing usage record, if the provider exposes trustworthy measurements. It does
not require another alert mechanism. More anomaly counters, a new scheduler and
automatic “no progress” rejection are deferred until evidence shows a need.

## October 4 implementation

**Status:** Source implementation and isolated verification. The installation
remains stopped; this is not a completed rollout or a change to its saved registry.
Host source: [`3b21b5766`, PR #306](https://github.com/hao1939/may-agent/pull/306).
The App companion is on `fix/metric-coverage-20261004` and is integrated locally
after its checks. The Host PR and runtime activation remain separate steps.

| Audit finding | Source correction |
| --- | --- |
| Unreachable stale threshold | Existing Host definition uses `> 0`, retains the cadence grace, gives new collectors first-sample grace, ignores future-dated samples for freshness, and includes exact stale examples. |
| Retired alerts remain open | Explicit retirement/closure in `MetricService.define()` quietly closes open alerts in the definition transaction. Repeated activation retains history and closure time; no recovery event or Task completion is invented. |
| Obsolete catalog | May declares 47 reviewed legacy definitions retired: 33 paused-platform checks, 11 obsolete/unimplemented Gym checks, two legacy session checks and the transition-only migration check. This is an explicit list, not an age-based retirement rule. Existing retired Evaluation declarations repair their old alerts through the same Host operation. |
| Event-pair query | Retained as diagnostic inventory without its arbitrary attention threshold; it cannot establish a current Task failure. |
| Passive events look unanswered | Daemon heartbeat, workflow-dispatch and skill-load producers use the existing record-only marker. Durable subscribers still accept work when applicable; optional observation does not require another consumer. Historical rows are unchanged and age out normally. |
| Effort invisible to selection | Two query-backed observations use the existing cumulative usage rows and a normal `updated_at` index. Definitions start without alert thresholds; existing routine review can inspect them. The independent May route is ready for the Evaluation scope when its threshold is enabled. |
| Overinterpreting effort | Evaluation guidance asks it to inspect useful artifacts, accepted results, outstanding requirements and waits, and recommend the smallest worthwhile change or no change. May judges the recommendation. |

Current native Codex progress reports expose goal tokens/status and coarse native
turns, not the managed collector's assistant-reply accounting contract. Treating
those counters as equivalent would manufacture coverage. The new observations
explicitly retain this limit; native accounting remains a separately scoped
adapter extension, as proposed. It does not prevent reviewing native failures
through existing attempt and age metrics.

The fixture uses production usage persistence, the source query, metric service,
Evaluation report publication, May intake and Host Task acceptance with scripted
judgments. Productive high effort reaches an accepted `no-change` decision;
continued samples do not emit another breach. Query tests include accepted-work
activity, a running invocation crossing the hour boundary, quiet waits, exact
ownership scopes, unavailable reply accounting and indexed selection. Retirement
tests cover rollback and retained observations. These prove mechanics, not model
judgment quality or measured token savings.

Verification: Host `bun run ci` passed (3,527 tests, three deployment-only skips,
zero failures). May/Evaluation tests passed (427 tests, one existing skip), and
the final effort-query regression passed after adding unattributed-usage evidence.
May's typecheck and the design integrity/examples check passed. The design check
retains the existing unclassified `reports/` warning. Evaluation's separate
typecheck still reports SDK `task-contract.ts:584` union narrowing under its
non-strict configuration; the unchanged baseline reports the identical error.
This is a known check limitation, not a claimed clean typecheck for Evaluation.

Integrate the Host correction before activating the App definitions. Normal
activation performs catalog retirement; no production SQL patch or data movement
is required. Keep the platform App paused. Keep effort alerts in calibration
until an authorized runtime trial compares useful work, review cost and noise.
Existing investigations retain their work and are reconsidered by their owners;
retiring a metric does not silently finish them.

### Legacy source cleanup

The follow-up removes the unused 1,653-line platform metric collector, its cron
entry, its private ownership helper and tests for the deleted implementation.
Two unreferenced command collectors for historical hypothesis/heartbeat metrics
are removed as well; neither has an active saved definition.
It could otherwise reactivate the retired catalog if restored to service. The
platform App remains paused; May's existing collection schedule still owns
source collection. The event name `trigger.metrics-snapshot` remains its ordinary
Host input and does not imply that the old handler is required.

Evaluation's eleven retired metrics now retain only identity/display information
and retirement intent. Their old session SQL, thresholds and query-only tests
are removed. May's 39 AKS retirement definitions likewise drop obsolete commands
and alert policy. The obsolete heartbeat skill that required all red metrics to
take priority over other work is removed; current metric review and owner judgment
remain the policy. Old implementations and full definitions remain in Git history.

The 47 newly retired definitions still need normal activation in the stopped
installation. Removing their IDs now would leave its saved rows active. These
are upgrade declarations, not additional collectors. A disposable-database
activation test covers all 97 retirement declarations across May and Evaluation:
alerts close, queries/commands/thresholds are cleared, and samples remain. No
production rows or historical records were deleted or moved.

PR review also exposed a missing creation timestamp on legacy definitions:
future-dated measurements can update the definition timestamp as well as the
sample. The stale check ignores both future fallbacks and uses millisecond
precision consistently, preserving the first-sample grace for new collectors.
The query correction and regression are in Host `d0f8476d8` on PR #306. Testing
the intermediate review suggestion caught its whole-second cutoff incorrectly
classifying newly created collectors as overdue; the final check uses the same
timestamp precision as storage.
Host full CI passes on that revision (3,527 passed, three deployment-only skips).
The cleanup also passes May's typecheck and the design integrity/examples checks;
Evaluation retains the identical baseline SDK narrowing error described above.

The broader App/maintenance check passed 473 tests with one existing skip and
four pre-existing failures. The same four fail on unchanged Apps `2300003c83`:
three obsolete heartbeat-manifest expectations and a platform owner-review
schema assertion. Current May/Evaluation tests and retained maintenance-handler
tests pass. The paused platform's unrelated workflow failures are not fixed or
hidden by this cleanup.

### Persistent-chat usage follow-up

Source cleanup `9bbab4a0e5` removed the obsolete shared App expectations and
aligned the callable owner-review helper with the SDK result contract. Its
broader App check passed 463 tests against the Host correction in PR #306.

Host [PR #307](https://github.com/hao1939/may-agent/pull/307), source `9ee00aa6f`,
removes the explicit persistent-chat exclusion from the existing usage recorder.
It also saves usage at the chat cancellation and
failure boundaries. One live invocation retains cumulative replies across idle
turns; resume creates a separate record containing only new replies. Missing
Task identity remains unattributed. The same store, query and review route are
used, with no new collector, schedule, event, threshold or cancellation policy.
This is source verification; May remains stopped and older usage is not backfilled.

The focused trial uses the actual manager, scripted local model replies and
temporary SQLite. It verifies two chat turns in one record, retained usage on
close/failure, and one new reply after resume without recounting old messages.
The 19 focused Host tests pass. Full `bun run ci` passes: 3,529 tests, zero
failures and three deployment-only skips. The four App effort-metric tests pass;
design integrity/examples checks pass with two existing root-layout warnings.
Reproduce the focused checks with `bun test src/lib/manager-lifecycle.test.ts
src/lib/chat-runtime-policy.test.ts src/app/adapters/reporting/context-usage.test.ts
src/lib/execution-usage.test.ts` from the Host checkout. From the App checkout,
run `bun test ./projects/may.app/effort-metrics.test.ts` and
`bun run check:may-design`. All trial replies are scripted locally; these checks
do not establish native usage coverage or live deployment behavior.

Native usage remains a separate next step. Official [app-server turn events](https://learn.chatgpt.com/docs/app-server#turn-events)
include `thread/tokenUsage/updated`; the installed CLI 0.159.2 schema exposes
`tokenUsage.total` and `tokenUsage.last` per thread. These are not the managed
assistant-reply counter, and a resumed thread spans multiple May attempts. The
container still pins 0.156.1; this schema inspection is not compatibility proof
for that pinned version. Before extending accounting, verify that version with
the existing local protocol fixture, then preserve the native counter's exact
scope and demonstrate that resume does not duplicate prior consumption. Do not
make an uncertain conversion merely to fill the coverage gap.
