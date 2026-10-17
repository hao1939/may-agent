# Container resume review — October 17

Core durable Task recovery worked and delivered useful outcomes. This startup
does not establish a fully clean, inexpensive or intuitive resume experience:
SQLite contention lost one completed session's end digest, reviewer work was
costly, and schedule/status language obscures what actually resumed.

This was a read-only runtime review. No synthetic wake, agent message, runtime
repair, deployment or restart was performed for this review. The only repository
change is this report. Times below are Asia/Shanghai (UTC+8).

## Observation boundary

- Container `may-agent` started at **2026-10-17 14:40:11.637**. Docker reports
  healthy, restart count zero. Initial daemon readiness took 1,309 ms.
- An orderly daemon restart inside that container occurred at **14:49:11–15**;
  the old daemon exited zero and the replacement became ready in 909 ms.
  This is separate from Docker's restart count.
- Current Host is `v5.5.0 (980f2cda)`. Active Apps source is
  `9b8da4b74e1fad2ed709142277c9f5e19e513340`.
- The frozen cost/Task snapshot covers **14:40:11–14:52:35**. A bounded follow-up
  through **14:57:33** checks the database errors and resulting Task state.
- The operator says the container had been stopped. Missing samples while it
  was stopped are expected. That gap alone is not evidence of a collector bug,
  crash, or a need for external monitoring.

## Recovery and useful results

Six existing May/Alex Tasks started within seconds. Two had interrupted previous
attempts; the other four were retained work whose waits/review boundaries became
due. Recovery used the same durable Tasks with fresh attempts, rather than
necessarily continuing the old model session in place.

| Inspected work | Result after startup |
| --- | --- |
| Alex `input/appdep_37618a172b1fc38fe72cb127`, previously interrupted | Implemented the one-time inbox migration guard, obtained Bob's independent review and integrated Host PR #378. Source `87f6ff7e9b`, merge `980f2cda39`; retained review reports 10 passing tests / 97 assertions. |
| May `goal/appdep_20bd942d5040da80b7940f3f`, previously interrupted | Completed a bounded query-cost investigation: next recorded collection pass 85.18 ms versus the earlier 5,905.72 ms; all three previously slow sources below 100 ms. Evidence did not justify speculative index changes. |
| May `goal/appdep_37ffe4737b7832dac1409074`, previously waiting | Verified approved/green protected integration of PR #369 at `653d41e480` and completed the existing Task. |
| Existing parent dependency chains | Returned results to their existing May/Alex owners and retired the corresponding waits. Legitimate human waits remained. |

The second daemon restart interrupted Alex Task
`input/app_91008b85-5d9d-4643-b131-b6b74b9f9ede`. Recovery recorded
`previous-runtime-attempt-requeued`, then ran a new attempt of the same Task and
generation. Its result admitted one May investigation,
`goal/appdep_c7098340ee8c5de1b6bc9709` (event `6677596`), and retained its exact
dependency wait. No duplicate downstream request was observed in this path.

The frozen window has 23 attempt starts and 20 accepted settlements: 14
converged, six waiting. One attempt was interrupted by the orderly restart and
two were running at the cut. No failed Task settlement was observed in this
window. This is bounded evidence, not a claim that all historical Tasks or every
external effect were independently checked.

## Actual abnormality: SQLite contention

At **14:50:23**, `session.end` event `6677612` encountered `database is locked`
in a first-priority subscriber, delivery bookkeeping and the end-digest writer.
Persisting the diagnostic failure event also failed. The event is now stored
with delivery status `accepted`, through the lifecycle pair-tracker fallback;
that status does not prove every subscriber side effect succeeded.

Session `s_1792219790815_aa902b3c-7005-42b0-b74d-fc2f14dbca6b` is correctly marked
done but still has only its start digest, whose outcome is `in_progress`.
The completion digest had not recovered at the follow-up cut. Among 22 sessions
marked done since startup, this was the only one missing an `end` digest.
One separately interrupted session also had no end digest.

The affected conversation had accepted a new human Scout-quality review. Its
follow-up Task `goal/app_b514de9f-7426-4974-a08b-280ba5a4ae0f` was admitted and
subsequently converged. Thus the requested work survived; the observed loss is
completion history/bookkeeping, with the complete subscriber impact not yet
established. A later `workflow.started` subscriber also hit a lock at 14:55:37
(diagnostic event `6677671`); the corresponding selector still completed and
settled. The current daemon heartbeat reports five SQL errors.

This is a **Host reliability issue** to investigate with a bounded contention
reproduction and an idempotent repair/retry design for affected records. Do not
treat merely increasing a timeout or replaying arbitrary event side effects as
an established solution. The event bus deliberately avoids repeating ordinary
subscribers on durable redelivery; the digest writer currently logs and drops
failed writes.

Separately, `/app`'s backing filesystem is **98% full**, with approximately
**7.1 GB available** (`df -h`). Capacity remains an operational concern after
the earlier disk incidents. The observed errors say locked, not disk full;
this review does not establish a causal link between those conditions.

## Scheduling and human interpretation

Alex's selector and six-hour audit use durable scheduled inputs with latest-slot
catch-up. The audit ran once on startup; missed slots were not all replayed and
the second daemon restart did not duplicate the accepted audit slot. Subsequent
selector passes retained their allowance and code-only skip behavior.

