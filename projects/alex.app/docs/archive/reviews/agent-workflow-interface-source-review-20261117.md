# Unified-call source review — November 17, 2026

This review supports the [active cutover](../../proposals/agent-workflow-interface-review-20261117.md).
The contribution contract owns behavior; this record identifies the source and
installation inspected before implementation. It does not certify the candidate.

## Baseline

At 14:50–14:54 UTC, remote Host main was
`0606e2df16d0a44016bbef1c6294dac4c4c11d94`, including merged #585 and #587.
The local primary Host checkout and installed binary were still `43fc420a`;
`/usr/local/bin/may-agent --version` returned `may-agent v5.6.0 (43fc420a)`.
The Apps main reference was `93a7f57fd6d2a695198db37dcbf24d6755960706`,
with uncommitted design and unrelated archive edits. Neither a GitHub merge nor
an updated working file establishes installed behavior.

## Remaining source gaps

Paths below refer to the exact Host main revision above.

| Requirement | Source observed | Consequence and correction |
| --- | --- | --- |
| One callable catalog | `packages/sdk/src/workflow-kernel.ts:52` resolves qualified names as procedures and bare names local-first; `src/lib/manager-agents-tool.ts:264` has another resolver. | An implementation swap changes lookup. Use one captured canonical catalog for list and call, rejecting duplicates before activation. |
| No invocation permissions | `src/lib/manager-agents-tool.ts:84` exposes call denials and procedure-only mode; `src/app/loader/toolset-loader.ts:67`/`:158` bind them. | A listed procedure and prompt have different callers. Remove these controls and bind cooperation independently of workflow-directory presence. |
| Full structured input | `src/lib/manager-agents-tool.ts:124`/`:155` retain task/context/criteria fields and separate procedure input; `src/lib/workflow-tool.ts` prepares nested prompt strings. | Inputs can be dropped or rejected when the implementation changes. Validate and preserve the same envelope on every route. |
| One public result | `packages/sdk/src/workflow.ts:515` requires `id` and `kind`; model dispatch spreads executor-specific diagnostics into public output. | Consumers must inspect backend details; pre-start rejection cannot have an actual child ID. Bind runtime identity and expose the common report only. |
| Shared discovery | SDK `AgentContext` has call but no list; standalone `listTargets` and model discovery prepare separate projections. | Callers cannot rely on listing/dispatch equivalence. Share descriptors, effective schemas and prepared snapshots. |
| Reduced cooperation API | `src/lib/manager-agents-tool.ts:106` lists eight actions and rejects workflow fork. | A second session-management contract remains. Retire public fork and related actions, retaining runtime diagnostics and ordinary joined workflow calls. |
| Coherent consumer cutover | Active App modules and Task adapters use old names, payloads and result aliases. | Host-only migration would strand execution. Migrate paired sources and normalize retained references only on historical read paths. |

These are integration gaps, not evidence that a new lifecycle, permission model,
watcher or workflow tool is needed. The existing Task, workflow, watcher and
Condition responsibilities remain sufficient. Ordinary cancellation and safe
redo remain the accepted tradeoff; exact stack recovery is unnecessary.

## Delegation and verification

Root owns design and independent assessment. May owns source implementation and
coordinates Alex through the retained Task. Checklist A–F in the proposal gives
dependencies and proof. #585 is merged, so the correction requires a follow-up
PR. The existing Task and seven consumed development rounds remain retained;
the newly scoped implementation has a cumulative total of ten rounds.

The initial handoff incorrectly selected the primary repository rather than a
linked worktree. The native workflow rejected it before development. Alex
prepared a clean follow-up worktree at the inspected remote main, and Root sent
the setup correction to May for creator revision. This was an observed setup
failure, not an implementation round or a successful end-to-end trial.

Local candidate testing is explicitly authorized before merge. Require exact
candidate Host/SDK/App revisions, executable identity and rollback reference.
Exercise mixed calls and failure/cancellation, then native coding, publication,
actual CI/comment wakeup and same-Task repair, and Telegram review-link delivery.
The human reviews and approves on GitHub. Do not equate assignment admission,
workflow return, old-head checks or a notification claim with that proof.

At this baseline, design examples and the canonical App check passed (27
workflows). Full `check:may-design` failed on archive navigation and the existing
901-line Task resource contract; these baseline failures are separate from the
candidate implementation. Preserve unrelated edits when correcting navigation.


## Task, ingress and event observations during implementation

The live native path established a useful separation of facts:

- Creator revision saved the same Alex Task at generation 9 with the prepared
  linked checkout and retained seven consumed rounds. The rejected setup did not
  consume a development round. Alex then entered `develop-change`, including
  Bob/tech-lead contributions, under that same attempt.
- Fixing the selector did not fulfill the old caller input. May's scoped
  `converged` answer later completed setup escalation
  `appdep_86ee4bd64faa4d8c6ad066da` at 14:59:55 UTC while independent
  implementation waits remained. A waiting result had retained it earlier.
  This is evidence that exact return scope matters, not a reason to add another
  controller or Task per handoff.
- A direct Task input had no saved human reply context. Attempted communication
  received correction feedback; the corrected result retained machine evidence
  without inventing a Telegram recipient.
