# Bounded May project-review pilot — 2026-09-12

**Status:** Preliminary isolated trials and one real local-container review
completed. This is evidence for the
[review-loop proposal](../../proposals/may-project-review-loop-20260912.md),
not activation of a standing review service.

**Subsequent design refinement:** Hao questioned the need for a special
owner-review task. The proposal now recommends an ordinary periodic May Task
using existing timed waits. Live hygiene Task `9071edf7` supplies evidence that
this mechanism is available in the container. Host Operations activation is
optional; the placement history below records the original experiment choice.

## Question and placement correction

Can an ordinary May Task use the proposed method to review current design,
implementation and execution, make a useful scoped improvement, and retain
the result across a later wake?

Hao authorized a bounded pilot **with local may-agent**. The operator initially
ran separate Bun daemons with private databases. Those trials exercised real
May mechanisms, but did not meet the intended placement: nothing appeared in
the user's running `may-agent` container. Hao identified this mismatch. Runtime
placement is part of acceptance, not an incidental test setup choice.

The running container was `may-agent`, image
`localhost/may-agent:local-v200-8bbddd8a`. Its loaded App source descriptor was
`258ec48fe64749258dd6804aee2e098caf58a7ca-definitions-v4`, selecting only
`may.app` and `scout-knowledge-lib.app`. A retained Host Operations row did
not prove that App was loaded. Its proposed `runtime/platform-owner-review`
path could not simply be treated as active.

The correction used the loaded May App's existing `goal` input and Task
mapping. May owns this finite documentation trial; Host Operations retains
ownership of Host deployment/runtime work. No App selection, standing schedule,
agent identity or runtime configuration was changed. Enabling Host Operations
would also require considering its retained work, beyond this bounded case.

## Preliminary isolated experiment

Two sandbox installations used the actual Host Operations App, ordinary
`owner-review` admission, `runtime/platform-owner-review` Task controller,
`tech-lead` identity and model `gpt-5.6-sol`. Host source was
`8026aff97585edd7f728fa4ce360fdde71bc740a`. Relevant entry documents were
identical between arms; the treatment added an explicit pointer to the
proposed review method and result-placement guidance.

Tools were temporary confined wrappers around real read/write tools plus
fixed inspection operations. Reads stayed inside the sandbox; writes were
limited to its Host Operations docs. There was no arbitrary shell, network,
delegation, messaging or remote mutation. GitHub facts were a captured packet,
not freshly collected by the executor. These controls and full-file-only
writes differ substantially from the installed agent's tools.

The packet distinguished an older local checkout from remote main
`b1c7cbef5a6efea5f494d2a44e4f9e861ab0dc59`, merged #172, open #173, and open
scripts-retirement PR #174 at `4c66e70f71a32c93b4d231a49ca938229b0606cf`.
It was captured at **15:07:56 UTC**, not a timeless statement of PR status.

| Execution | Accepted result | Duration | Reported total tokens, including cache reads |
| --- | --- | ---: | ---: |
| Ordinary guidance | Found navigation counts inconsistent with the owning proposal; deferred correction because #174 remained open | 41.4 s | 108,674 |
| Explicit method pointer | Substantially the same defer/no-op decision | 67.9 s | 149,893 |
| Same Task after operator correction | Removed volatile duplicate counts from README/INDEX and referred to the owning inventory | 96.7 s | 163,237 |
| Later timer wake | Read the retained result and session receipt; justified quiet no-op, zero owner signals | 27.7 s | 76,557 |

The baseline could discover the proposal through navigation, so this was not
a clean comparison with the method absent. One case, unequal execution cost
and shared guidance cannot establish a general improvement or reliability
rate. The explicit pointer did **not** improve the initial decision here.

