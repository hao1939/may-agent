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

This is a **Host bookkeeping defect**. Its recovery priority depends on whether
it prevents useful work from continuing or materially misleads its owner. Do not
treat merely increasing a timeout or replaying arbitrary event side effects as
an established solution. The event bus deliberately avoids repeating ordinary
subscribers on durable redelivery; the digest writer currently logs and drops
failed writes. The operator's subsequent direction below accepts some history
loss and prioritizes understandable recovery over perfect bookkeeping.

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

The operator clarified the goal after the initial review: failures are expected,
some data loss and repeated work are acceptable, and the system should survive
through a straightforward, robust recovery process. This supersedes the initial
priority on preventing every missing digest or duplicate Task effect. The
observations above retain their original scope; this is a design clarification,
not evidence that the reported errors have been fixed.

1. **Host recovery:** verify that interruption or a failed worker leads back to
   useful work through the existing Task and owner. Check retained intent and
   present reality, continue or retry with bounded effort, and return an exact
   blocker if recovery needs a decision. Prioritize stuck recovery and lost
   actionable follow-through over missing optional history. Keep the path simple
   enough to explain without reconstructing a chain of internal events.
2. **Host presentation:** show what resumed, what completed, what is waiting and
   the next meaningful step. Explain Task recovery separately from session
   restart and make retained versus running Task counts unambiguous.
3. **Installation operations:** investigate remaining disk growth and retention
   using the existing disk work; verify that useful work can continue after
   capacity is restored rather than promising storage can never fill.
4. **App policy and efficiency:** Alex owns the explicit Scout resume behavior
   and bounded coverage/report reuse. Evaluator assesses delivered App work and
   cost; Scout performs research. Bob reviews design and Tech-lead implements
   when those specialties are useful, without mandatory handoffs for every item.

Acceptance is recovered useful progress, bounded repeated effort and honest,
understandable reporting of remaining uncertainty. An interrupted attempt may
restart from available facts. A missing digest alone must not strand its Task.
A repeatedly failing worker must return a usable reason and next step through
its existing owner route. A valid external wait must remain clear without
repeated model confirmation. Check these outcomes with portable failure/restart
fixtures; transaction count and perfect history are not the success measures.

An isolated three-case digest experiment reproduced the separation between
event persistence and optional digest writes against Host `980f2cda39` (0 pass,
3 fail under the proposed stricter contract). No implementation was written.
After this clarification, the experiment was archived externally instead of
promoting its stronger atomicity requirement into the production test suite.
The archive records the exact base, reproduction and disposition. This does
not preclude a small later bookkeeping fix if it earns its complexity.

Natural post-repair Scout behavior and token savings were unverified in the
original startup window. No new agent repair request or runtime change was made
for this review or the design clarification.

## Recovery follow-up: missing session metadata

A portable fixture exposed a concrete Host recovery gap: a retained Task and
attempt could survive while `sessions/<id>/meta.json` was missing. Both startup
recovery and a normal replacement claim rejected that condition, even after the
existing liveness and process-drain checks. This could strand actionable work
because execution history was incomplete.

Host [PR #381](https://github.com/hao1939/may-agent/pull/381), commit `4e0a05ba0`
(base `63301fcae`, PR #379), permits replacement from the retained Task binding
after those checks. It passes readable surviving history and an explicit
missing-metadata fact to the next attempt. It does not reconstruct metadata or
overwrite the old result. Conflicting or corrupt metadata, a live external
owner, and an unconfirmed process drain still block replacement. Standalone
recovery without the retained Task binding still requires metadata.

The new expectations failed against the base. After the change, the focused
recovery tests passed: **10 tests, 83 assertions, zero failures**. Both startup
and normal-claim cases verify an accepted result from the replacement executor,
the surviving transcript in its context, the missing-history explanation and
unchanged old result bytes. These use scripted executors: they prove the
recovery mechanics, not real-agent judgment or live model quality. Full local
`bun run ci` passed: Host/SDK types, the canonical App boundary and lint;
**3,817 tests passed, three skipped, zero failed, 21,973 assertions**. The three
skips are installation-specific agent/fleet configuration checks; browser tests
executed. Those local results apply to `4e0a05ba0`. The branch was subsequently
updated with merged #380 to `767a9c78b`; its Container check passed, but local
and GitHub Quality validation were stopped after the operator redirected work.

**Disposition: draft, unmerged, undeployed; stop individual patch work.** The
operator explicitly requested a general, simple recovery mechanism using agent
judgment. A review also identified that `manager.cancel()` requests cancellation
without waiting for execution/helper cleanup; the proposed success path must not
release ownership while that cleanup is pending. This is an unresolved review
finding, not a completed fix. No implementation was added for it. Do not resume
#381 merely because its initial portable tests passed.

A separate read-only live check at **2026-10-17 08:21 UTC**, excluding closed and
cancelled Tasks, found no pending or attention Tasks in Alex, May or Scout.
Alex had one running and six waiting; May had nine waiting; Scout's retained
Tasks were converged. The missing-metadata failure is a reproduced edge case,
not an established cause of a current live stall. No runtime deployment,
restart, live fault injection, model trial or agent repair message was performed
for this follow-up.

## Proposed mechanism: agent-led recovery under a bounded Host

The paragraphs below retain the earlier October 17 review. The later hierarchy
refinement replaces its independent execution requirement for every owner and
shared recovery allowance with declared escalation and existing controls.

The [unified recovery proposal](../../proposals/unified-agent-recovery-20261017.md)
now owns this direction. Its [current-mechanism review](recovery-mechanism-20261017.md)
records what works, the remaining owner-delivery/setup gaps, and the limits of
existing tests. These supersede the earlier implementation ordering here.

Use one rule across controller, setup and execution failure: retain the work,
give its owner evidence and a usable bounded execution path, let the agent act,
and verify useful work resumes. Repair and ordinary retry share an allowance;
paced availability observations may continue without repeated model calls.
Reuse the existing Task, runner, scheduling and cleanup mechanisms. #381 stays
draft; no individual patch work or runtime changes are part of this review.

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
are in `projects/scout-knowledge-lib.app/app.ts`. The initial review read existing
source/tests and retained PR validation; it did not run fresh tests. The recovery
follow-up above separately records the new source change and portable checks.