- Source `src/app/core/state/observation-demand.ts` still excludes idle/converged
  Tasks and satisfied Conditions. The SDK has no continuous-watch mode. Design
  text claiming availability was corrected. A late review comment after a
  readiness notice is now an explicit acceptance case; it is not yet proved.

The first committed implementation checkpoint, `df1f948c6d`, adds a callable
catalog and validation library but does not connect production adapters. It is
partial work, not an available unified interface or an activatable candidate.
Root returned source findings on production wiring, child cleanup, inherited
bounds, full input-schema constraints and post-start failure identity through
May. The existing diagnostic consumers of trusted CLI evidence also need migration.

After archive navigation repairs and contract status corrections, the complete
`bun run check:may-design` passed: integrity, examples, canonical App check (27
workflows) and model surface (9 agents). Those checks do not prove the pending
source cutover or connected runtime behavior.


At candidate `0e80817590`, an independent production SDK probe created a
credential-free temporary global agent with an `echo` workflow, listed the
catalog, then called the exact returned descriptor with `{ prompt, data }`.
Discovery returned `global/echo`; production `run()` threw
`Callable procedure "global/echo" not found.` The fixture uses no model or live
Task. This directly establishes the remaining list/call mismatch; changing only
discovery expectations is insufficient. Root returned it to May for workflow
repair. The candidate remains unactivated.

The existing admission/observer and Condition freshness/recovery suites also
passed independently against baseline source `43fc420a`: 64 tests, zero failures.
They cover production fixtures for receipt replay, conflict/generation checks,
subscriber isolation and retained-event recovery; they do not establish continuous
observation or candidate interface parity.


A live exact replay of the original implementation submission returned the same
event `6735424` and input `app_bee6227c-5257-4483-9bf6-191fc6ad72f0`;
read-only inspection found one event for that idempotency key. This establishes
live deduplication for the unchanged submission, not completion of its wider work.

After the first batch exhausted at ten rounds, Root assigned six additional
bounded rounds on the same Task under the ongoing implementation goal. May's
creator revision to generation 10 saved total sixteen but accidentally restored
the obsolete primary-checkout selector. Alex rejected the mismatch before coding
and escalated it; May corrected the saved selector at generation 11 without a
new Task or counter reset. The normal revision wake then restarted development.
This recovery occurred through the native owner path. It also exposed that
expected-generation fencing cannot detect stale content copied into a fresh
full revision; current-assignment readback and preserved-field guidance matter.
The broader source cutover and live candidate trial are still pending.

## Draft publication and connected PR observation