The operator supplied one substantive judgment correction: pending scripts
implementation need not block an independently authorized navigation edit;
consider removing duplicated counts. The follow-up accepted that correction,
edited two files (9 insertions, 7 deletions), and checked 158 local paths plus
whitespace. It explicitly did not run Host CI or `check:may-design`. The
operator independently inspected the diff and committed it only in the sandbox
as `6c9fe8e8a918684e8d3e79680709ff81e2e12188` before the timer trial.

The method arm kept generation 1 and the same Task across input, correction
and timer: accepted reconciliation events **10 → 20 → 32**, resource versions
**4 → 7 → 9**. A source reload and daemon restart preceded the timer. A temporary
two-minute interval produced real `project.tick` event **27**; the regular
eight-hour cadence was not observed. The daemon stopped after that result.
This proves one isolated continuation and quiet wake, not later independent
learning, CI-wait handling or a running container review loop.

### Failures and verification limits

- The first daemon failed before model execution because the working Host's
  installed dependency versions lagged its manifest (0.81.1 versus 0.85.1).
  A frozen install in an isolated Host clone fixed the experiment; canonical
  dependencies were not changed.
- A syntax error in the operator's temporary tool adapter removed the needed
  file tools. The agent honestly reported the missing capability. Two attempts
  started before the daemon was stopped; this is harness failure and retry
  cost, not evidence about review judgment.
- Installation-relative tool roots disagreed with paths guessed by the model,
  causing recoverable file-not-found errors, including at the timer wake.
  The container trial therefore supplied explicit absolute document paths.
- Finish validation rejected unsupported deliverable paths; the executor
  corrected its result. A proposed checkpoint path is not evidence that an
  artifact exists or that the current runtime accepts it.
- The sandbox check inspected changed-file paths and whitespace. Runs with
  no changed files did not validate the whole document set. The timer's passing
  empty-diff check was not a fresh content/behavior test.
- Full-file-only write tools inflated output for tiny edits. Token counts
  above include cached input and are not dollar costs or production efficiency
  estimates. Adapter failures add further cost outside that table.

## Visible local-container trial

Admission used the running container's control socket at
`/app/.state/instances/background/may.sock`, via supported `app.input.requested`
publication. Input event **6326093** was accepted and attached to:

- App: `may`
- Task: `goal/app_3ea159fd-6ca8-47db-bb59-87ea5032801f`
- Human task reference: **`a447535d`**
- Attempt: `r_1_b8de237c-76f7-44c8-82cf-10cdc9aaf079`
- Session: `s_1789226245331_6153e1b7-e13c-4cb1-9e7d-0950450d1acc`
- Start: **15:17:25 UTC / 23:17:25 Asia/Shanghai**, September 12

The bounded assignment permits only a scripts-cleanup navigation review,
minimal README/INDEX edits if warranted, verification, and a local evidence
report. It forbids new Tasks, standing automation, source implementation,
commits, PR writes, deployment and messaging. The actual May agent uses its
loaded tools; these are instruction constraints, unlike the confined wrappers
in the preliminary experiment.

The initial readback confirmed `running`, generation 1, resource version 3,
with a real session. Accepted reconciliation event **6326107** then recorded
`converged` at **15:19:53 UTC**. Final Task readback was **`up-to-date`**,
generation 1, resource version 4, one attempt and no Conditions/dependencies.
The review finished in approximately **149 seconds**. The Task remains retained
(`terminal: false`); no recurring review was configured for it.

The session used `gpt-5.6-sol`, 12 assistant messages, and reported 139,048
input tokens, 10,485 output tokens and 528,384 cache-read tokens (677,917 total).
This cost belongs to one heavily scoped documentation case, not a demonstrated
efficient recurring process. One `finish` call failed result-schema validation;
the agent corrected it and the next result was accepted within the same attempt.

The agent corrected only the scripts paragraphs in the two navigation files,
changing 54/27 to the owning proposal's 57/28 implementation baseline. It also
named draft PR #174 at head `578411ae` and passing checks. This differs from
the preliminary candidate, which removed duplicated counts. The operator did
not replace the agent's result with that earlier patch.

