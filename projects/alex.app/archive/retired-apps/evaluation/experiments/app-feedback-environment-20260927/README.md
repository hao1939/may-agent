# Repairing the App feedback boundary — September 27, 2026

The local baseline is release **v5.2.0**, Host `d116978576cf1be9c830f999f2e3001119c70348`.
Its deployment receipt reports healthy activation and matching built/loaded SHA
`4c23e4c5968a741e0d1b8b60f869e448c3df7a75e393bbd6d077bdb4fe29be60`.
The source candidate is Host `00e0f73f`; merge, activation and behavioral proof
are separate observations.

## Findings and smallest changes

| Observed problem | Change | Limit |
| --- | --- | --- |
| May repeatedly fulfilled a Request without a response, then failed settlement | One shared result schema checks reply requirements before finish and during settlement | Authority, stale revisions and external effects still require transactional checks |
| Evaluation called a linked approval overdue using creation time | Expose the scheduler's current checkpoint and attach computed validity to exact linked Task reads | A due checkpoint warrants inspection; it does not establish a defect |
| Dashboard called completed sessions a success rate | Name the API field and presentation `sessionCompletionRate` | Task-attempt reporting remains separate; neither metric certifies useful output |
| Review treated cancelled `attention` as active work | Use the existing independent `closed` observation | No new lifecycle state or migration is needed |

Human input, Request closure, delegation and cancellation require a nonblank
reply. Automated observations and updates keeping a Request open can stay quiet.
The schema does not decide whether a new human Request exists or whether an
explanation is useful; those remain App judgment.

The exact false-deadline case had observation `2026-09-27T01:55:22.616Z` and
`reviewAfterMs=86400000`. Its next checkpoint is **September 28 at 01:55:22.616Z**,
not a deadline based on the older creation date. The regression includes both
before-due and due cases and checks that current empty Conditions supersede
historical diagnostic entries.

## Verification

- 56 focused Host tests passed, including a real tool loop with scripted model
  choices. An invalid finish stays in the same attempt, then a corrected finish
  closes the Request. This tests mechanics, not unscripted model behavior.
- Evaluation: 219 tests passed; syntax and type checks passed. Its combined
  check stops on pre-existing formatting in five unchanged files (`app.ts`,
  `public-task-evidence.ts`, `task-process-evidence.ts`, its test, and
  `task-report-store.ts`). No passing full-App-check claim is made.
- Common design integrity, typed examples and canonical App checks passed.
- First full Host CI caught the newly exported schema helper missing from the
  reviewed SDK export fixture. The fixture was updated and its test passed;
  final complete CI and local candidate activation are recorded below when run.

Operational logs and exact snapshots are under
`/app/.state/review-pilots/app-feedback-environment-20260927/`.

## Remaining oversight investigation

May received ordinary input event `6459711`, request
`app_0c7e42b1-2dc6-4b13-abe9-56523e6581ef`, to independently inspect Evaluation
failure and unavailable-owner handling using existing routes. This is a
read-only assignment, not authorization to apply a generated improvement.

Known current boundary: `evaluation.review_failed` routes to Evaluation's
existing owner-review Task. Evidence-acquisition failures emit that fact.
Reviewer execution failure returns an incomplete result; the external review
subscription deliberately excludes Evaluation-owned work. Establish the actual
caller/owner response before adding a route. Automatic unavailable-owner
supervisor fallback remains a disclosed design limitation.

A successful release, one corrected result or one accepted report does not prove
the whole unattended improvement loop. Keep independent proof for selection,
useful diagnosis, isolated comparison, human approval, exact application and
post-activation behavior. Do not create a live improvement solely to manufacture
an end-to-end success claim.

## Local activation and second iteration