May published draft [#589](https://github.com/hao1939/may-agent/pull/589) from
`a3a0f2fe6a7bd83d634923d170071c58dafba195`, then pushed
`79240eb4357dc0abaa30d07ac7af8b2fa1503a7e`. The first checkpoint's Quality and
Container checks passed; that establishes CI for a partial implementation only.
The PR names the existing May delivery Task, with the original Alex relationship
retained. No candidate activation or readiness notification occurred.

Root posted inline review [4601676557](https://github.com/hao1939/may-agent/pull/589#discussion_r4601676557)
on the production list/call mismatch. Before Root relayed that comment, exact
resource-observer event `6735826` included it at the published head and satisfied
Alex's `pr-589-feedback` Condition. Event `6735855` then reported the newer head
and the same comment. Both use source `app:alex:observer:github-pull-request` and
type `alex.github.pull-request.state`. The same Alex Task resumed, inspected the
feedback and pushed its retained committed work. This proves native observation,
Condition routing and same-Task reconsideration. It does not prove complete
comment repair, a resolved review thread, or late feedback after readiness.

At 15:28:35 UTC, the independent production probe against local `79240eb435`
with an uncommitted `workflow-tool.ts` edit found that canonical invocation now
works. Missing/blank prompts, bare strings, the retired `task` field and the old
`owner/echo` name still start and return success, despite discovery advertising a
required-prompt schema with no additional fields. Results still use the old
standalone wrapper. Shared validators and discovery exports therefore do not
yet establish a coherent production cutover. This is dirty-worktree evidence,
not verification of an immutable release candidate. Root returned it through May.

After timeout the native workflow retained its checkout, fifteen consumed rounds
and evidence, and later attempts resumed on the same Task. One subsequent attempt
reported an unverified CLI-root blocker without invoking the mandatory development
workflow. Root returned a correction through May to use that existing path and
retain the actual rejection if it fails. Successful mechanical reentry does not
prove useful agent follow-through; this trial still needed owner intervention.
The next eight-round batch is authorized only at the completed sixteen-round
boundary, total twenty-four with all usage retained; no reset is permitted.

## Additional ingress checks

At 15:30 UTC, the public HTTP Task read identified Alex as ref `8b86f804`,
generation eleven, with its bounded attempt and Condition diagnostics. A
`POST /api/task/input` using generation ten returned HTTP 409 and the actual
generation eleven; no event was admitted for its derived key. Replaying the
current addressed continuation returned event `6735862` and input
`app_b96fb487-ba45-4891-a4a1-655622a1f348` again; a read-only audit found one event
for that idempotency key. These checks used installed baseline behavior, not
the callable candidate. Use public bounded reads for ordinary observation;
read-only storage inspection here establishes the admission/deduplication claim.

The owning Task and ingress guidance now separates a reconsideration wake from
new development allowance, requires full creator revisions to preserve current
fields, and describes scoped dependency fulfillment. The event proposal retains
shared continuous observation as a later source gap. Its fan-out/retirement trial
is separate from proving ordinary Condition rearming on the current coding PR.

## Revision admission blocker

At 15:38 UTC, May's supported `revise-assignment` workflow
`wr_1794929931222_2yuk` rejected the authorized total-twenty-four continuation:
`task-revision:["alex","input/appdep_03133108de69b2c8ee101309",11]` had already
been used for different desired work. The original Task remains generation
eleven with sixteen rounds consumed; its checkout and source are retained.

Read-only inspection found that the generation-eleven admission was saved at
15:12:13 with the same request hash and effective requirements as the preceding
generation-ten revision. It recorded generation eleven again. Source
`task-revision.ts` compares raw intent for its early no-op guard, then keys
admission by expected generation alone. Alex's mapper includes top-level
`constraints` that `resourceSpec`/`resourceIntent` do not retain. That extra
metadata lets an effective no-op miss the guard and occupy the current key.

At 15:43:30, Root reproduced the defect with the production baseline revision
API, generic App fixtures and fresh temporary SQLite: a no-op returns
`{generation: 1, changed: false}`, then an actual alpha-to-beta revision at the
same expected generation rejects as conflicting desired work. The fixture
includes mapper-only metadata; it needs no live state or credentials.

Root assigned a distinct three-round repair through May, Alex Task ref
`b974966a` (`input/appdep_87ebc66b5873aee2e8fcc2ae`), using a clean Host worktree
at `0606e2df16`. This owns the newly demonstrated Host defect and compatible
local activation, not replacement of the exhausted callable Task. The intended
fix compares effective persisted desired state and scopes revision identity to
the actual change while retaining old receipts and authority/freshness checks.
No live receipt deletion, artificial generation bump, usage reset or new ledger
is authorized. May will retry the original creator revision after the source
repair and supported local activation.

At 15:48:35, Root ran the same independent production-API probe against clean
hotfix `075947e6a048598c2e44771a20deddb2b82d2f84`: the unchanged revision kept
generation one, and the real change advanced to generation two. The candidate
exports the existing desired-spec projection for the no-op comparison and keys
new revisions by expected generation plus desired-spec hash, preserving old
receipts. Source proof does not repair the running installation.

Root found that the candidate's new test accepted a `constraints` input field
but its App mapper did not actually return mapper-only metadata. Root returned
that regression gap through May before publication. Full local CI also exposed
a missing Docker CLI prerequisite. At 15:54 UTC, Root installed official,
checksum-verified Docker CLI 29.10.0 and Compose v5.8.0; the six configuration
tests then passed without a daemon. This was environment setup, not an
implementation round or permission to weaken CI. Final clean-candidate CI,
focused PR publication, supported activation and actual creator revision remain
open.

## Task, ingress and event assessment

The current path already has durable exact admission, generation fencing,
replay, PR observation and same-Task reconsideration. It has not yet demonstrated
the complete promised delivery. Prioritize observed failures before replacing
those mechanisms:

| Priority | Observed gap | Next evidence |
| --- | --- | --- |
| Resolved locally | An effective no-op blocked the creator's real revision. | Focused #590 is active; the same Alex Task is generation twelve at total twenty-four with all sixteen consumed rounds retained. Carry the fix into the later callable candidate. |
| 2 | Coordinators retained answered setup/escalation inputs as waits; revision was treated as answering callers. Root-directed scoped cleanup now completes the old request and removes stale human action. | Fresh native follow-through without another cleanup reminder; preserve broader work and unrelated Scout obligations. |
| 3 | The unified callable change remains partial and needed manual repair directions. | Coherent Host/SDK/App candidate, owning tests and all four invocation directions through production adapters. |
| 4 | Watcher CI/comment wakes work, and a Root-triggered #590 notice has provider proof; autonomous #589 readiness notification and subsequent repair remain unproved. | Current-head green #589 CI and Telegram link, then a late comment causing same-Task workflow repair and revalidation. Preserve ordinary Condition demand. |
| Later | Continuous observation and journal/transport simplification remain proposed. | Independent per-Task delivery, missed-wake recovery and terminal observation before retirement; migrate each cleanup boundary with its actual consumers. |

The design correction keeps continuing observation separate from prerequisite
truth; a continuous interest must not force a Condition permanently false.
Aggregate event delivery labels cannot replace per-consumer admission receipts.
The ingress proposal also removes automatic Task closure from its transport
cutover: notification, idle state and closure have different owning decisions.
These are clarified requirements and review findings, not claims of installed
support or new implementation assignments.

At 15:58–15:59 UTC, native May workflow `wr_1794931082004_d9nc` revised the
same focused repair Task from generation one to two, total four with three
rounds retained. Its scoped result completed exact allowance request
`appdep_efb3811e531116e465757266`; read-only audit confirmed `status: done`.
Alex entered `develop-change` run `wr_1794931110330_edqv` on that same Task.
This establishes one working creator-revision and dependency-return path, not
completion of every older escalation or the original blocked revision.

Root also retried ingress key `root-hotfix-ci-extra-failure-1794931107836`
with different input. Installed Host rejected it as a definitive conflict;
read-only audit found only original event `6736098`. Earlier identical replay
and stale-generation checks remain separate evidence.

The last retained three-round workflow evidence includes seven failures:
six missing-Docker configuration cases and the standalone work-stop test at
`packages/sdk/src/runtime/app/standalone.test.ts:875`. The latter failed its
300ms whole-run bound under sixteen-shard load and passed when Root ran its
owning case alone. That contrast does not establish a fixed race or a passing
full suite. Root returned the exact failure to May; final current-candidate CI
must be read independently. The repeated environment failures also motivate
using the existing specialist `clarify` return when setup, rather than a code
change, is needed. This is App execution guidance, not a new Host classifier.

At 16:02 UTC, Root independently verified clean hotfix
`54528704a9d6eb223c2fd48de4bb38862a5d30ba`: all twenty owning tests passed with
107 assertions; the production-API probe preserved no-op generation one and
admitted a real change at generation two. The exact corrected regression also
failed baseline `0606e2df16` at the intended admission collision in a temporary
archive. Root matched its test hash to the committed candidate.

The fourth native development round returned incomplete despite finding no new
source defect. Bob's review requested PR/head, activation and original-Task
revision evidence before accepting the local candidate. This leaks the wider
Task's delivery scope into a procedure explicitly ending at local source
evidence, making later delivery a prerequisite of its earlier stage. Root
returned that boundary correction through May with independent source approval.
Alex still owes exact-candidate full CI, PR/checks and supported activation on
the same Task; no additional code round is needed merely to run delivery.
The later paired App migration should correct specialist context to assess the
local candidate while retaining the outer Task's unresolved obligations.

At 16:07 UTC, Alex published focused [PR #590](https://github.com/hao1939/may-agent/pull/590)
at `54528704a9`. Root read the native full-CI log from that exact-candidate
delivery attempt and retained it locally: four-shard `bun run ci` completed with
no failed cases. The earlier failed receipts remain evidence, rather than being
overwritten by this pass. At 16:09 UTC the PR observer emitted event `6736222`
and the same Task rearmed `pr590-current-head`; current-head Container passed
while Quality and automated review were still running. This is native
observation/reconsideration, not activation or proof of original #589 readiness.

At 16:12 UTC hosted Quality failed in
`test/e2e/task-startup-no-schedules.test.ts:212`; its retained fixture logs show
SQLite contention around approval and workflow admission after restart.
Container passed. Copilot also raised
[a real revision defect](https://github.com/hao1939/may-agent/pull/590#discussion_r4602310501):
priority/category updates can preserve generation, so returning to an earlier
desired spec reuses its old key. At 16:13 Root independently reproduced
P0 → P1 → P0 against clean `54528704a9`: all remain generation one, and the final
call incorrectly returns unchanged while P1 stays persisted. The earlier
source approval is withdrawn for activation until this counterexample is fixed.

The smallest correction binds operation identity to the starting resource
version as well as generation and desired state. Add a same-generation round
trip beside the no-op regression, preserving old receipts and current attempt
fences. Root authorized total six on the same hotfix Task with all four rounds
retained, through May's supported creator revision at the completed boundary.
The native PR watcher remains the feedback producer; no merge or activation has
occurred. This failure demonstrates why baseline-failing regression evidence
and a passing local suite establish only their tested contracts.

At 16:18 UTC, native commit `9e9c215a5cec1eaa2cd1e08a938422ce1059891b`
added starting resource version to the key and an owning round-trip regression.
Root reviewed the clean candidate and reran both independent production-API
probes: no-op then real requirements change passed, and P0 → P1 → P0 now saves
each requested priority while generation remains one and resource versions
advance two, three, four. Source approval is conditional on new-head checks and
review resolution; it is not activation evidence.

Root also assigned the demonstrated App specialist-context defect through May
as distinct Alex Task ref `5cb8bf19`
(`input/appdep_a5ef480a7c34b965ca935397`), cumulative limit three. Its outcome
ends at a locally committed, verified, reviewed Apps candidate, so it cannot
require its own future publication/activation before returning. It must keep
the owning Task's source requirements and selected checks, clarify exact setup
dependencies, and retain failed receipts and consumed rounds. It changes no
Host source or existing Task identity/allowance. This is separate from the
original callable Task and the Host revision incident; Root will review the
App candidate before May's authorized local integration and definition activation.

## Canonical App integration and activation checks

The focused App source contribution completed at `302dc3c39f`, with 79 focused
tests and independent review. Root approved its two-file scope, and May
integrated it into canonical Apps main as `bd4bc11483`. Canonical verification
ran 76 workflow tests (518 assertions) and the full design check successfully;
the earlier 79-test receipt has a broader focused scope. Definitions release
`bd4bc1148392ac379ec0dcc5a72e7ba9de17887c-definitions-v6` is selected locally.
This establishes source integration and selected release identity, not live
model improvement or unified-call migration.

The failed worktree design check remains evidence. Root's diagnostic using the
unchanged checker measured 35,935 prompt characters in `/app` and 36,703 in the
long checkout. The difference is exactly 768 characters in twelve absolute
skill paths; common instructions and Alex instructions have equal character
counts. Both runs omit execution instructions because the checker points to
the removed `projects/may-agent/src/lib/execution-instructions.md`, rather than
the SDK runtime location. Canonical passing checks therefore have this fidelity
limitation. No budget or catalog was weakened to accept the App correction.

At 16:26 UTC, PR #590 head `9e9c215a5c` passed hosted Quality and Container;
the code review thread is resolved. Native observer event `6736445` later
reported that exact green head, satisfied the saved fingerprint Condition and
woke Alex. Root independently verified source probes, current checks and review,
then approved this focused candidate for supported local activation.

May's first deployment omitted the canonical deployment root. It staged the
candidate under the isolated checkout, leaving receipt
`may-goal-appdep1504-pr590-9e9c215` at `requested`; the installed restarter read
the canonical bundle and restarted baseline `43fc420a`. Root caught the mismatch
through receipt, installed-version and supervisor read-back, and returned the
explicit-root correction to May. A healthy process and a successful build did
not prove activation. Preserve the first receipt and use one coordinated owner
for the corrected supported operation. The original Task revision, paired
callable cutover and connected notification trial remain outstanding.

At 16:32 UTC, Alex's corrected canonical operation settled receipt
`pr590-task-revision-admission-20261117-v2` as `succeeded`. Root independently
matched installed SHA-256 `1571b823de836f2ea697ae9f45d8a3f14cf18b623f0c7b79a06b652bb55e6e89`
to the requested and loaded artifact, read embedded version `9e9c215a`, checked
readiness, and verified the paired SDK/UI links. The earlier Alex operation
using a nonstandard receipt directory was rejected before activation and is
retained separately. No PR was merged.

May's supported creator workflow `wr_1794933224985_ceqc` then saved the original
Alex Task as generation twelve with total twenty-four and sixteen consumed
rounds. Root read back the retained checkout, dirty-file list, PR, caller and
protection constraints. The normal revision wake entered `develop-change`
`wr_1794933247365_qfuh` from the selected corrected App definition; the workflow
record names its immutable release path and content hash. A repeat of the
identical pre-restart input returned the same event `6736477` and inbox identity
after activation, with one journal admission. These establish revision,
continuation and replay mechanics, not completion of the unified implementation
or fulfillment of every older setup caller. The connected PR/Telegram trial
remains open.

The focused hotfix Task first tried `communication` against a creator-revision
input with no saved human reply context. Host rejected the proposed finish with
specific correction feedback. Alex then returned a normal scoped result for
the retained request keys, which was accepted. This distinguishes the automatic
Task caller return from optional human communication and avoids inventing a
Telegram recipient. The Task contract and execution guide now explain that
distinction beside scoped repair returns.

May subsequently retired the two exact obsolete generation-one human Conditions
and returned a scoped answer to `appdep_f8ee63b301c7462be3307da2`. Read-back found
that request `done`, its caller Condition true, and no `humanAction` in the
original Alex public view. Root explicitly requested this cleanup; the path
works, but spontaneous follow-through is not established by that intervention.

## Focused review notification and remaining implementation

Root explicitly requested one review-ready notice for the completed focused
#590 fix through the existing May Conversation Task. The input saved the known
`may:primary` reply context at admission. May corrected two rejected reports
(an invented input-key prefix, then simultaneous `message` and `replyId`) and
returned one accepted communication. Event `6736592` names that message;
`notification_messages` confirms Telegram provider message `50703`. Replaying
the original input returned event `6736582` and the same completed inbox item;
one provider-message record exists. The fallback Conversation mirror did not
create an addressed-delivery row, so this is a confirmed single-message send,
not an offline replay or exactly-once delivery guarantee.

The notice asks for review on GitHub and explicitly keeps #589 unfinished.
Root supplied its readiness trigger; this proves the notification capability,
not autonomous #589 readiness. The late-comment-after-readiness trial remains
outstanding. Ordinary fingerprint Conditions remain the supported observation
mechanism; continuous observation has not been implemented by these changes.

Native #589 work has reached clean local `92a8655c40`, including standalone
listed-name dispatch and prompt/data preservation. Root's independent envelope
probe at clean predecessor `1b63570a71` passed canonical input and rejected
missing/blank prompts, bare strings, retired fields and noncanonical names.
The production model/Task adapters, paired Apps and broader fixtures remain
unfinished despite passing `check:ci`; retain the failed broader test receipts.

App migration also has a concrete registration collision: Alex and Evaluator
both forward `evaluation-report-reader` into App `alex`. The new namespace
requires one registration at `alex/evaluation-report-reader`. Root assigned
that migration finding through May and clarified the stale Tech-lead guidance
conflict in proposal D. No duplicate-skipping workaround or new permission
exception is justified. Later candidates must also retain the active #590
revision repair before local activation.

## Revised scope, checkout ownership and false convergence

The same finite App-guidance Task was creator-revised to generation three with
explicit acceptance requiring `tech-lead/AGENTS.md` changes. Alex nevertheless
reported that old `302dc3c39f` already satisfied it. That commit changes only
`develop-change.ts` and its test. Root inspected the exact supplied decision
snapshot: the new requirements were present, so this was an incorrect agent
judgment rather than lost ingress or stale Host context. Root rejected the
conclusion through May; the same Task entered native `develop-change` and produced
`bb41c0b365`, actually changing the required guidance file. Its focused check
passed 79 tests and independent exact-candidate workflow review. May integrated
only that new commit as `abd19b4d81` and ran canonical checks successfully.
Reload events `6736783`/`6736784` establish successful local activation; Root
independently matched the active release's guidance bytes to canonical source.
The long-worktree model-surface failure remains recorded. These establish the
bounded source correction and its activation, not later production-model
improvement; already-running invocations retain their earlier snapshot.

May also briefly saved the finite guidance Task's checkout as the original
#589 Task's paired-App migration checkout. Root caught the overlapping ownership
before a paired migration commit. May revised the original Task to generation
fourteen, preserving its cumulative total of thirty-two and twenty-four prior
consumed rounds, removing that shared selector and treating `92a8655c40` as a
starting SDK revision rather than a permanent implementation pin. The old
generation-thirteen workflow returned interrupted progress with its dirty
`standalone.test.ts` retained; no broader readiness was established.

These observations refine existing boundaries: one editing owner per checkout;
actual candidate revisions on verification receipts; scoped answers separate
from revisions and wakes; and reconsideration of an old conclusion against new
requirements. They do not justify a Host semantic acceptance gate, replacement
Tasks, a new allowance ledger or another event lifecycle. The event audit now
distinguishes retained historical pair diagnostics from the authoritative
Task/request records used for current work.

Later local Host checkpoint `779f9a443f` migrates standalone fixtures and passes
65 selected tests. It changes tests only: production model/workflow adapter gaps
remain. The removed native-CLI alias tests must not be used as evidence that the
replacement callable route or mixed-tree cleanup has been verified. The proposal
now orders the next production-adapter checkpoints explicitly, before further
standalone-only work.

## Parallel review publication

The user took ownership of the separate ingress/input and event-system proposals
and requested immediate pushes for parallel review. Root pushed May's committed
Host checkpoint `166d8d15b1` to the existing #589 branch, updating old remote head
`79240eb435`. It adds built-in cooperation independent of workflow-directory
presence and removes loader delegate-deny configuration; the model tool's old
resolver, controls and permissions still remain. Local source evidence includes
65 passing selected tests and `check:ci`; the discovery command ran four tests,
but its requested toolset-loader test path did not exist, so it is not loader
regression proof.

GitHub read-back found a non-draft PR with a Draft title. Root converted it to an
actual draft, updated its title/body with concrete remaining work, and verified
head `166d8d15b1`. Quality and Container checks were running at this checkpoint.
This publication was a Root administrative intervention while May's workflow
continued, not autonomous publication or connected-trial proof. Apps design and
guidance were pushed to the existing bare backup remote at `7460e9a36a`; the Apps
tree must not be pushed to the separate Host repository as a design PR.

## Fixed preparation and namespace probe

Native workflow `wr_1794936065682_hnuq` produced `c4675a10d7`, `fee62623f6`
and `d5f4699dee`. Complete hosted catalog preparation now runs inside the
workflow's finite cancellation bound; the rejected lazy-growing variant was
removed. The actual model-tool suite is `src/lib/agents-tool.test.ts`, not the
nonexistent `manager-agents-tool.test.ts`. With that corrected selector, 83
selected tests pass. May pushed `d5f4699dee` normally to the existing draft;
its Container check passes and Quality fails. This establishes useful progress
and native checkpoint publication, not cutover readiness.

An independent credential-free probe found two remaining production gaps:

- Registering `global/reviewer`, `alpha/reviewer` and `beta/reviewer` through
  the real manager retains only the last definition. The loader also selects
  by bare name before building a canonical catalog. Distinct namespaces must
  coexist; duplicate rejection applies to the complete canonical address.
- Standalone discovery lists both Apps' workflows, but an invoked workflow's
  `ctx.list()` returns an empty list and an `alpha/bridge` call to registered
  `beta/echo` fails. Root selection must preserve the complete configured tree
  catalog for both discovery and dispatch.

The [PR review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5943386521)
records those findings. The central model-tool migration, common results,
paired App cutover and connected runtime trial remain open. The same delivery
Task reached 32 consumed rounds and was revised to cumulative total 40 with
all usage retained. A stale SDK setup prerequisite was reintroduced during that
revision; Root clarified that paired App verification cannot gate independent
Host implementation. A candidate dependency link also followed the App
checkout's shared `node_modules` link. Root restored the primary SDK and gave
the paired checkout private dependency links; its candidate SDK resolution was
independently verified. Neither setup correction establishes source readiness.


## Model snapshot checkpoint and standalone boundary

Published `4485c69797` removes the model tool's legacy permission, fork/session
and alias branches and dispatches captured definitions. Root independently ran
its three owning suites: 67 pass, no failures or skips; `check:ci` also passed.
Later `a6d46285aa` fixes per-tree preparation and actual-caller binding. Eight
independent production model checks pass: later invocations see their own
snapshot, active parents/children share captured targets, grandchildren retain
the actual parent, and invalid input starts no child. This is model-boundary
proof, not a complete SDK or installed-candidate claim.

At clean `a6d46285aa`, a separate deterministic production standalone probe lists
the expected complete catalog, then invokes a prompt target configured only
with `finish`. That execution has no built-in `agents` tool. All-four-direction
execution, matching model/SDK discovery and the common public `run()` result
therefore remain unproved; current source still exposes the legacy SDK tool
schema/result wrapper. The fixture deliberately does not enable cooperation in
the agent config. Native workflow `wr_1794937770387_ve3g` is continuing the
registry/SDK repair on the retained Task. Exact source, dirty-state readback and
probe receipts are retained in the local trial record. No callable activation
or #589 readiness notification has occurred.


At clean `73f89ae9a4`, Root independently verified real loader preparation and
publication into `SubagentManager`: all three same-declared-name namespaces
coexist, exact lookups select their owner, duplicate canonical registration
rejects preparation, and the prior published generation remains intact. The
25 owning loader/model tests pass. Root pushed this native source checkpoint to
the existing draft for immediate parallel review; publication was administrative.
The alias-preservation review thread was resolved with the already recorded
intentional breaking-change rationale. Timeout and schema findings remain open.

The native workflow reached forty consumed rounds. Two bounded SDK attempts
were fully reverted after legacy and production fixture failures, so they do not
establish retained SDK implementation. Root authorized a further finite total
of forty-eight on the same ledger, preserving all forty consumed rounds. Future
passes should retain coherent partial source and migrate affected retired
fixtures, reporting failures explicitly; an unfinished draft checkpoint does not
need to claim full cutover readiness. No second compatibility mode is accepted.


## Retained standalone catalog progress

Root pushed native `c9fc3db8fc` and `6ab032f440` promptly to the existing draft.
At clean `c9fc3db8fc`, independent production probes confirm complete workflow
`ctx.list()` and a successful `alpha/bridge` → `beta/echo` call with prompt/data
preserved. The actual five-suite result is 104 pass and 9 fail, including retired
fixture semantics and real unconfirmed-import cleanup defects. The cleanup repair
at `6ab032f440` passes both owning root-preparation timeout/cancel cases
independently; a full green suite at that revision is not established.

A separate clean-`c9fc3db8fc` probe modifies only synthetic agent metadata during
its controller workflow. Its second `ctx.list()` reflects the changed description,
so descriptors are not yet a fixed snapshot. The child workflow correctly keeps
its old captured implementation. The
[review finding](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5944021806)
requires capturing prompt metadata and using it for discovery and actual prompt
execution. The all-four-direction probe still stops at missing built-in prompt
cooperation. A schema-bearing workflow returning the agreed literal common
report also fails the older SDK terminal validator; public `run()` still exposes
a legacy wrapper. These are retained source obligations, not setup or activation
failures. The original Task continues at generation sixteen with forty consumed
rounds preserved in a finite total of forty-eight.


## Standalone cooperation checkpoint review

Published draft #589 remains at `1de011188a3391e7542143ca8f529555fd9e5c31`.
Its Container check passes; Quality stops at an unused
`discoverAgentsRootForTarget` helper in `standalone.ts`. The five-suite native
result at that head is 93 pass and 20 fail. Earlier 104/9 results describe the
older catalog checkpoint and cannot establish current-head validation.

The next native workflow retains the same delivery Task and consumed rounds.
Root independently exercised its uncommitted composition repair through the
real standalone prompt execution loop, with a deterministic local model stream
and synthetic definitions configured only with `finish`. The probe now reaches
agent→agent, agent→workflow, workflow→agent and workflow→workflow calls, preserves
prompt/data, and observes identical complete descriptor lists. Common-result
checks still fail: child results expose `kind`/`cliCalls` and public `run()` exposes
`ok`/`report`/`result` wrappers. This is intermediate production-path evidence,
not a committed checkpoint, external-model trial or local activation.

The accompanying exact-name repair rejects bare and outer-whitespace names,
but the shared resolver still trims components: `global/ echo` and
`global /echo` execute the registered `global/echo`. Validate exact captured
catalog membership rather than partially validating a name before permissive
resolution. Rejected pre-start calls also still throw instead of returning the
common error without an execution ID. These findings were returned through May
to the same active workflow; they do not justify retaining legacy calls.

A fresh running-executable readback at 18:27 UTC reports version `0606e2df` and
SHA-256 `ea489459f03291a2c5753ebeeb687e9553d1efdb919c6da84f26f4f2148adcb1`.
That differs from the earlier successful #590 activation receipt. The old
receipt establishes that trial only; it cannot establish the currently loaded
source. Do not overwrite another operator's runtime changes. The eventual
paired callable trial must identify its actual running artifact, retain the
Task-revision source repair and current legitimate installation changes, and
verify the compatible App revision before claiming activation.


At clean native `c1348034f99d29d2fa8e42a013b0fe89197b1430`, the focused five
suites now report 112 pass and no failures, and `check:ci` passes. Root pushed
that checkpoint immediately to draft #589. Independent reruns confirm the
cooperation/discovery improvement and retain the result-wrapper and component-
whitespace failures above. A new explicit-module preparation probe also confirms
that both timeout and cancellation report cleanup as complete while an observed
import remains pending. The
[current review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5944336882)
records the exact dispatch and cleanup defects; the corresponding fixture must
keep its unconfirmed-cleanup assertion. Passing focused suites after changing
that assertion cannot close this finding. The original workflow has ended at
its actual cumulative 48/48 boundary; subsequent repair must preserve all usage
and continue through the same Task and workflow path. Full hosted CI, common SDK
results, paired App migration, activation and connected delivery remain open.


## Common child result checkpoint

Root pushed native `6515fe0465b3283ed3fed66c0389e77f37b8a5af` promptly to the
same draft. The SDK aliases `ExecutionResult` to the common result type, removes
executor/CLI fields from public producers, and removes producer-selected IDs
from workflow completion helpers. Its native five-suite verification reports
112 pass and no failures; `check:ci` passes. Independent checks at the clean
commit pass common child result shapes through all four real standalone call
directions, matching complete discovery and built-in prompt cooperation. Public
`run()` still returns the legacy wrapper, so the complete probe remains red.

The schema probe now reaches literal common reports and exposes another
admission gap: output checks run only for `done`, allowing a blocked report's
schema-invalid supplied output through. Missing unavailable partial output is
valid; supplied output still requires the target and caller checks. CLI receipt
extraction remains available internally, but the owning `read.execution`
projection and its active consumers still need migration. The
[result review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5944491441)
records both gaps. Earlier exact-name, metadata, import-cleanup and bounded-call
findings remain open. The same Task is now generation seventeen with all 48
prior consumed rounds retained in a finite total of 56; its native development
workflow continues without a replacement Task or ledger.


## Published child admission and paired source checkpoint

At 18:59 UTC, Root pushed May's native commit
`eedf54fac4c07f7e191d59e2580596a99f71aa9d` to draft #589 for parallel review.
It follows `485856afa7`, which restricts shared call options to timeout/schema.
Against an exact clean detached snapshot, independent checks pass all 75 tests
across the five owning callable/model/workflow/kernel suites and `check:ci`.
The child-input probe rejects all fourteen invalid prompt/workflow calls before
execution and returns common errors without child IDs. The read-only-context
probe confirms a child cannot regain its parent's unavailable Task mutation
binding. This preserves existing runtime context without restoring invocation
permission options. GitHub Quality and Container were still running on this
head; focused checks do not establish full CI or readiness. Root's administrative
push is also distinct from autonomous May publication.

New native local commit `eb77e74da657c9332a41f6ff59595c2bc90da9db` converges the
public standalone result. An independent clean-snapshot probe passes all ten
checks, including all four child call directions, matching complete discovery
and the common root result. Its standalone owning suite has 28 passes and four
failures from remaining wrapper expectations. Other production probes still
reproduce invalid supplied partial output, thrown pre-start errors, accepted
component-whitespace names, live rereading of prompt metadata, and confirmed
cleanup while an explicit-module import remains pending. Root returned these
findings through the same May Task. The new process-global diagnostics map is
also unnecessary retained state; use the existing execution read/observer for
trusted receipts and migrate consumers with it.

The paired App Task produced clean partial source
`e3c383371e88735643fa79ba82a27172104b7a78`, including canonical Alex calls,
current Task-input forwarding and one registration of the shared report reader.
It remains isolated and unactivated. Its `develop-change` exported schema still
requires bare top-level `verify`, while execution uses a new
`ctx.input.data ?? ctx.input` fallback. The proper envelope fails real shared
schema admission. Migrate the full schema and fixtures and remove that fallback;
a passing adapter test cannot establish production admission.

Dependency setup initially mixed Host versions: Apps TypeScript paths resolve
`@may-agent/sdk/app` through `projects/may-agent`, while runtime imports could
fall through to the private candidate `node_modules` binding. Root reversibly
bound both ignored links in the isolated App checkout to clean full Host source
`485856afa716ab8c2545485f3d3459b376a55792`. Actual resolution of both SDK entrypoints
now identifies that one snapshot. Canonical workspace dependencies remain on the
installed baseline. Against this exact provider, the two selected App suites
have 98 passes and one failure from a legacy root input. May received the clean
provider identity and setup receipt to resume the same App contribution without
waiting for the wider Host outcome to settle.

The later clean App checkpoint `009d038e578a736009c68c21be5ad71cd1dd87c2`
fixes the exported development schema and removes its raw-input fallback.
Independent checks against the same frozen Host provider now pass all 100 tests
in the two selected suites. Real discovery returns 33 registered descriptors;
actual shared validation accepts the proper development envelope and rejects
legacy input and blank prompts. Root pushed the retained App branch
`task/input-appdep_a5ef480a7c34b965ca935397-6485222407` to the Apps backup remote
for review, without integrating it into primary Apps. Six active May/Scout
migration errors remain in broader checks. The retained dirty standalone test
migration also now passes 32 tests, but it is not a clean committed checkpoint.

Two root adapters need correction before the paired trial. Public standalone
`run()` performs discovery with a separate default 15-second bound; a real
controlled import remains pending beyond a 1500ms watchdog despite a 100ms
requested timeout. Task-bound workflow ingress still supplies raw domain input
instead of the complete envelope. The
[production-boundary review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5944781227)
identifies those owning call sites and required regressions. Root assigned both
through May. At the actual 56-round boundary, the same Host Task was revised to
generation 18 with cumulative total 64, preserving all 56 consumed rounds and
retained source rather than resetting its allowance.

Probe receipts, logs and the full dependency-resolution receipt
`paired-frozen-host-sdk-binding-1794941652292.json` are under the existing local
trial directory `/app/.state/pr585-agents-convergence-e2e-20261117/`. These are
synthetic production-boundary checks, not external-model, paired-activation or
Telegram delivery proof. No unified candidate has been activated. The most recent
executable readback still identifies baseline `0606e2df`; the earlier #590 local
receipt must be re-established in the final compatible candidate.