The real executor read the intended design and proposal, inspected local code,
ran the design check before and after editing, inspected the full diff and
checked the two relevant links. It recovered from missing `gh` by using
read-only GitHub REST requests. Its newer PR evidence differed from the earlier
operator packet, correctly illustrating why mutable facts need refreshing.
It attempted to distinguish remote main from the locally available tree, but
a later review found that its remote lookup used the wrong repository. The
correction and its implications are recorded below; the original report's
remote-main/tree-unavailable conclusion is not reliable evidence.

The executor's report is
`/app/.state/review-pilots/may-project-review-20260912/container-review.md`.
Its accepted result records passing `check:may-design`, whitespace and focused
links; full Host tests were not required or run for the documentation change.

### Operator assessment

This establishes an actual visible container Task, fresh execution and accepted
useful result. No mid-attempt operator correction was sent. However, the initial
container assignment already incorporated the preliminary lesson about pending
implementation and documentation. The case was narrow and explicitly selected
by the operator, so it does not demonstrate independent discovery or learning.

Refreshing duplicated counts and adding a PR head/check status to navigation
leaves future maintenance work. The stronger preliminary correction was to
refer readers to the owning inventory. Preserve this difference as an adoption
gap, not a claim that the container agent learned that simplification.

The report also calls one broad-link-probe failure an existing stale anchor.
At operator readback, the target proposal contained an explicit HTML anchor
with that identifier. The heading-only probe did not recognize HTML anchors,
so the reported failure does **not** establish a currently broken document
link. No anchor repair was needed. This is another example of assessing a tool finding before
turning it into cleanup work.

After the accepted review, the operator updated research/proposal navigation
and this evidence record. These documentation changes are separate from the
container agent's two-paragraph correction and are not attributed to its Task.

### Subsequent repository-identity correction

Another local review supplied targeted feedback through `app.input.requested`
event **6326113**, explicitly attaching it to the same Task with `targetTaskId`.
The original lookup had run unqualified `git ls-remote origin` from the outer
`/app` repository, then mislabeled that result as May Host remote main. The
failed commit API request did not justify declaring the correct tree unavailable.

The correction bound the lookup to `https://github.com/hao1939/may-agent.git`,
verified remote main `b1c7cbef5a6efea5f494d2a44e4f9e861ab0dc59`, and inspected
the object already present in `/app/projects/may-agent`. Accepted reconciliation
**6326118** updated the report, preserving the scripts-navigation changes.
The same Task remained generation 1, resource version 6. This was controlled
review feedback, not an independent learning result or natural timer wake.

Preserve this failure in assessment: an explicit revision is not sufficient
evidence without the repository it describes. Use scoped Git commands and
existing objects before concluding that a fetch or external repair is needed.

## Ordinary periodic retry and refinement

Hao then authorized retrying and polishing the bounded pilot using an ordinary
periodic Task. The operator first attached a three-review extension to existing
Task `a447535d` through input event **6326131** (`targetTaskId`, same generation).
It allowed only the scripts-navigation paragraphs and a new cumulative report,
with two one-minute timed waits and a stated end after three reviews.

### Extending the original Task exposed two gaps

Review 1 removed the copied inventory, PR head and check status from README/INDEX
and linked the owning accepted decision. This useful change remains in the
working tree; no source implementation was attempted. Its design and focused
link checks passed. Accepted result **6326137** saved count 1, hashes, the next
review and a 60-second Condition review deadline, leaving the Task waiting
without a worker.

The Host started a fresh attempt **62.354 seconds** after that accepted wait,
with reason `condition-review-checkpoint-missed` and the same continued input
key. This is direct evidence of a genuine timed wake, without an operator
kickoff, private daemon, App schedule or polling agent.

The continuation did not satisfy the assigned review:

