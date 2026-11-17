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


## Root adapters and full migration boundary

Root published native Host `28512c1971be85c791df0e9ed76429c3b8a20de9` for parallel
review. Independent verification on its clean detached snapshot passes 194 tests
across nine affected Host/SDK suites and `check:ci`. Ten production four-direction
checks pass. A real controlled import settles at 106ms with a 100ms root timeout;
previously it remained pending beyond the 1500ms watchdog. A fresh SQLite Task
runner probe now admits the full workflow schema and preserves the assignment,
Task identity, domain data and unchanged reconciliation input. All five checks
pass; the earlier published head rejects before that workflow body starts.
Common root validation errors now return without an execution ID. Supplied
invalid partial output still escapes validation.

The `50050df8d4e248edaebd8a2e5edbddbd42bfb54d` registration-name repair
passes eleven owning tests, but it does not repair actual standalone child
lookup. Native Alex independently pushed this commit to the existing PR from
session `s_1794943154169_b596df4d-9e6b-4e43-99fa-3949f8499cb5`; Root's later push
was a no-op. This establishes native publication, while the earlier Root pushes
remain administrative evidence. The production call-surface probe still invokes `global/ echo` and
`global /echo`; other invalid child names throw. Separate clean-snapshot
integration/export verification has 26 passes and seven failures. A downloaded
superseded-head hosted log contains a completed shard with 724 passes, two skips
and 47 failures. Other processes persisted until cancellation. Full CI is an
open migration requirement, not merely a pending readiness announcement.
Preserve meaningful lineage, cancellation and result tests while migrating
retired inputs/actions. In particular, replacing the real standalone SIGINT
child-drain regression with a help smoke test loses coverage; migrate its
fixture to a registered contribution and the canonical envelope instead.

The paired App checkpoint `a8181ba58287949c91cf178a6f9708965669a5a3` is clean and
published on its retained backup branch. Forty focused tests pass against frozen
Host `485856afa7`. Real standalone invocation of its report reader with
`data.operation = "read-publication"` and no publication now correctly blocks.
Clean frozen `009d038e57` instead silently lists five reports because the body
reads the old top-level field. This demonstrates why schema/type checks alone
cannot establish the App migration. Metric review, Task review, runtime audit,
comparison and active May/Scout bodies/callers remain to migrate at `a818`.

The live App trial also exposed a checkout mismatch. A direct specialist's
relative edits and initial checks ran in its generation-generated workspace,
not the retained candidate named in its prose assignment. The useful edits were
preserved and recovered into the retained branch, then checked against the exact
provider. A supported `develop-change` execution must bind tools to the saved
candidate rather than rely on a prose path or an unsupported shell `workdir`
argument. Root preserved a rescue patch; no primary Apps source was changed.

The App Task then reported convergence despite the remaining full active-App
acceptance. Root retained its useful partial source and returned the concrete
gaps through May. May revised the same Task to generation six, cumulative total
sixteen with at least eight prior rounds retained: four recorded workflow rounds
and four direct specialist exchanges. It now invokes `develop-change` over all
33 configured targets on the retained candidate. This is correction of a domain
completion judgment; the Host's valid report admission alone cannot certify it.
The original Host delivery Task and final paired-trial obligation remain open.

Root also prepared an independent clean App `a818` / Host `50050` fixture without
changing the live App workflow's saved `4858` dependency binding. Actual imports
of both `@may-agent/sdk/app` and `@may-agent/sdk/runtime` resolve into that one
newer Host snapshot. Three selected App suites return 113 passes and eight
failures: seven retained-evidence/workload handoff failures and one old public
result-wrapper expectation. Thus the remaining failures cannot be dismissed as
an unavailable provider. The binding receipt and full test log are retained as
`a818-host500-binding.json` and `a818-host500-independent-apps.log`. May received
them for the next coherent verification pass, preserving the active tree's
current snapshot.

Exact receipts and logs are retained under the existing local trial directory.
No unified Host/SDK/App pair has been activated, no native readiness Telegram
has been proved, and late-comment follow-up remains unverified.

## Exact child dispatch and common pre-start results

Root pushed native Host `aac9bd6e21828e6b7ceab8bcadb7a752c7356d70` to draft
#589 for parallel review. Independent verification on a clean source snapshot
passes all 103 tests across standalone, workflow-kernel, model agents and
workflow-tool suites. The production child-call probe now passes all seven
checks: canonical invocation works, invalid aliases/case/whitespace/empty
components reject, and every pre-start miss returns the common error without a
child execution ID. This closes the dispatch defect that remained after the
registration-only fix at `50050`.

The same exact-source probes retain three failures: malformed supplied partial
output passes, prompt descriptors reread live metadata within an invocation,
and explicit-module timeout/cancellation claims confirmed cleanup while its
controlled import remains pending. Native implementation of the output repair
is in progress; it is not included in this published checkpoint. Trusted CLI
receipt projection/consumers, finite cancellation settlement, the real CLI
cancellation regression and complete current-head CI remain unfinished.

Native App `d9b0e57c972f691ae9efffa8479543213a900989` adds partial bounded-cleanup
and Scout migration. Full configured-target migration remains open: active
Evaluator metric/Task/runtime-audit workflows and Gym comparison still read raw
domain input at that revision. Removing per-call `tools` must also preserve
intended read-only model-child context through existing module/definition setup,
without restoring invocation permissions. Root prepared another independent
frozen App/Host pair for verification; the running App workflow's provider was
left unchanged.

Receipts are `aac-independent-focused.log`,
`standalone-call-surface-1794943786034.json`,
`schema-report-1794943786017.json`,
`standalone-snapshot-1794943786029.json`,
`module-import-cleanup-1794943786521.json` and `d9-host500-binding.json` under
the existing local trial directory. Root returned these findings through the
existing May coordinator. Separate ingress, event and Task-system proposals
remain with the user. No candidate activation or connected readiness proof is
claimed.

## Workflow output repair and prompt partial-result mismatch

Root published native `2f6aaaf15ca01086d4c43a159281e1246e2cb7ca` to #589.
Independent exact-source verification passes 115 tests across five affected
suites, and all eight workflow schema/report probe assertions now pass. Supplied
malformed workflow output is rejected for incomplete reports as well as `done`;
an incomplete workflow may still omit unavailable output.