Scout's source schedules use event schedules. Those initialize at the current
slot and wait for the next boundary; they do not catch up immediately on restart.
GitHub/HN run every two hours; Reddit/XHS/arXiv every four. From this 14:40
startup, their next normal boundary is **16:00**, provided the runtime stays up.
No natural post-repair source execution was available at the review cut. This
explains the silence without implying a stuck source queue, but auditors waking
before new research is a surprising product experience.

The intended source-resumption policy belongs to the **App**. Make it explicit
and visible. If the desired behavior is one latest due research opportunity on
startup, use the existing durable input scheduling semantics and verify stable
Task identity/idempotency; do not replay every missed scan. Preserve useful
wakes and legitimate external waits.

Two Host presentation issues further confuse the picture:

- Startup says two sessions "could not resume" although their durable Tasks
  recovered and completed. Distinguish an interrupted execution from a recovered
  Task, and only report recovery as successful once observed.
- `apps.list` reported Alex **502 active**, with **zero running and eight waiting**.
  The active count includes 494 converged retained Tasks. Telegram renders that
  broad count as "active"; the web Apps table already separates running/waiting/
  attention. Present retained/up-to-date, ready, running and waiting distinctly;
  502 must not be interpreted as 502 concurrent model executions.

A stale-metric breach (`metric.stale-active-count`, alert `4990`, event `6677553`,
value seven) was correctly reviewed as shared sampling absence rather than seven
independent failures. Sampling resumed and the metric recovered (event `6677625`).
App wording should describe missing coverage across the stopped interval, rather
than imply a known collector stall. A recovery transition created another review
generation, initially deferred by the shared allowance. This is a real transition,
but its context and value should remain visible.

## Cost and efficiency

Counts below sum recorded input, cache-read, cache-write and output tokens across
replies; they are processed context, not unique content or all uncached input.
Costs are recorded estimates, not a complete bill. Missing prices are not zero.

| Cohort | Executions / replies | Processed tokens | Cache-read tokens | Recorded estimated cost |
| --- | ---: | ---: | ---: | ---: |
| Initial recovery/review executions started before 14:45 | 12 / 83 | 5,869,474 | 4,289,958 | $8.8064, plus five unpriced DeepSeek replies |
| Alex Scout-verification owner + Evaluator six-hour audit, included above | 2 / 23 | 1,965,256 | 1,426,944 | $2.9429 |
| Entire frozen window | 19 / 140 | 9,535,295 | 7,186,918 | $12.4175, plus 24 unpriced DeepSeek replies |

The whole window includes new human-requested work after startup, including a
separate Scout-quality audit. It must not be labeled pure restart overhead.
The initial cohort also includes real implementation, review and closure work.

The clearest efficiency candidate is the overlapping Alex/Evaluator coverage
discovery: roughly $2.94 to establish that the stopped windows supplied no
usable post-activation samples and retain the verification obligation. That is
a valid judgment, but substantial context work for limited new evidence.
Supply compact deterministic runtime/coverage facts and reuse the completed
Evaluator report in Alex's follow-through. Keep distinct owner and reviewer
responsibilities and preserve meaningful work opportunities; do not simply
disable wakes or claim measured savings before comparable runs exist.

## Recommended order and ownership

1. **Host reliability:** establish the SQLite writer/transaction conflict and
   recoverable completion bookkeeping. Verify contention recovery without
   duplicate Task effects or silently stale history.
2. **Installation operations:** investigate remaining disk growth and retention
   using the existing disk work; avoid duplicate cleanup projects.
3. **App policy and efficiency:** Alex owns the explicit Scout resume behavior
   and bounded coverage/report reuse. Evaluator assesses delivered App work and
   cost; Scout performs research. Bob reviews design and Tech-lead implements
   when those specialties are useful, without mandatory handoffs for every item.
4. **Host presentation:** explain Task recovery separately from session restart,
   expose next scheduled work and make Task counts unambiguous.

Acceptance is useful existing work resumed once, honest wait/coverage reporting,
no missing completion record under the reproduced contention, and measurable
reduction in repeated context work without reducing research quality. Natural
post-repair Scout behavior and token savings remain unverified in this startup
window. No new repair request was sent as part of this review.

## Retained evidence and source pointers

Private runtime evidence is under
`/app/.state/container-resume-review-20261017/`: `snapshot.json`,
`resumed-task-comparison.json`, `summary.json`, `lock-followup.json` and daemon
log excerpts. Snapshot SHA-256:
`6678f951c8b3d07147644fb7c502e3284864503926a25adc59a6727d2541ce98`;
comparison SHA-256:
`c13c9e7cadb0bd18ffecf02738cf5cd197b56f9cf5153c84f6f3352dce4867d8`.

Relevant Host source: `src/app/composition/background-startup.ts`,
`src/app/adapters/producers/app-schedules.ts` and its existing restart tests,
`src/app/human-task-service.ts`, `src/app/transport/telegram.ts`,
`src/app/core/events/bus.ts`, `src/lib/session-digest.ts` and
`src/lib/session-subscribers.ts` under `projects/may-agent`. Scout declarations
are in `projects/scout-knowledge-lib.app/app.ts`. Existing source/tests were read;
no model trial or application test run was needed for this documentation-only
review. The PR validation above is retained execution evidence, not a fresh test
run by this reviewer.