- `targetTaskId` attached new input; it did not revise the Task's durable intent.
  The timer prompt prominently repeated the original one-pass instructions and
  old report path. It included the previous accepted result and its continuation,
  but not the full new periodic assignment. The agent followed the superseded
  review, repeated broad checks/remote queries, and rewrote the historical
  report instead of performing the transfer check in the new report.
- `reviewAfterMs` caused reconsideration; it did not make the `time.reached`
  Condition true. The agent returned `converged` at **6326147**, leaving the
  unknown, overdue Condition in place. Another attempt started **0.420 seconds**
  later on that same Condition. A successful result is not proof recurrence
  stopped, and omitting Conditions from the result does not retire open waits.

The operator ended that repetition through supported `task.cancel` event
**6326151**; cancellation **6326152** closed `a447535d` at resource version 14
and interrupted the extra attempt. This is a failed three-review extension,
not three successful periodic reviews. The two completed attempts used 347,593
and 413,115 reported total tokens including cache reads; the interrupted extra
attempt used another 51,079. No model comparison should hide that wasted work.

The overwritten historical report was preserved separately, then restored from
the previous correction session's exact readback. The navigation improvement and
retry report were retained. `retry-ordinary-periodic/` under the local evidence
directory contains input, snapshots, attempt/trigger evidence, outcomes,
cancellation and both versions of the report.

These observations narrow the earlier claim that an ordinary periodic Task is
already sufficient in practice: its generic wake mechanism works, but reliable
scope continuation and wait consumption need explicit handling. The ordinary
hygiene task's two reviews alone did not establish those properties.

### Corrected assignment and explicit clock observation

The next bounded trial uses a new ordinary May Task, linked to the closed
predecessor, with the full periodic assignment in its durable intent from
creation. Input event **6326156** created Task **`3644b5a1`**,
`goal/app_8394783f-06b4-4136-8284-3c423782e9c0`.
It has three read-only documentation reviews, two one-minute waits, and one
cumulative local report. The already completed navigation edit is not redone.

On each timed wake, the executor must verify actual UTC against the exact wait
timestamp, then publish a fenced `time.reached` fact for that Task and subject
through the existing `tasks` capability. The existing Condition tracker can
consume that actual observation. Only then does it return another wait or its
final result. This is a tested-use candidate for existing interfaces, not a new
clock observer or scheduler; broad standing adoption remains premature.

The corrected trial completed all three planned reviews with two genuine timed
wakes and a final retained result. It also exposed two extra attempts from its
own clock observations, so the stricter goal of no extra attempt did not pass.

| Attempt | Trigger and accepted behavior | Start → result (UTC) | Reported total tokens including cache reads |
| --- | --- | --- | ---: |
| 1 | Initial input; focused documentation judgment, count 1, first timed wait; event 6326162 | 15:39:21 → 15:40:16 | 273,215 |
| 2 | Actual review deadline; settled clock fact 6326168, unchanged-file no-op, count 2, final timed wait; event 6326171 | 15:41:19 → 15:42:02 | 145,200 |
| 3 | Echo of clock fact 6326168; checked UTC, preserved the future wait and count 2; event 6326175 | 15:42:03 → 15:42:22 | 34,125 |
| 4 | Actual final review deadline; settled clock fact 6326180, no-op, count 3; event 6326183 | 15:43:07 → 15:43:55 | 148,898 |
| 5 | Echo of clock fact 6326180; retained count 3, no new work/wait; event 6326188 | 15:43:55 → 15:44:08 | 37,071 |

Both timed attempts recorded `condition-review-checkpoint-missed`, at **62.496 s**
and **64.564 s** after the preceding review's accepted wait. The early clock-echo
attempt preserved the second deadline instead of resetting it. The two clock
facts changed their exact Conditions to `true`; final settlement removed them.
No operator steering was sent after the corrected Task's initial admission.