The corresponding real prompt-executor probe exposes a remaining mismatch:
`createWorkflowFinishTool` always requires output when a schema is supplied.
A valid blocked finish without unavailable output is rejected and requests
another model reply. The workflow path accepts its equivalent. The existing
result contract already requires both paths to agree; migrate prompt finish
admission and add its owning regression without weakening supplied-output
validation or correction feedback. Root returned the deterministic reproducer
through the same May coordinator.

App `d9b0e57c97` is now published as a partial checkpoint on its retained backup
branch. Independent frozen App `d9` / Host `50050` verification has 145 passes
and eight failures across six suites. Additional diagnostic fixtures preserve
the source and reveal concrete failures: the retained-report loop's canonical
`alex/read-report` call is missing from its fixture catalog, while the workload
cases return a waiting result without an exact Condition. The Host retains
these failed attempts as pending. Migrate real canonical fixture setup and
preserve the original read, evidence, owner-handoff and restart assertions;
do not weaken Task settlement to make migration tests pass. The eighth failure
is a retired public-result wrapper expectation. All active body/schema/guidance
migration and final compatible-pair verification remain required.

Evidence is `2f-independent-focused.log`, `schema-report-1794943973481.json`,
`partial-prompt-report-1794944046856.json`, `d9-host500-independent-apps.log`,
`d9-host500-agent-diagnostic.log` and `d9-host500-recovery-diagnostic.log` under
the existing local trial directory. These checks do not establish activation,
full CI or readiness notification.

## Captured prompt configuration and native PR observation

The stronger exact-`2f6aaaf1` standalone probe demonstrates live configuration
rereading in actual prompt execution. After catalog preparation, its synthetic
controller changes the fixture's model, description and `AGENTS.md` identity,
then invokes the already listed canonical agent. Real child preparation chooses
the new model and identity; discovery also changes. Fixing descriptor text alone
cannot satisfy the accepted immutable-tree contract. Capture and reuse complete
prompt configuration/identity during bounded preparation, while permitting a
later independent invocation to observe the new version. Root returned the
credential-free reproducer and replied on the existing metadata discussion.

The source also retains an unused public `dataSchema` compatibility authoring
path in `CallableDefinition`/`effectiveInputSchema`, exercised only by its old
contract fixtures. Complete B by retaining one full-envelope `inputSchema`,
migrating those fixtures and rejecting legacy authoring with useful feedback.
This removes a temporary migration path rather than adding a second schema
translation rule.

There is positive native process evidence before readiness: the existing GitHub
observer delivered `alex.github.pull-request.state` for `2f6aaaf1`, including the
new prompt partial-result review, to the same Host Task at generation eighteen.
It woke session `s_1794944232309_f54e19d2-a1cf-41fb-8670-43be3af9f9c6` without
Root manually waking that Task. Container was green and Quality remained
running. This proves observer-to-Task reentry; subsequent repair and the
late-after-readiness case still need evidence. At the actual 64-round boundary,
May creator-revised the same Task to generation nineteen with cumulative total
72 and consumed floor 64. The retained App workflow continued independently.

Receipts are `standalone-config-snapshot-1794944373036.json` and
`native-pr589-observation-2f.json` under the existing local trial directory.
No unified candidate has been activated and no readiness Telegram has been
established.

## Legacy schema removal and prompt partial-result repair

Root pushed native `b6f153b5ece253ae070f7db6ff292578f58a6899` to draft #589.
Independent clean-source verification passes all 122 tests across six affected
suites and `check:ci`. The real prompt-execution reproducer now admits blocked
finish without unavailable output in one reply and projects the common blocked
result. The preceding `2f6aaaf1` requests another reply and fails. Internal
prepared execution may use `done` with a blocked finish; the production
`agentExecutionResult` projection supplies the caller-visible common status.
The probe checks that owning boundary. All three finish/admission layers changed,
and the unused `dataSchema` authoring path is removed with correction feedback.
The actual omitted-output prompt regression still needs committed owning
coverage; changing an existing missing-success-output assertion is insufficient.

Root also published native App `ff6edba21ae7160685ffa1f6d563fdd1e159721a` on its
retained backup branch. A clean pair with exact Host `2f6aaaf1` passes all three
retained-report owner-loop cases that previously failed canonical registration.
The four workload handoff cases still fail. Separate metric/Task/cleanup tests
have 52 passes and six failures before any new workflow-entry prototype.
Both SDK entrypoints and the TypeScript alias use the same frozen provider;
the native workflow's saved provider remains unchanged.

The native contribution then prototyped four remaining entry-point migrations
and reverted them after red checks. The independent baseline reproduces those
failures, so unchanged red tests alone cannot establish that the prototype
regressed behavior. Root returned that evidence and a smaller sequence through
May: migrate one registered canonical entry point, its actual callers and
production-admission fixture, retain useful source and commit a truthful partial
checkpoint, then continue the remaining entries. Private domain helpers need
not become a second public callable input format. Final acceptance still
requires all active consumers and the complete compatible pair to pass.

Evidence is `b6-independent-focused.log`, `b6-independent-check-ci.log`,
`partial-prompt-report-1794944755404.json`, `ff6-host2f-binding.json`,
`ff6-host2f-recovery.log` and `ff6-host2f-migrated-fixtures.log` under the
existing local trial directory. Snapshot, import-cleanup, trusted diagnostics,
full CI, activation and the remaining connected-trial requirements stay open.

## Published configuration and execution-read checkpoint

Root published native Host `0a52518cd1d5b4b84c04a53b8880212d9220dd8a` to draft
#589 and App `bc0b80b9bb96e488a21540a3eeb5257e8e4061c3` to its retained Apps
review branch. Both were independently frozen with exact Git identity and clean
status; both App SDK resolution paths point to the same exact Host source.
The Host passes 123 tests across six affected suites and `check:ci`.