Host candidate `00e0f73fb4f820abf3b4bc219bab9e5a2257c84a` passed full local CI:
**3,243 passed, three installation-specific skips, zero failures**. GitHub PR
[#258](https://github.com/hao1939/may-agent/pull/258) originally carried the bundled
change; the focused revisions are recorded below.
May independently reviewed the candidate and ran the four focused suites
(56 passed). Exact accepted attempt:
`may/conversation_ec854e2f09f1c38566a25857_successor_2`,
`r_1_c15db1ee-bf45-49e9-b0aa-914eb35a41af`.

The local candidate activated at `2026-09-27T15:15:24.782Z`. The receipt
`app-feedback-contracts-00e0f73f-20260927` reports healthy activation, no duplicate,
and identical built/loaded SHA
`64087dcb809be0125a59e5cc441b8d1cbea2f97fcf45ac491d9bacfcf92b111d`.
The running binary identifies as `v5.2.0 (00e0f73f)`; this is a local candidate
based on the release, not a newly published release. App definitions activated
from workspace commit `5eeda30eb12729be450a65e50073acc3b8a2363a`, confirmed by
reload result event `6459758`.

The first explicit review reused an old report, so it is **not new model proof**.
After Host activation, public reads expose checkpoint `1790560522616`, and
replaying the earlier report's exact linked Task through the new reader produces
`before-due` with the same checkpoint. The pinned fresh review was admitted as
request `app_6bcd0f6a-7b9d-48a5-8472-261953ebb116`, event `6459812`, on evidence hash
`902ca7445292ca3d276cf857e201d1dae27fd924082a494a20673b4db9a6fea9`.
Its behavioral outcome is recorded separately after completion.

May's oversight investigation found ordinary retries recovering both a reviewer
timeout and an ENOSPC failure on their original Tasks. No currently stuck review
was found. Her proposed reuse of `evaluator-heartbeat` was rejected after source
review: its restricted no-op/unblock prompt and converged fallback for failed
execution conflict with the current recovery model. She accepted that correction.
Keep the remaining fallback proposal focused on existing Task-reconciliation
events, Evaluation's standing owner Task and May's judgment. Test an owner failure
and a healthy recovered case before installing any additional route or timer.

## Fresh live result

The pinned review first settled a budget wait, then the normal scheduler resumed
it at `2026-09-27T15:20:09.182Z` without a manual wake. DeepSeek execution
`s_1790522410899_319d5f60-6643-4122-8290-64d04f22374a` produced a fresh assessment
with `before-due` and checkpoint `1790560522616`; freshness readback retained the
same evidence hash. Publication event `6459856` linked ordinary May input
`app_ca6f0697-dc54-48f4-866d-90dcd713eaf4`.

May completed that input on the candidate Host. She independently checked current
state and report hashes, preserved the existing human approval gate, and declined
a duplicate candidate. Her Request closure included the required reply and
settled successfully. This proves one fresh Evaluation-to-May passage and valid
live use of the shared reply schema. The invalid-first-finish correction remains
a scripted execution test; no reduced long-term failure rate is claimed. The
linked-deadline regression is established by replaying the earlier report's exact
link; the fresh model trial reviewed the waiting Task directly, so it is not a
controlled before/after model-quality comparison of the original parent report.

The report is overly long, and its summary says “no review deadline is owed”
where its structured facts and findings correctly say “not yet due.” May's final
reply uses the latter meaning and retains the Condition. Keep that wording
limitation visible rather than treating one correct deadline as perfect judgment.

## Follow-up found while tracing the publication

The exact `event.get` read of publication `6459856` reconstructs a target with
subject App `may` and producer Task `evaluation/runtime/task-outcome/...` (the
Task ID alone is attached beneath `may`). Authored publication targets
`{appId: "evaluation"}`. `loadPersistedEvent` currently rebuilds the target from
`payload.appId` and indexed producer correlation; it does not retain the authored
target envelope. May's subscription used the exact subject in `data` and delivered
successfully, so this did not block the trial. It is nevertheless an existing
read/replay boundary mismatch, separate from this candidate.

Before extending failure routing, test a publication whose producer, subject and
destination differ through save/read/restart. Preserve declared routing separately
from origin and subject correlation, using the existing event store. Do not invent
a registry, infer a destination from arbitrary payload fields, or rewrite old
records without evidence of their original target. This requires its own small
Host contract review; it is not fixed by the checkpoint or reply changes.

## September 28: focused PRs and result-contract ownership

The review found three independent changes in the original PR. They now branch
separately from Host `d1169785`:

| PR | Revision | Responsibility |
| --- | --- | --- |
| [#258](https://github.com/hao1939/may-agent/pull/258) | `4dfaed1f` | Conversation result validation, seven files |
| [#259](https://github.com/hao1939/may-agent/pull/259) | `4c731972` | Shared Condition checkpoint calculation and public observation, five files |
| [#260](https://github.com/hao1939/may-agent/pull/260) | `2d32149e` | Session-completion naming in HTTP/UI/status, four files |

The result schema owns requirements attached to proposed actions. The core
Conversation boundary derives the human reply requirement from exact claimed
inputs, passes the schema to execution, and recomputes it at settlement. The
executor no longer derives policy from presentation context. Duplicate predicates
and the proposed public SDK helper export were removed. Current claim, authority,
revision and atomic-settlement checks remain. The owning contract is
[Message Lifecycle](../../../../../docs/2a-design/message-lifecycle.md#results-and-human-updates).

Focused verification passed: 68 Conversation tests, 177 Task/read tests, and
eight HTTP/browser tests. The tests distinguish pending human input from an
automated observation linked to an already handled human parent. The latter may
remain quiet. The health regression correlates a completed session with its own
failed Task settlement rather than unrelated examples.

May independently reviewed `4dfaed1f`, found no blocking defect, and passed 47
focused tests plus Host/SDK type checks. The accepted review input is
`app_69a36527-dd99-4fd6-a69b-68d227502390`, event `6460193`. Her optional suggestion
was another full tool-loop variant for the human-parent case; the existing
contract/adapter tests cover the changed boundaries, so no extra variant was
added. This source review used the existing runtime and does not establish
deployment of the revised source. The earlier live trial remains evidence for
`00e0f73f`, not these subsequent revisions.

Full `bun run ci` passed independently on all three revisions: 3,244 tests for
#258 and 3,241 each for #259 and #260, with three installation-specific skips
and zero failures in each run. Both GitHub checks passed on every PR. The common
design integrity, checked examples and canonical App checks also passed. These
are source/build checks; none of the three revised branches was deployed during
this cleanup.


## September 28: separating authority from context and execution

Host [#262](https://github.com/hao1939/may-agent/pull/262) follows the review of
responsibility boundaries, not another split of the earlier PR. It removes
prompt visibility as a Task-operation gate. Core derives reply identity,
requirements and cancellation authority from exact claimed inputs. Context
selects evidence; the model adapter receives the schema and scoped capabilities.
Prepared cancellation targets contain identities and observed versions, not
mutable Task stores. Settlement resolves installed Apps under the existing
transaction; no registry, migration or second work lifecycle is added.

The first revision `f0a51251` passed 119 focused tests and full CI (3,251 pass,
three installation-specific skips, zero failures). May independently reviewed
that revision through input `app_02554ef6-4564-4b10-af00-a995327d6aac`. She found
that the separately prepared follow-up attachment could disagree with the
agent's decision, although shipped composition produced matching data. Rather
than add another version or comparison, revision `18d017be` removes that
attachment entirely. Core interprets `decision.followUp` once at settlement,
using the attempt's pinned App declaration and current Task state. Explicit Task
reuse bypasses mapping; otherwise the App's pure mapping runs once.

The focused suite then passed 121 tests. Regressions cover omitted/misleading
context, creator versus direct-human authority, scoped reads, JSON roundtrip
and database reopen, missing/mismatched Apps and Tasks, changed generation and
resourceVersion, single-source handoff targets, and ordinary runtime recovery.
The follow-up review is input `app_b7fa7725-4429-4022-9446-f699b08ef20a`.
Revision `083272a8` only tidies formatting; normalized JavaScript output matches
`18d017be`.
These are synthetic source/contract checks, not a model-quality comparison or a
live rollout. The model still judges which authorized target fits the ask.

May's follow-up review confirmed the finding is closed and identified no remaining
concrete defect. She reviewed an archive of exact `18d017be`, independently ran
100 focused tests and `check:ci`, and explicitly did not certify GitHub checks or
a rollout. Her review is pinned to the semantic revision rather than claiming
review of the subsequent formatting commit.

Final full `bun run ci` passed: 3,253 tests, three installation-specific skips,
zero failures across 311 files. Host/SDK type checks, the canonical App boundary,
ESLint, real runtime/worker/reopen tests and browser checks all ran. The common
design integrity, canonical App checks and checked documentation examples passed.
The three formatting-only files compile to identical normalized JavaScript in
`18d017be` and final `083272a8`. The GitHub Container check passed on `083272a8`;
the current PR retains the independent Quality result and review requirement.

The first final GitHub Quality run (`36334668665`) exposed an unrelated timing
assumption in `app-task-retry.test.ts`: the persistence rollback test compared a
250 ms retry deadline with the wall clock after database work. The test took
357.58 ms, and the deadline was already 77 ms past when asserted. All 3,252 other
tests passed. Revision `f94aefa4` freezes time only in this persistence test and
checks the exact 250 ms deadline; the separate real due-timer test remains real.
The owning retry suite passed all 18 tests. This repairs the observed test race
rather than hiding the failed run with an unchanged rerun; production retry
behavior is unchanged.

Final revision `f94aefa4` passed full local CI again (3,253 pass, three expected
installation skips, zero failures). Both GitHub Quality and Container passed in
run `36335045725`. PR #262 is ready for human review; no source rollout occurred.

## September 28: retaining the declared Event destination

Host PR [#262](https://github.com/hao1939/may-agent/pull/262) merged as
`8c1ad408`. The next focused repair is
[#263](https://github.com/hao1939/may-agent/pull/263), source
`11d72058a005f8a347c29fee1ab0185fbdf862a4`.

Read-only inspection of the existing runtime reproduced the earlier publication
readback problem on event `6459856`: subject App `may` was combined with the
Evaluation producer's Task ID as its target. The authored publication had a
different destination. Both diagnostic reads and recovery rebuilt an address
from correlation because the event writer never stored the original target.

The change adds one nullable `target_json` column to existing Event storage.
The writer retains the authored target; both readers use it. Task producer
indexes, payload identity, idempotency and fenced Task settlement retain their
existing roles. New untargeted events store `{}`. Old rows retain SQL NULL and
are not backfilled from incomplete evidence.

The first regression failed for both inline and large-body publication.
The follow-up compatibility trial exposed a second failure: an unresolved
legacy translator could interpret a lost target as no target and settle a
no-op. Revision `11d72058` retains that command as pending with an explicit
investigation error. Already resolved commands use their frozen destinations
independently. The new regression failed before this change and passed after
it; the six focused suites now contain 103 passing tests. No new registry,
queue, Task lifecycle or App-specific repair branch was added.

May reviewed the candidate through input `app_950dc248-74fe-46c0-8881-1d08307fc900`.
During review she removed the author's ongoing uncommitted regression and
implementation edits from the shared worktree. The author restored and
committed both, then sent the correction through ordinary Conversation input
`app_f579df57-ed18-42dd-9f1e-be2954d629b6`. May re-reviewed exact `11d72058` from
a private archive, passed 103 tests (532 assertions), and found no remaining
concrete defect in scope. Her acknowledgment incorrectly attributes those
original edits to a delegated reviewer; the author's tool history establishes
their origin. The technical re-review does not erase this review-process issue.
Future review assignments should provide an isolated pinned snapshot and
preserve shared edits rather than trying to make a shared checkout match HEAD.

Operational evidence remains under `/tmp/event-target-*` for this session.
The runtime was observed, not upgraded, during this repair. Source validation
and exact final hosted checks are recorded below separately from live adoption.

A separate operational boundary appeared while correcting the review. Exact
Task-addressed App input event `6460642` was rejected with
`Conversation Task input must use conversationId without targetTaskId`
(subscriber failure `6460643`). It acquired no inbox link and later became
unhandled. Ordinary Conversation input `6460652` was accepted and considered.
This is an existing Conversation-ingress rule, not target-storage corruption;
review the rule and its rejection receipt before proposing another mechanism.
No historical event or Task was rewritten to make that trial succeed.
Source/design follow-up confirms that Conversation-addressing restriction is
intentional (`agent-app.md`, App input identity): the stable Conversation ID
selects its current executor, and an exact executor must not acquire ordinary
Task-input authority. The attempted targeted correction was caller misuse;
it is not evidence to remove that guard. Rejection visibility can be assessed
separately using the recorded event and subscriber diagnostic.

Final verification on unchanged `11d72058` passed full Host `bun run ci`:
**3,257 passed, three expected installation-specific skips, zero failures**.
GitHub **Quality** and **Container** both passed in run `36336223122` on that
same revision. Common design integrity, checked documentation examples and
canonical App checks passed against the candidate source. The candidate
worktree was clean after the complete run. PR #263 is ready for human review;
it has not been merged or deployed. The public read of old event `6459856`
remains historical evidence, not a claim that its lost target was reconstructed.


## September 28: Event envelope audit and document storage

The follow-up audit expands the same Host PR #263. The previous target-only
candidate was not deployed. Current source replaces its unshipped `target_json`
column with one `envelope_json` document inside SQLite. This is flexible metadata
storage, not a second database or removal of input validation. Payload bodies,
trace tables, transactions and searchable columns keep their existing roles.
Optional metadata survives without a column and migration per field; new search
indexes and changes in meaning still require deliberate implementation.

The historical example `6459856` showed incorrect diagnostic reconstruction;
its original report did reach May. It does not prove that the live report was
lost. Temporary fixtures established further distinct defects: replay omitted
`action`, trace links and visibility; missing urgency differed between initial
and recovered App views; some explicit target selectors were ignored or borrowed
subject IDs; and public generic facts conflated subject and address. The expanded
regressions failed 11 tests before repair. An action-dependent translator could
silently settle a no-op after recovery even though its live counterpart admitted
work. The corrected trial admits both the control input and action-dependent
input to Tasks after database reopen.

Source `79aae34e` retains metadata with object-rest serialization, restores trace
metadata from its existing tables, shares normal urgency semantics, matches all
explicit target fields against the actual address, and limits payload/address
alias validation to the existing input/control definitions that own it. Unknown
future metadata is covered by the extension-field round-trip regression. Old
SQL NULL envelopes remain unknown; frozen commands still recover independently,
while unresolved legacy translation retains its investigation failure.

The seven focused suites passed 110 tests (583 assertions), and Host type and
common-design checks passed. The first full CI run then exposed four old
assertions: two expected omitted urgency, one expected injected subject IDs,
and the deployment test rejected independent subject/address facts. The revised
deployment test checks the useful boundary: a report is durably recorded even
when its exact delivery fails, the missing target Task is not created, and the
successful deployment receipt remains unchanged. Its first run exposed a real
missing causal link on queued `subscriber.failed` diagnostics. Source `393fdf32`
reuses the existing `childEventTrace` helper when queuing that diagnostic. The
owning bus regression and end-to-end deployment test cover the link; five
affected suites passed 196 tests with 1,980 assertions.

May reviewed exact `79aae34e` from a private archive through input
`app_6575d7a9-1e2e-408c-99a7-3bf0f0e2171b`, independently passing all 110 tests.
She reproduced valid-JSON metadata with invalid address/time values and a type
disagreeing with the indexed record. `393fdf32` adds shared read validation for
supported field types and indexed event-type identity. `9bb7eb4e` also rejects
array-to-string coercion for urgency. Extensions remain preserved; this is not
a checksum or a guarantee against arbitrary direct database edits. The JSON
metadata stays authoritative; we do not add a second field-by-field authority
by reconciling every search column on read.

The validation correction passed the two owning suites (32 tests, 174
assertions); the final urgency regression passed the owning persisted suite.
May's follow-up review was admitted as
`app_1db355a5-2778-4e25-9448-252fdd5e6cb0`. Her container cannot read the author's
host `/tmp` files, so independent reproduction uses committed fixtures. The
unavailable audit-file observation is not evidence of a failed trial.

Reproduce from the Host candidate with `bun run ci`; owning regressions live in
`persisted.test.ts`, `interface.test.ts`, `bus.test.ts`, SDK `event.test.ts`,
`app-event-translation.test.ts`, `app-inbox-runtime.test.ts`,
`app-task-emitter.test.ts`, `schema.test.ts` and `scripts/restarter-ui.test.ts`.
Local detailed outputs use `/tmp/event-contract-*` and
`/tmp/may-event-*-audit-fixed-20260928.jsonl` in the author's session. These are
synthetic runtime/storage and integration checks, not a model-quality trial or
a live rollout. Final complete checks and review are recorded below separately.


May's correction review of exact `393fdf32` found no actionable defect. In a
private archive she passed 61 tests (266 assertions) across bus, persisted,
interface and deployment suites, plus TypeScript and whitespace checks. She
confirmed the structural-validation boundary without demanding checksum or
field-by-field search-projection comparison. Shared worktrees were preserved.

An intermediate local full run overlapped the author's validation edits: Bun
had already loaded the older reader when it loaded the new regression. It
reported 3,271 passing tests and one expected mismatch against that stale module.
That mixed-revision run is retained as `/tmp/event-contract-ci-final.log` but is
not used as final merge evidence. The final full run is on unchanged `90ae7c1c`;
its only delta after the validation correction is strict urgency typing and
restoring the existing inline public target projection instead of adding a
single-use helper. Final results follow below.


Final source `90ae7c1cd9ace51d1898ffab574733027fd983fc` passed complete local
`bun run ci`: **3,272 passed, three expected installation-specific skips, zero
failures**, with 15,998 assertions across 311 files. Host/SDK type checks,
canonical App boundary, lint, real daemon/browser and worker tests ran. Both
GitHub **Quality** and **Container** passed on that revision in run
`36339216853`. Common design integrity, checked examples and canonical App
checks passed. No automatic test retries were used.

May reviewed the final small delta through input
`app_a0f44267-30f7-47cc-8948-6ad2f5c40a6a` and passed the two owning suites
(32 tests, 176 assertions) in an archive of exact `90ae7c1c`, finding no
actionable defect. The original schema and action-recovery trials were rerun
against that revision: address/payload/action/urgency and trace identity survived
reopen, mismatched target filters rejected, independent subject/address facts
were accepted, and both recovered inputs reached Tasks. Final local trial logs
are `/tmp/may-event-schema-audit-90ae7c1c.jsonl` and
`/tmp/may-event-action-recovery-audit-90ae7c1c.jsonl`.

PR #263 is ready for human review. It has not been merged or deployed. Source
acceptance and this synthetic recovery evidence do not establish live adoption.


## September 28: PR #263 query-boundary and retry review

A further review of candidate `90ae7c1c` retained the JSON-plus-query-column
design and found one concrete retry regression. The new trace reader restores
`visibility: default` from its trace table; copying that entire read result into
an idempotent publication changes the caller's originally omitted visibility.
Because the existing publication hash includes authored visibility, the third
publication of that same event object falsely rejects changed input. Omitted
visibility failed; explicit default/detail controls passed. The before log is
`/tmp/pr263-review-retry-before.log` (six passes, one failure).

Source `8952003b` restores only the causal trace after the existing input-hash
check. Source/owner/time restoration retains its existing role, and authored
fields already matched. It adds no fingerprint migration, retry lifecycle or
compatibility branch. The owning regression checks omitted/default/detail
visibility, repeated receipt identity, one route execution, one saved record,
original trace identity and rejection of genuinely changed payload. Four
affected suites passed 56 tests (294 assertions), and TypeScript passed.

The common design now states that the writer commits metadata and query fields
together, occasional metadata filtering can use SQLite JSON expressions, and
new indexes should follow an actual query need. It distinguishes search
projections from authoritative Event identity/delivery state and trusted
producer correlation. Source inspection of May, Scout, Evaluation and Gym's
App subscriptions found their subject filters use the retained top-level
`project` selector; their definitions do not require a target-filter migration.
This source inspection does not certify live behavior.

May's independent read-only review is input
`app_560dbe5a-83cb-4147-a457-a0242d1a6036`. Final complete verification and review
are recorded below; no source deployment is part of this iteration.

Final source `8952003ba429c3487452e27135b5114297c9428f` passed unchanged-revision
`bun run ci`: **3,275 passed, three expected installation-specific skips, zero
failures**, with 16,016 assertions across 311 files. Both GitHub **Quality** and
**Container** passed in run `36341589360`. Common design integrity, checked
examples and canonical App checks also passed.

The first review input was included in a mixed Conversation batch but received
no review: session `s_1790534775161_bf30106c-22d7-43a1-889e-523b5a8311f5`
addressed a newer Evaluation publication, while settlement marked both inputs
handled. No accepted Conversation Request was saved for the PR review. Inbox
handling is therefore not review evidence. The same review scope was recovered
through ordinary May Task `goal/app_dec45b8d-8b7d-4672-bcfc-a8c9c72726fc`.

May independently compared private archives of both exact revisions, reproduced
the omitted-visibility failure on the old writer (six passes, one failure), and
passed all four requested suites on the target (56 tests, 294 assertions).
Her accepted outcome reports **no actionable findings** and confirms the small
writer correction; shared source remained unchanged. Her retained review is
`artifacts/pr263-8952003b-independent-review.md` in that Task's workspace, SHA-256
`33dc1f531868703c72a750c4024a69995cbea2b1faccb5b0f3cb8583bdf0847c`.

PR #263 is ready for human review on this revision. No Host merge or deployment
was performed. The mixed-input handling failure is a separate follow-up; adding
it to the Event-storage change would cross its responsibility boundary.