The final readback was **`up-to-date`**, generation 1, resource version 19,
`completedReviewCount: 3`, `nextReview: null`, no Conditions/dependencies,
`ready: false`, and five completed attempts. It remains retained, not closed.
At **15:46:11 UTC**, more than two one-minute intervals after final settlement,
the Task still had resource version 19 and five attempts, with no worker or wait.
This establishes quiescence for that observation window, not indefinite reliability.
The 543-word cumulative report is under `periodic-v3/review.md`; input, receipt,
snapshots and curated attempt/event evidence are in that same local directory.

The agent distinguished historical experiment counts from mutable status,
retained the corrected navigation, and reused file hashes on unchanged later
reviews. It made no source edits, remote requests or broad test runs in this
corrected trial. All five attempts finished without tool-schema errors. These
results demonstrate following a supplied method and bound, not independently
discovering that method or generalizing to unselected project problems.

The five attempts used **638,509** reported total tokens including cache reads;
the two echo attempts account for **71,196** of them. This is not a demonstrated
efficient recurring service. The self-addressed clock facts were still pending
inputs, causing another model attempt after each relevant review. At final
settlement the first result was `progress` while that input remained; the last
echo attempt produced `converged`. The candidate handled the echoes safely, but
it did not avoid them.

The follow-up below addresses exact self-publication consumption at the ordinary
Task boundary. Supported owner revision and later scope delivery remain separate
questions. No Host source/runtime fix was activated in this container trial.

### Source fix and agent behavior follow-up