Host `ead9c36660` captures standalone agent configuration and `d2122a2d32` adds
owning coverage. The stronger production probe confirms stable model and
descriptors after source edits, but prompt preparation still reads changed
`AGENTS.md` bytes. The new owning test changes agent name/configuration rather
than identity text, so it does not close that gap. Root delivered the exact
reproducer through May to the existing Host Task; the metadata review stays open.
Host `0a52518cd1` adds bounded trusted CLI receipts to the existing execution
read from retained Host tool-result evidence. Consumer migration and substantive
projection coverage remain required; source existence alone is not final proof.

App `bc0b80b9bb` migrates the four review/comparison entry points. Against the
exact clean Host above, four affected suites pass 62 tests and fail eight, all
in Task-outcome review. Six reproduce the preceding baseline; two cancellation
cases now fail before the intended aborted read and need fixture/admission
correction while retaining their cancellation assertions. Native implementation
is already editing that owning test; Root preserved the active checkout.

The superseded `2f6aaaf1` hosted Quality log contains three completed shards:
968 pass/8 fail, 800 pass/15 fail and 722 pass/2 skip/52 fail. The fourth shard
was cancelled unfinished and contains additional failures. These counts do not
establish a complete-suite total. Root supplied the actual failure inventory
through May for canonical export/namespace, manager lifecycle, Task-worker and
CLI/composition fixture migration, preserving meaningful runtime regressions.
No retired public API, weakened Task rule or deleted cancellation regression is
justified by that migration. Current-head full CI remains a final gate.

Evidence under the existing local trial directory: `0a-independent-focused.log`,
`0a-independent-check-ci.log`, `standalone-config-snapshot-1794945146280.json`,
`bc0-host0a-binding.json`, `bc0-host0a-migrated-fixtures.log`, and
`2f-cancelled-quality-summary.json`. Existing native workflows and cumulative
ledgers are preserved. No compatible candidate activation or readiness Telegram
is established by this checkpoint.

The subsequent native App `149e30bf0a303cc8c1c9a65ae3941d28fd74649e` repairs the
selected evaluator fixtures while preserving cancellation and evidence checks.
Root froze it independently against the same exact Host `0a52518cd1`: all 88
tests across five affected suites pass (`149-host0a-migrated-fixtures.log` and
`149-host0a-binding.json`). This supersedes the eight selected failures above;
it does not establish full active-App migration. Root pushed this clean checkpoint
to the same retained review branch. After the actual 16-round boundary, Root
asked May to continue the same App Task with a finite cumulative total of 24,
preserving all prior usage and source. No native workflow was restarted for the
independent checks.

## Public-root identity and bounded receipt follow-up

May independently published native `fc03d87609b2a19fd64b4cd60792c4a7522bc3b7`.
Root's exact clean snapshot passes all 123 affected tests and `check:ci`.
The direct workflow adapter captures existing identity and shared prompt bytes,
with an owning before/after regression. However, the unchanged real public
`run()` → workflow → agent reproducer still observes the edited identity.
`listTargets()` constructs another captured prompt catalog with source/config
only; the direct-only owning test misses this public path. Missing identity or
shared prompt files also produce `undefined`, which permits later live reads.
Both constructors must capture the same complete definition, including explicit
absence, without adding another snapshot mechanism. Root returned this exact
source diagnosis through May and kept the metadata review open.

The exact same Host also reports confirmed cleanup while the controlled import
remains pending, for explicit-module timeout and cancellation. The root-target
fix does not close this separate preparation path. Finite settlement for a
callable that ignores cancellation remains required.

Root exercised the actual new execution reader with fresh SQLite and synthetic
retained JSONL. It projects trusted Host tool receipts for a session and a direct
workflow child and rejects producer facts/mismatched bindings. It omits nested
workflow receipts, silently reduces 65 receipts in one session to 64, and loses
an early receipt beyond the transcript tail without indicating truncation. These
are bounded evidence/consumer gaps to address through the existing read and
lineage, not reasons for a new store or Task lifecycle.

Receipts are `standalone-config-snapshot-1794945510982.json`,
`module-import-cleanup-1794945512043.json`,
`execution-receipts-1794945396290.json`, `fc03-independent-focused.log` and
`fc03-independent-check-ci.log` under the existing local trial directory.
The same Host Task reached its actual 72/72 allowance; Root authorized a finite
creator revision to 80 after its active workflow returns, retaining all usage.
Read-back confirms Host generation twenty retains 72 consumed rounds with a
cumulative total of 80. May revised the independent App Task to generation seven
with a cumulative total of 32 and 16 consumed, superseding Root's requested
24-round batch without resetting prior usage.
The published source remains a partial checkpoint, with no unified activation
or readiness notification established.

## Finite callable settlement and remaining paired-input gap

Native Host `45d339756eec92d763d629b9fe8d7ac26e8fec4b` adds the existing two-second
cleanup grace to shared callable settlement. Independent exact-clean verification
passes 124 tests across six affected suites; a controlled real-catalog probe
confirms timeout and parent cancellation settle before the ignored invocation is
released. Its first type check fails because `Object.hasOwn` does not narrow the
settled union. Native `b9ce2d7dc3f800ae80c95e270b45e87f3115ab7e` corrects that with
a discriminant. Independent exact-clean `check:ci` and all ten callable-contract
tests then pass, including finite uncooperative settlement and cooperative join.
Root published b9 to the existing PR branch. Public-root identity, explicit-module
pending-import reporting, diagnostics coverage and full CI remain open.

Root also published native Apps `f9e6a982a18c57eb601624c324c33f72ec2755f5`.
Its clean pair with exact Host `fc03d87609` passes 112 tests across six affected
suites and the root typecheck. Unlike an installation-linked dependency,
`@may-agent/gym/comparison` also resolves to the exact candidate workspace;
both SDK entrypoints use the same frozen Host. The broader canonical App check
still finds four Scout input/optional-result-ID errors, returned through May.

Local Apps `5a1d5c89e6d9d680187ec8d7c549a43ea3b8c9f3` passes 150 selected tests
but the real recovery scope remains three passes and four workload failures.
A diagnostic-only copy of the unchanged assertions identifies the exact failure:
the App saves `{prompt,data}` as Task input and the Host correctly wraps that
again. The workflow rejects `/data/prompt` and `/data/data` before handoff logic.
Root returned this source correction through May. Keep authoritative saved Task
input/`ctx.reconciliation.input` as raw domain data and let the existing Host
adapter construct one common envelope. Do not add an already-wrapped fallback,
weaken schemas or change waiting/pending expectations to hide this integration
gap. Root withheld this local checkpoint pending that aligned correction.

