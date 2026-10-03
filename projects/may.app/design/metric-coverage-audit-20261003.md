# Metric coverage audit — October 3, 2026

**Supports:** [May's efficiency proposal](token-efficiency-proposal-20261002.md#5-detect-recurrence-through-existing-metrics). Identify useful existing coverage before adding another signal.
**Choice basis:** [Simple first](../../may-agent.app/docs/1-principles/core-principles.md#simple-first). Repair collection, meaning and ownership before extending the catalog.
**Status:** Read-only audit and proposed disposition. No runtime changes, assignments, model calls or deployment. May remained stopped.

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