Hao then requested a fix for the extra attempts and an assessment of May's own
response. [Host PR #175](https://github.com/hao1939/may-agent/pull/175), source
`8b61b817`, is isolated on `fix/self-published-task-echo`, based on Host main
`649d801c` (#174). It changes the shared attempt interface, with no schema,
App input, timer or scheduling change. PR #168 extracts the same runtime
function; whichever lands second must preserve this behavior and its tests.

The defect was mechanical: publication durably queued the self-addressed clock
fact, but the current attempt did not acknowledge knowing that fact. The existing
result settlement consequently retained it as new input. The candidate records
the exact published event ID using the Host's hidden publication fence and checks
App, Task, generation, attempt and target identity. The current attempt consumes
that receipt through existing result acceptance and does not receive a redundant
live hint. Other consumers still receive their facts. Failed/invalid execution
leaves the fact available to recovery; an obsolete result cannot accept a revised
Task. Public `source` or `emission` fields do not grant acknowledgment authority.

The regression failed on unmodified main through both the executor interface and
the actual `tasks.publish` tool path. With the fix, each path performs three
reviews in exactly three attempts, preserves both waits, consumes two exact
observations and remains quiet on later reconciliation/recovery. Four additional
cases cover execution failure, invalid output, concurrent input with forged
publication metadata, and a superseding Task revision. They reopen storage and
verify both recovery and another Task's retained fact. All six focused tests
pass, including suppression of the publishing attempt's live echo. These are
portable runtime tests with controlled time; they do not establish installed
container behavior or a real model's response to the candidate.

Final source `8b61b817` passed the complete `bun run ci`: **2,925 tests passed,
three installation-only tests skipped, zero failures**, with TypeScript, SDK,
canonical-boundary and lint checks passing. Hosted **Quality** and **Container**
also passed on that revision. Independent review and merge remain outstanding;
there was no deployment or additional model execution for this source fix.

May did **not** attempt a Host repair during the pilot. The assignment permitted
only report writes and prescribed the self-addressed clock observation. On the
early echo, May used `date`, `tasks.get` and `finish`: it found 27 seconds left,
kept count 2 and the existing deadline, and published nothing. On the final echo,
it used `tasks.get`, report readback and `finish`: it preserved count 3 and added
no work or wait. That safely contained the redundant wakes within the allowed
capabilities. It did not explicitly classify the five-attempt/three-review
mismatch as a defect, diagnose the Host path, quantify overhead or propose repair
in its cumulative report. Those findings and this source fix came from operator
review, not demonstrated autonomous improvement by May.

The next behavioral test should allow a report to flag execution anomalies and
permit one scoped source repair where appropriate. Expect May to distinguish
completed review count from actual attempt count, preserve valid progress,
retain a concrete diagnosis or uncertainty and next action, and verify any fix
at the layer it changed. Keep unresolved authorization or owner decisions
explicit without inventing more work. The
[proposal](../../proposals/may-project-review-loop-20260912.md#when-the-review-finds-a-problem-in-its-own-execution)
records this method. Writing that guidance is not evidence of its adoption;
leave the original container report and five-attempt evidence unchanged.

A supported socket read at **15:57:50 UTC** still showed Task `3644b5a1` at
generation 1/resource version 19, three completed reviews, five attempts,
`ready: false` and no Conditions or dependencies. The source candidate was not
installed. The exact readback and source-verification evidence are retained in
the local pilot's `source-fix/` directory.

### Clarification: duplicate delivery is expected

In follow-up discussion, Hao challenged the emphasis on pilot-specific handling:
the worker should avoid unnecessary duplicate wakes, and the caller must safely
handle repeats. This is a general producer/receiver responsibility. The earlier
three-attempt expectation measures avoidable self-echo cost in a controlled
trial; it is not a promise of exactly-once delivery. The five-attempt trial
preserved review count and avoided repeated work, so its no-ops were correct
under duplicate delivery even though the self-echo was inefficient. The
[revised proposal](../../proposals/may-project-review-loop-20260912.md#duplicate-delivery-must-be-harmless)
separates these requirements and calls for receiving-side verification across
acceptance and restart. This clarification does not claim additional source
changes or tests beyond PR #175's recorded coverage.

### General duplicate-handling follow-up

The broader source review reproduced a receiving-side gap: claiming an event
removed its pending link, so a later delivery could appear new during execution
or after acceptance/restart. A child-process regression also reproduced the
[PR review finding](https://github.com/hao1939/may-agent/pull/175#discussion_r3996782174):
a worker settled its result before its buffered publication reached the parent,
and the later relay recreated pending self-input. These regressions failed on
`8b61b817`; they do not change the historical five-attempt pilot result.

The revised Host #175 candidate retains exact receiving-Task identities in the
existing Task-event links, without retaining duplicate event bodies or scanning
attempt history on each wake. Pending input and failed-attempt recovery remain
the execution authority. Current-attempt publication receipts are captured at
the emitter return boundary, including idempotent returns that skip bus fan-out.
First relay still schedules pending work for other Tasks; a consumed receipt
cannot wake the publishing Task again. Target normalization now handles the
supported project alias consistently.

Version 3 reconstructs identities from retained input/attempt evidence once;
removed historical evidence cannot be reconstructed. Compact keys last for the
Task's lifetime. Old and new writers must not operate together, and rollback
restores the earlier redundant-wake risk. The
[Events contract](../../2a-design/events.md#duplicate-delivery-and-safe-reconsideration)
owns producer restraint, safe receiver no-ops, semantic App judgment and the
limits of external-action idempotency. Task and storage contracts link to it.

The regressions cover exact-target and resolved-intent admission before/during
claim, after acceptance/restart/upgrade, late repeated child relay, preservation
of another Task's pending wake, newer desired state, Condition recovery,
publication retries and retained receipts after old attempt pruning. Live-input
regressions also exposed repeated worker hints reaching the active handler;
the final candidate suppresses claimed/consumed/already-delivered IDs while
each listener still receives genuinely new input once. Existing
caller-report coverage also checks that an unchanged report stays quiet across
restart while a newer report revision advances once. This source work does not
establish universal semantic deduplication for every App.

Final source **`8a3811ce0c8982309fbe2d7ea5b7ef9503718a90`** passed `bun run ci`:
**2,935 passed, three installation-only skips, zero failures**, 12,955 assertions
across 293 files; type, SDK, boundary and lint checks passed. Hosted
[Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34705646538)
passed on that same commit. The PR title/description now cover the whole fix,
and the [delayed-relay review thread](https://github.com/hao1939/may-agent/pull/175#discussion_r3996864757)
has a verified reply and is resolved. Companion design checks passed with zero
errors/warnings. Local regression logs and exact results are retained under
`source-fix/duplicate-handling/` in the pilot evidence directory.

No container restart, schedule change, live-state mutation or new model-backed
pilot was performed. Source validation does not establish deployed adoption.

### Integration with the merged runtime cleanup

Host #175 was updated to **`8f34e0e2be06a24e181d5552752057bc3e8defec`**
after #168 merged as `c0cbb59e`. The conflict resolution keeps publication
receipt capture and per-listener duplicate filtering in `attempt-execution.ts`,
with admission and compact receipts in their existing owners. Fenced settlement
continues through the reconciler. Fixtures use the current `facts` result field
and omit retired Task modes; retained-result normalization remains intact.

On that combined source, the affected runtime, emitter and storage suites passed
**189 tests with 1,886 assertions**. Complete `bun run ci` passed **2,954 tests,
three installation-only skips and zero failures**, with 13,002 assertions across
294 files. Type, SDK, boundary and lint checks passed. Companion design checks
passed with zero errors or warnings. Hosted
[Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34706383494)
passed on this revision. The PR no longer conflicts with `main`.
A subsequent review found a worker target-parsing mismatch, addressed below.

Evidence for this integration is retained separately under
`source-fix/duplicate-handling/main-integration-20260913/`. Earlier source checks
and the live pilot above remain historical results. This update did not restart
the installation, change live state or run another model-backed pilot.

### Worker target-parsing review follow-up

A [new review finding](https://github.com/hao1939/may-agent/pull/175#discussion_r3996897977)
showed that the parent-to-child relay used older target parsing. A publication
addressed through an empty `appId` plus the `project` alias, or a padded Task
identifier, could be durable but absent from live worker input. The expanded
child IPC regression failed on `8f34e0e2` with those two deliveries missing.

Host **`cb9d4284c0044df58b34ed3d2259ccd0847acbba`** shares
`core/events/task-target.ts` across admission, storage, publication tracking,
live listeners and the worker relay. The same regression now accepts alias and
whitespace variants while excluding unrelated targets, unpersisted input and
worker echoes. All 12 worker protocol tests passed. Complete `bun run ci` on
that revision passed **2,954 tests, three installation-only skips and zero
failures**, with 13,000 assertions across 294 files; type, SDK, boundary and lint
checks passed. Hosted
[Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34706653513)
passed on the same revision. The source change does not establish deployed
adoption. Local evidence is retained separately under
`source-fix/duplicate-handling/worker-targets-20260913/`.

### Verification of event identity and first Condition delivery

Three later review comments questioned symbol-only event IDs and first
Condition observations. Tracing the production path showed that both canonical
admission entry points already copy `EVENT_ROW_ID` into serializable `eventId`
before receipt lookup and pending comparisons. The Condition filter keeps Tasks
without receipts eligible; its `continue` advances that filter, rather than
skipping admission. No behavior change or additional identity parser was needed.

Host `59dc7b80` adds comments and coverage: the real child-relay test explicitly
starts with symbol-only IDs, and a broadcast `pipeline-run.state` test verifies
first admission without a receipt, one pending input under repeat delivery, and
quiet repeats after settlement. Ten focused checks passed on the existing
runtime behavior. Current head **`9d823cde8adfda35c369a77811f37f04dcc8b27a`**
also incorporates main `d7b9d962`; complete local CI passed **2,959 tests, three
installation-only skips and zero failures**, with 13,049 assertions across 295
files. The review threads were answered with these call paths and resolved.
Logs remain under `source-fix/duplicate-handling/review-verification-20260913/`.
This verification did not operate the live installation or run a model pilot.

### Journal recovery and Condition readback

A [later finding](https://github.com/hao1939/may-agent/pull/175#discussion_r3996993484)
identified a separate recovery path that omitted the journal row ID. Extending
the early-fact recovery regression reproduced two pending copies when a delayed
canonical route delivered the same fact. Keeping the ID alone removed that
duplicate but prevented a newly declared Condition from reading an already
consumed fact. Both failures were reproduced before choosing the correction.

Recovery now retains the journal ID. The existing Condition tracker allows a
consumed fact only when it matches a current open wait, using the same freshness
and report-revision rules. Already satisfied waits remain quiet. No new receipt
table, queue or recovery mode was added. The regression closes and reopens the
database/runtime, checks late delivery after settlement, and verifies useful
readback for a newly declared wait. Thirteen focused checks passed with 144
assertions. Evidence remains separately under
`source-fix/duplicate-handling/journal-recovery-20260913/`.

Host **`afddecb0`** passed full `bun run ci`: **2,960 tests, three installation-only
skips, zero failures**, with 13,063 assertions across 295 files. Type, SDK,
boundary and lint checks passed. Companion design checks passed with zero errors
or warnings. Hosted
[Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34708825459)
passed on the same commit, and the review thread was answered and resolved.

The repeated review rounds exposed a verification gap: live admission was traced
more thoroughly than recovery. Review identity across publication, delivery,
claim, settlement and recovery together; test legitimate reuse of evidence
alongside duplicate suppression. This source check did not operate the installed
container or run another model-backed pilot.

## What to retain

1. Verify the user's intended runtime and expose the actual Task reference
   before spending substantial effort on a pilot. A separate database is a
   separate execution surface, even on the same machine.
2. Pending implementation does not automatically block a separate authorized
   documentation correction. Keep revision-specific counts at their owner
   instead of copying them into navigation.
3. Give a small context packet with unambiguous roots and available tool
   expectations. Do not paste all history or assume a saved guide was used.
4. Preserve the existing Task result and allow quiet no-ops. One useful edit
   need not generate a new task, repeated notification or another patch.
5. Keep the method provisional. This trial needed operator correction and
   showed no initial advantage from the explicit method pointer. A later
   comparable case without the answer in its input is needed to assess learning.

The larger proposal still needs evidence of independently useful later
reviews, real waits/review comments and reduced human attention before wider
automation. This case does not justify a new controller or permanent rules
derived from every harness error.

## Evidence retention

Local operational evidence is under
`/app/.state/review-pilots/may-project-review-20260912/`: the exact container
input, admission receipt, Task readback, executor report, curated preliminary
results and preliminary candidate patch. The experiment harness and fuller
scratch evidence remain under `/tmp/may-review-pilot-20260912-I0Hks0`; the
baseline and method runtime roots were `/tmp/may-e2e-zxzGXq` and
`/tmp/may-e2e-2WXA2j`. Those daemon processes are stopped.

These local paths are diagnostic provenance, not portable deliverables or
runtime dependencies. This dated record preserves the useful evidence and
limitations; raw transcripts and one-off adapters do not belong in maintained
Host `scripts/` merely because the pilot used them.

After updating the research, proposal and navigation, the operator ran
`bun run check:may-design`: zero design errors/warnings, passing executable
examples and zero canonical App errors. A separate check resolved 282 local
links across the six affected documentation files, including explicit HTML
anchors, with zero issues. Scoped whitespace checks passed. Process inspection
found no remaining pilot harness or isolated daemon processes.

After the periodic retry and proposal refinement, `bun run check:may-design`
passed again with zero errors/warnings, and the updated six-document link check
resolved **283** local links with zero issues. Scoped whitespace checks passed.
The original retry is cancelled; the corrected Task is retained and quiescent.