The Host follow-up also exposed a saved-assignment setup error: creator revision
had selected an Apps Task checkout instead of the retained Host tree. Root traced
the actual `developmentCheckout` consumed by the development workflow; May
corrected the same Task to generation twenty-one, preserving the retained Host
branch, cumulative total 80 and consumed floor 74. No replacement Task, Git reset
or unrelated Task-system change was required. Actual reservation files retain
any later usage. The App Task remains independent at generation seven/total 32.

Evidence under the local trial directory: `45-independent-focused.log`,
`45-independent-check-ci.log` (the type failure),
`callable-finite-settlement-1794945917969.json`,
`b9-independent-callable-confirmed.log`, `b9-independent-check-ci-confirmed.log`,
`f9-fc03-independent-apps.log`, `f9-fc03-resolutions.json`,
`f9-fc03-typecheck.log`, `f9-fc03-design-check.log`,
`5a-fc03-independent-apps.log`, `5a-fc03-recovery.log` and
`5a-fc03-workload-diagnostic.log`. The earlier unconfirmed b9 process-launch logs
ended with their parent and are not passing-check evidence. No unified candidate
activation or readiness notification is established.

## Public snapshot repair verified and reviewed

Root published native Host `185ffeb1ce99d58e1b55b6fca224105465031591` after exact
clean `check:ci` and 44 owning tests passed. The same real public-root snapshot
reproducer that failed at fc03 now passes: the child keeps original model,
identity and descriptors after source edits. One capture helper now serves both
constructors, with explicit empty-text absence. Committed public-entry tests
cover missing identity/shared files; the earlier direct regression proves a
later invocation sees new configuration/text.

Current-head production probes additionally pass all ten discovery/four-direction
checks, all seven exact-name/common-error checks, all eight schema/report checks
and all five real Task-ingress assertions. Stored Task input and reconciliation
input remain raw; only the execution adapter supplies the common envelope. This
confirms the Host boundary and does not excuse the pending App workload mapping.

The reviewer replied and resolved three actual discussions from this evidence:
[metadata](https://github.com/hao1939/may-agent/pull/589#discussion_r4605221467),
[names](https://github.com/hao1939/may-agent/pull/589#discussion_r4605222114) and
[schema](https://github.com/hao1939/may-agent/pull/589#discussion_r4605222626).
Implementation remained with May's native Task/workflow; these are independent
review dispositions, not a claim of autonomous readiness or final acceptance.
Timeout/import, trusted-receipt, full CI and connected-trial obligations remain.

Root also revalidated the installed runtime rather than inferring it from a
source checkout: binary version/source is `0606e2df`, SHA-256 matches its
provenance and SDK link, and live daemon readiness is true. No unified candidate
is active. The paired local trial must retain the Task-revision repair and exact
compatible App source; the historical 590 activation is not current identity.
May was asked to update the same App Task's stale 485 provider only after its
active workflow is quiescent, with both SDK paths bound consistently and all
usage/checkouts retained. Latest-source independent probes expose behavior the
old provider cannot certify.

Evidence under the trial directory: `185-independent-owning.log`,
`185-independent-check-ci.log`, `standalone-config-snapshot-1794946488361.json`,
`standalone-call-surface-1794946615313.json`,
`four-directions-1794946615460.json`, `schema-report-1794946615493.json`,
`task-workflow-envelope-1794946615505.json`,
`185-verified-review-resolutions.json` and `runtime-current-1794946465496.json`.


## Exact model target names published

Root independently reviewed and pushed native Host
`5cdc43973cea4d4bc2b3b42be8589f3422585b2c` to PR #589. The model agents tool
now preserves the supplied target string for the common exact-name validator.
The owning regression calls a whitespace-padded target, observes useful failure,
and then successfully calls the canonical prompt and procedure targets.
All 34 standalone tests and exact-clean `check:ci` pass.

The explicit-module pending-import defect remains reproduced on this exact
commit: timeout and parent abort each return with the import still pending,
body unstarted and `cleanup.confirmed: true`. The execute wrapper builds a
catalog with private default state; passing caller-owned state, as the root
preparation path does, is the narrow correction. This is separate from the
already-repaired finite shared callable settlement. Existing native Task
acceptance covers it; Root returned the evidence through May without editing
implementation source.

May corrected the same App Task to generation nine with the actual immutable
185 provider root. The saved source identity is now correct, but live ignored
SDK links still resolve to historical 485 while another native workflow is
active. Actual quiescent rebinding and read-back remain required before using
that checkout for candidate verification. No unified runtime was activated.

Evidence under the trial directory: `5cdc-independent-standalone.log`,
`5cdc-independent-check-ci.log`, `pair-no-apps-5cdc43973c.json`,
`module-import-cleanup-1794947018362.json` and
`next-source-obligations-receipt.json`. Earlier snapshot and App evidence retain
their exact original revisions; this checkpoint does not certify full CI or
complete App migration.


## Import cleanup repair and paired App mapping

Root independently verified and published native Host
`ffbd59ecbc611a4ad71b5ee54dc0acc60ae51071`. The explicit-module preparation
wrapper shares the invocation's pending-import counter while preserving its
separately built catalog. This retains snapshot merging and avoids inventing a
second cancellation mechanism. The owning assertion again requires unconfirmed
cleanup. All 44 standalone/callable tests and exact-clean `check:ci` pass.
The original controlled probe now returns `WorkflowUnconfirmedCleanupError`
and `cleanup.confirmed: false` for timeout and parent abort while the native
import remains pending and the workflow body never starts.

The reviewer resolved the distinct
[shared callable settlement](https://github.com/hao1939/may-agent/pull/589#discussion_r4605327155)
and [explicit import reporting](https://github.com/hao1939/may-agent/pull/589#discussion_r4605373975)
discussions from their owning tests and independent production probes. Existing
review resolutions do not replace full CI or final acceptance.

App `725507615871181181f28ad5a7fb0cef0ce8d53c` repairs the duplicate saved
Task-input envelope and is published on its retained backup branch. Independent
verification pairs it with immutable Host `185ffeb1ce`: 66 tests pass and four
real workload owner-handoff cases fail. An unchanged-assertion diagnostic shows
`helperCalls: 0` and a blocked workflow reason before the invalid waiting
settlement. The stale manager fixture exposes only `callAgent` and a legacy
finish wrapper, bypassing the canonical captured definitions required by the
new route. This is further fixture migration, not evidence to relax exact
Conditions or rewrite a failure as waiting. All four restart/during-review/
withdrawn/cancelled-target cases remain required.

May rebound both ignored SDK paths at a terminal native-workflow boundary and
recorded actual Bun resolution to immutable 185. Root read that receipt back.
The claimed private Gym workspace receipt only checks SDK resolution from its
working directory; the package link still resolves to `/app/projects/gym`.
Root's separate immutable pair resolves the actual candidate Gym package and
leaves native work untouched. May must finish actual binding/verification at a
safe boundary before certifying that provider setup.

Exact 725/185 `check:may-design` passes integrity/examples and fails the four
known Scout optional-ID/input errors. Host execution-read probes still fail
nested workflow receipt traversal, 65-to-64 receipt truncation visibility and
message-tail omission visibility; actual receipt/trust/direct-child checks pass.
Those source/consumer repairs, meaningful full CI and the paired local trial
remain open. No unified runtime is activated.

Evidence under the trial directory: `ffbd-independent-owning.log`,
`ffbd-independent-check-ci.log`, `module-import-cleanup-1794947285812.json`,
`5cdc-timeout-review-resolution.json`, `ffbd-import-review-resolution.json`,
`pair-7255076158-185ffeb1ce.json`, `725-185-independent-workload-recovery.log`,
`725-185-workload-cause-diagnostic.log`, `725-185-design-check.log`,
`paired-frozen-host-sdk-binding-1794947175354.json` and
`execution-receipts-1794947207795.json`. The pinned full Host run is still in
progress at this checkpoint; it is not included in the passing-test claim.


## Nested receipt coverage and remaining read bound

Root independently verified and published native Host
`5d8a8f31acc597f27178d4a53ca06d1f910e3806`. All 67 owning execution-read,
JSONL and CLI tests pass, as does exact-clean `check:ci`. All six independent
production receipt probes pass, including nested workflow sessions, the 65th
CLI receipt sentinel and message-tail omission. The coverage-aware reader keeps
the existing array API for other consumers. Host-authored receipts remain
separate from common contributor output and producer-authored facts.

One source defect remains in the new recursive query: the final session limit
does not bound workflow-tree expansion. A large tree with no sessions still
expands all descendants. The
[current review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5946224422)
asks May to bound expanded workflow nodes and expose omitted subtree coverage,
using existing bounded lineage queries or an expansion sentinel. This checkpoint
is shared for parallel review, with the gap explicit; it is not ready to activate.

Read-only production catalog construction from immutable App 725/Host 185 lists
all 33 configured targets. Real canonical calls to `alex/pull-request-wait` and
`may/revise-assignment` fail before execution because their legacy required
top-level fields conflict with the common full envelope. Several registered May
and Scout bodies also still consume top-level input without an envelope adapter.
These are concrete App migration defects despite successful discovery.

The workload fixture root cause is now isolated further. Root copied the native
in-progress fixture into the independent 725/185 pair and added only the missing
`appLocal: true` declaration to its scripted helper definition. All four original
owner-handoff modes pass, with 58 assertions, helper invocation and exact
`requestId` Conditions preserved. The transient copy was removed; Root changed
no native implementation. May received the result to apply and verify through
the existing contribution workflow. Project identity alone does not select an
App-local definition; this is namespace metadata, not invocation permission.

The pinned full ffbd local run remains failed and incomplete. Three shards
finished with 790 pass/8 skip/17 fail, 721 pass/4 skip/51 fail and 970 pass/9 fail.
Shard one stayed CPU-active with no new output and was stopped after ten minutes;
it required SIGKILL after forwarded SIGTERM did not settle. The log contains 92
unique failure titles including the unfinished shard, not an overall total of
77 failures. The live temporary path and stale nested helper calls in
`graceful-finish.test.ts` identify a fixture migration lead; preserve meaningful
cancellation coverage and bound scripted corrective turns. Browser execution was
explicitly disabled for this local run. Complete hosted CI remains required.

Evidence under the trial directory: `5d8-independent-receipts.log`,
`5d8-independent-check-ci.log`, `execution-receipts-1794947860409.json`,
`5d8-bounded-traversal-review.json`, `configured-catalog-1794947552025.json`,
`configured-legacy-schema-1794947624505.json`,
`725-app-local-fixture-probe-input.json`,
`725-185-app-local-fixture-diagnostic.log`, `ffbd-independent-broad.log`,
`ffbd-broad-progress-summary.json` and `ffbd-broad-cancellation.json`.

## Prompt admission and App envelope checkpoint

Root independently verified and published native Host
`0e6806c95b63b3ba4e19c6b7bd0154593e6a743a`. All 36 standalone tests and
exact-clean `check:ci` pass. The added regressions prepare and execute the real
prompt runner: a blocked finish without unavailable output returns its common
result in one turn, while a done finish missing schema-required output is
rejected. This closes the missing positive prompt regression identified in the
previous checkpoint. It does not establish full Host CI.

App `56e58c00f0645992fc0bf9f2383253ed734aa29d` applies the proven namespace
fixture correction. Independent owning tests against immutable Host 185 total
101 pass and three failures. All four original owner-handoff cases now pass;
the failures remain in standalone-stage diagnosis, blocked-result retention
and cancellation evidence. The design check still reports the same four Scout
typing errors. No Condition semantics were weakened to repair the fixtures.

App `bda965c421cf15c46bf3ce610ac6129ec594696e` follows with full-envelope
schemas and body adapters for pull-request-wait and revise-assignment. All six
owning tests pass. Production canonical calls enter both registered bodies;
the standalone environment then reports absent read/revision capabilities.
Both commits are published on the retained App review branch. Remaining bodies,
callers and trusted receipt consumers still require migration and broad checks.

The recursive workflow read expansion bound remains under review. Existing
native workflows continue on their retained Tasks; Root has not revised their
requirements during execution or changed their implementation source. No
unified candidate is activated, and the connected trial and Telegram readiness
link remain unproved.

Evidence under the trial directory: `0e6-independent-standalone.log`,
`0e6-independent-check-ci.log`, `56e-185-independent-owning.log`,
`56e-185-design-check.log`, `bda-185-independent-owning.log` and
`configured-legacy-schema-1794948446858.json`.

## Bounded traversal and May workflow adapters

Native Host `a0b1e625f7328c007d3db325f58d0f1eac459459` bounds the recursive
workflow CTE with a 65th-row sentinel, selects at most 64 workflow IDs and
reports `diagnostics.omitted.workflows` before bounded session enumeration.
Root independently ran 22 execution-read tests plus 46 JSONL/CLI tests;
exact-clean `check:ci` passes. Eight production-reader probes pass, adding
1,000 sessionless wide descendants and a 1,000-node chain to the original six
receipt/provenance/omission probes. The traversal review discussion is resolved
from this evidence and the exact checkpoint is published on PR #589.

Native App `a41a21e976c9191b9a315dccb97d833170eb38d0` migrates the four May
workflow execute adapters to unwrap `input.data`. All 44 May workflow tests and
the repository's `typecheck` command pass independently against immutable Host
185. The design check reveals three new private-helper context type errors in
addition to the four known Scout errors. Spreading an envelope-typed context
into a domain-typed helper changes `input` but leaves its generic reconciliation
type incompatible. The correction must preserve the independent raw Task input;
it must not wrap or replace `ctx.reconciliation.input` to satisfy the helper.
Root returned these exact errors to May for the existing contribution workflow.

The default App test command fails its first affected eight-file chunk with
120 pass and three standalone-stage failures; later chunks are not executed.
Source review identifies an actual consumer migration: standalone-stage still
reads the retired public `run` wrapper's `report`, `ok` and `result.type` fields.
Migrate its diagnostics/evidence consumption and retain cleanup/cancellation
assertions rather than only changing fixture expectations.

App a41 is published on its retained branch. At true 32/32 exhaustion and a
terminal workflow boundary, May revised the same App Task once to cumulative
limit 48, retaining all 32 consumed rounds, exact source/provider and evidence.
The Host Task remains on its existing generation and allowance. Source fixture
migration and the paired trial remain open; no unified runtime is activated.

Evidence under the trial directory: `a0b-independent-receipts.log`,
`a0b-independent-check-ci.log`, `execution-receipts-1794948550844.json`,
`a0b-traversal-review-resolution.json`, `a41-185-independent-may-workflows.log`,
`a41-185-independent-typecheck.log`, `a41-185-independent-design.log`,
`a41-185-independent-full-test.log`,
`checkpoint-app-finite-continuation-receipt.json` and
`a41-type-and-stage-review-receipt.json`.

## Actual Task admission and review observation

Native App `bf6f92e9a0a420bfc61ad16752188ab75264f7e8` repairs the seven
canonical App type errors. Root independently ran all 197 selected May/Scout
tests successfully against immutable Host 185. The design command passes
integrity, examples and canonical App typing, then reports two model-surface
errors: Alex's prompt exceeds its budget and May's verification skill is omitted.
The exact checkpoint is published on the retained App review branch.

A separate production admission probe exposes a remaining defect in bf6's new
scout-assess-source schema. Root obtains the raw input from its actual exported
App Task attachment and invokes the real Host a0b Task workflow runner using
the exact exported schema, substituting only a marker-writing body. The adapter
correctly supplies `{ prompt, data: { kind: "assess-source", data: domain } }`.
The schema instead requires the domain fields directly under outer `data`, so
execution is rejected before the body runs. Direct execute tests do not cover
this boundary. May received the reproducer and is repairing the declared shape,
body and tests on the same Task; no Host App-specific routing change is needed.

Root also posted the SDK raw-reconciliation type mismatch as an actual
[GitHub review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5946468448).
Native observer event 6740369 includes that exact review ID, commit and body
digest after publication. Root did not directly wake the Host Task for this new
review. This establishes native observation, not repair or final readiness.
Full Host/App checks, remaining consumers, compatible activation and the
connected trial with Telegram review-link delivery remain open.

Evidence under the trial directory: `bf6-185-independent-owning.log`,
`bf6-185-independent-design.log`, `scout-root-admission-1794949065168.json`,
`scout-root-admission-bf6-probe.ts`, `scout-root-admission-review-receipt.json`,
`a0b-raw-context-type-review.json` and
`native-raw-context-review-observation.json`.


## Verified Task admission and independent input typing

Native App `0bee25cb2365b7f2d65e0122234c16404a551a72` repairs Scout's actual
Task-root admission. Its exported attachment retains raw `{ kind, data }` domain
input. Its full-envelope schema validates that exact object under outer `data`,
and its registered body unwraps the domain payload. Root's independent real Host
f607 runner probe, using the actual attachment and exported schema with a marker
body, reaches execution. Both affected suites pass all 46 tests. A committed test
labelled Host call envelope invokes `execute(ctx)` directly; the separate probe,
rather than that test label, establishes production adapter coverage.

Native Host `bb8958cbf933a356aa002f8a84aee5bb9b67c463` implements the
[observed GitHub type review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5946468448).
Callable input and raw reconciliation input now have independent generic types,
including the SDK test helper. The positive/negative type regression and exact
`check:ci` pass. SDK kernel/export tests report 26 passes and one export-snapshot
failure; that failure remains an explicit checkpoint gap. Both source checkpoints
are published for review.

An exact separate App0bee/Hostbb895 pair passes App typechecking and 67 targeted
Task-disposition, Scout-assessment and recovery-contract tests. Design integrity,
checked examples and canonical App typing pass. The model-surface step reports
Alex's prompt length as 36,110 against its 36,000 budget at that snapshot location.
At the longer earlier location it reports 36,362 and omits May's verification
skill. Root archives the exact unchanged App0bee source to a shorter physical
root, retaining the immutable Host185 provider: model-surface checking passes
with zero errors across the same ten agents. Absolute skill paths contribute to
the budget. This is a path-dependent limitation, not evidence for changing the
unified call contract or claiming final configured-location readiness.

The real Task-worker probe still rejects duplicate `sample/probe`. Root's
fixture-only diagnostic first registers the probe solely for the selected agent
and unwraps `ctx.input.data.wait`; the duplicate failure persists. Source tracing
finds root procedures seeded under bare `owner` while prompt definitions use
`sample/owner`, causing the same files to be imported and registered a second
time. May is repairing canonical owner seeding and typed routes on the retained
Task. No source-path deduplication should hide distinct conflicting targets.

Development/Gym receipt consumers and standalone-stage migration are in progress.
Full Host/App tests, current-head CI and configured-target execution inventory
remain open. No unified candidate is activated; connected trial and Telegram
review-link delivery remain unproved. Root has not revised or rebound either
live implementation workflow.

Evidence under the trial directory: `scout-root-admission-1794949411973.json`,
`0bee-185-independent-owning.log`, `bb895-independent-check-ci.log`,
`bb895-independent-sdk.log`, `f607-independent-real-worker.log`,
`f607-worker-envelope-diagnostic.log`, `0bee-short-root-model-check.json`,
`0bee-short-root-model-check.log`, and
`0bee-checkpoint-and-path-budget-receipt.json`. The separate pair's
`0bee-bb895-independent-typecheck.log`, `0bee-bb895-independent-owning.log`
and `0bee-bb895-independent-design.log` are under the unified-589 pair directory.


## Canonical worker boundary and configured App checks

Native Host `63fda1a435e124526f334e67612a6fd14b3359b4` repairs root procedure
seeding under the captured canonical owner and keeps code routes as structured
owner/name pairs. Captured Task-agent dispatch resolves the retained definition
rather than silently falling back to an unavailable bare registry key. The real
worker fixture registers its probe only for the selected handler and consumes
its domain input through the mandatory envelope. Distinct canonical conflicts
still reject. Both SDK declaration snapshots are updated to the reviewed surface.
Root independently verifies all 48 owning tests, all 35 real worker/process tests
and exact `check:ci`; the checkpoint is published on PR #589.

Native App `90303dd0d1400f6338bba48fe8023f9b02de7865` retains Host-authored
execution diagnostics in development reports and migrates standalone-stage/Gym
to the existing diagnostic runner. Independent checks pass 92 consumer tests,
App typechecking and full design validation at the shorter physical snapshot.
Root then exercises actual standalone-stage with the committed App configuration
and no agent fixture. The hardcoded empty model registry fails before any model
request with unknown model. May repairs live registry construction at published
`2c5ddf57336f9e66b530514c01752df6d05bc66c`; 93 consumer tests pass.

A separate exact App2c5/Host63f pair passes App typechecking and full design
validation. Root supplies only the installation's existing ignored App-disable
markers as initial isolated configuration: `aks-rp-e2e` and `sample` remain
disabled, and no native source/provider/configuration changes. The default App
command passes **1,143 tests across 81 files**. Its earlier unconfigured App903
diagnostic reached all 85 default files: nine chunks passed, one chunk had
40 passes and one failure because the installed-App assertion expects three
Apps but sees five without those markers. The final five-file chunk passes.
The original uninstrumented App903 command exited without a failure summary;
the later diagnostic must not be described as that original run's output.

The independent private Gym check genuinely runs from its package directory and
finds twelve type errors at App2c5: eleven retired `RunResult.report` reads in
`src/cli.ts` and obsolete `cwd` in the direct workflow adapter. A preliminary
`bun --cwd projects/gym run check` invocation only printed help and returned zero;
that invocation is explicitly excluded from passing-check claims. May is migrating
the remaining real consumers. No universal result wrapper is restored.

Root also obtains authoritative completed hosted results for Host bb895: four
JUnit shards contain 3,502 tests, 107 failures and two skips. The file map comes
from JUnit, replacing the earlier unreliable interleaved-log grouping. These are
bb895 results, not current63f failure counts; the 35 worker and SDK snapshot
passes supersede their earlier failures. Container passes at current63f; its
Quality check remains open at this checkpoint.

Root posts a new actual GitHub [steering coverage review](https://github.com/hao1939/may-agent/pull/589#pullrequestreview-5946872526)
on63f. The migrated case never calls `steer` and asserts ordinary completion with
"should not reach here". Restore a real trigger/interruption assertion or remove
that misleading duplicate while preserving the following real steering tests.
This review is not yet resolved. Actual CLI SIGINT child-drain coverage, full
Host CI, remaining consumer migration and the connected local trial remain open.
No unified candidate is activated; Telegram review-link delivery is unproved.

Evidence under the trial directory: `63f-independent-owning.log`,
`63f-independent-workers.log`, `63f-independent-check-ci.log`,
`bb895-hosted-quality.log`, `bb895-hosted-test-results.zip`,
`bb895-hosted-failure-file-map.json`, `903-standalone-stage-live-models.json`,
`903-default-chunks-diagnostic.log`, `903-remaining-default-chunks.log`,
`2c5-63f-installed-config.json`, `2c5-63f-independent-consumers.log`,
`2c5-63f-independent-checks.log`, `2c5-63f-independent-full-app-test.log`,
`2c5-63f-independent-gym-check.log` and `63f-steering-review.json`.


## Remaining CLI callers and current Host CI

Native App `92003fbb90fc7a606d9dea074f6063e5b30f313b` repairs the private Gym
CLI's eleven obsolete report reads and removes the invalid adapter option. It is
published on the retained App review branch. Independent package typechecking
passes. The first complete private check reports 391 passes and twelve failures
because its existing evaluation plans reference two ignored installation evidence
files absent from a clean source snapshot. Root supplies exact existing read-only
copies, recording their hashes and sizes. The full command then passes all
403 Bun tests, subsequent node tests, case/scenario validation and all 1,488
benchmark-review checks. No plan, truth, source or native provider was changed.
This is explicitly configured verification, not a portable-clean-checkout claim.

Two actual callers still fail despite passing those checks. `gym diagnose`
selects `agentName`/`workflowName` without `target`; public `run` rejects the empty
canonical address before loading the baseline. The native backend adapter calls
`run("codex", rawString, options)`, although the backend is not a registered
callable and string input is retired. A real SDK probe returns pre-start error
with no ID or trace report; the adapter's unconditional trace read cannot repair
that invalid invocation. May received both reproductions. Supply the actual
canonical diagnosis target and use the existing native CLI capability or an
explicitly registered contribution for backend execution; do not restore implicit
pseudo targets or bare aliases. Their entrypoint coverage remains required.

Host63f's completed hosted run now supplies the current failure baseline:
**3,503 tests, 84 failures across 25 files and two skips**. Container passes.
The 107-failure bb895 result is superseded. The native handler initially counted
one shard's 23 failures; Root's complete artifact map corrected that count.
Repair the actual current mapped source/fixture backlog; passing `check:ci` or
reusing the narrower 143-test receipt cannot close that new input.

Persisted native observer event6740634 contains Root's steering review5946872526
and the exact63f head. The subsequent Host handler references its actual inline
comment4605993437 and requests repair through `develop-change`, then obtains a
read-only diagnosis after that workflow returns the unchanged narrow candidate.
A later pass uses the full test command as verification. This demonstrates
observation and follow-up initiation, not completed repair or final readiness.
Root did not directly wake Host for the new review; its later direct message
supplies the complete current CI artifact count.

Exact current source and evidence remain retained. No unified runtime is
activated; configured pair activation, late-comment repair and Telegram
review-link delivery remain open.

Evidence under the trial directory: `920-63f-independent-gym-check.log`,
`920-gym-existing-plan-evidence.json`,
`920-63f-independent-gym-with-plan-evidence.log`,
`920-gym-diagnose-real-cli.log`, `920-gym-cli-call-shape.json`,
`920-real-cli-review-receipt.json`, `920-configured-gym-check-receipt.json`,
`63f-hosted-failures.json`, `63f-hosted-failure-file-map.json`,
`63f-hosted-quality.log`, `current-63f-ci-total-receipt.json` and
`native-steering-review-observation.json`.

## Current assignment and published CLI repairs

Root independently reviewed and published native Host
`6b50f08842fe7447af133b1f37765b7f6c085060` to draft #589 and App
`63ec3f10d218a28a6ae3698da547b605e607fa73` to the retained App backup branch.
Host migrates nested workflow names, envelopes and missing-target handling;
all fourteen owning tests and `check:ci` pass. App supplies Gym's canonical
diagnosis target and replaces its implicit CLI pseudo-target with the existing
`runCliAgent` capability. All nine adapter tests, App typechecking and full
design checks pass. These exact new snapshots use source-default App selection;
they do not inherit the earlier isolated installation configuration/evidence.
An actual `gym diagnose` invocation now reaches the workflow's missing-baseline
manifest error instead of failing empty-target resolution. A separate probe runs
both native backend adapters through the real SDK primitive and real child
processes, supplying deterministic local Codex/Claude protocol executables.
Both return their native session, parsed Task result, durable raw receipts and
confirmed cleanup. This covers the adapter/protocol boundary without an injected
`runCli` stub; it does not exercise external models.
The last complete hosted baseline remains Host63f's 84 failures; the newer
native broad run is red and its truncated single-shard count is not a full total.

A production `develop-change.execute()` probe at App920 exposes a different
consumer gap. With the same Task, generation, candidate, verification and empty
Task events, the first invocation makes three helper calls. Changing only the
mandatory invocation prompt makes zero additional calls and returns the earlier
converged result. Neither assignment reaches any helper. The procedure reads
Task requirements but drops the current invocation prompt; its retained approval
key covers events alone. This is diagnostic evidence, not a shipped regression.

The owning contribution contract now clarifies that helpers receive the current
assignment alongside durable Task requirements, and a changed assignment needs
fresh judgment through the existing input-change path. Task scope remains
authoritative; no new lifecycle or Host domain judgment is introduced. May
received the minimal repair and two-invocation regression requirement in
event6740829. Identical assignments should retain quiet replay, valid evidence
and all actual consumed allowance.

Both native development batches reached their finite limits: Host96/96 and
Apps48/48. May's creator chose stop-and-disposition, preserving unfinished
candidates. Under the user's continuing unified-interface implementation and
prompt-publication instruction, Root requested another bounded creator decision
on the same Tasks (112 Host and64 App total), preserving all usage, bindings and
evidence. Event6740990 records delivery of that request, not saved revision or
new implementation. No unified candidate is activated or ready for notification.

May subsequently saved the requested revisions through its existing workflow:
Host generation25/total112 and Apps generation11/total64. Root's Task read-back
confirms both retained checkouts, identities and acceptance. The Host ledger
then contains97 actual reservations and Apps48, retaining all prior usage.
Native development has resumed; this establishes continuation, not completion.

A follow-up probe matches the real Gym CLI's directory layout rather than the
earlier in-repository protocol fixture. The CLI creates its work directory under
`tmpdir()` but supplies the repository as `projectRoot`. The capability rejects
the external `cwd` before spawning a process. App63ec therefore still fails the
actual native scenario route despite its passing protocol probe. May received
the reproduction and minimal isolated-workspace binding correction in
event6741015; no global path-check relaxation is needed.

Evidence under the trial directory: `6b-63ec-independent-host-owning.log`,
`6b-63ec-independent-host-check-ci.log`,
`6b-63ec-independent-app-owning.log`, `6b-63ec-independent-app-checks.log`,
`920-current-assignment-observation.json`,
`920-current-assignment-observation.test.ts`,
`current-assignment-review-receipt.json` and
`current-finite-continuation-receipt.json`, plus
`63ec-gym-diagnose-real-cli.log`, `63ec-native-protocol-probe.ts`,
`63ec-native-protocol-observation.json` and `63ec-assignment-root-docs-check.log`.
Continuation read-backs are `finite-continuation-8b86f804-readback.json` and
`finite-continuation-5cb8bf19-readback.json`; the caller-layout reproduction is
`63ec-native-real-cwd-probe.ts` / `63ec-native-real-cwd-observation.json`.
