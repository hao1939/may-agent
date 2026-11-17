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
| 2 | Coordinators repeatedly retain answered setup/escalation inputs as waits; revising work has been treated as answering its callers. | Exact scoped return delivered to its saved caller while broader work and unrelated Scout obligations remain retained. A blocker on one input must not become an invented prerequisite for another. |
| 3 | The unified callable change remains partial and needed manual repair directions. | Coherent Host/SDK/App candidate, owning tests and all four invocation directions through production adapters. |
| 4 | A watcher saw real CI/comment changes, but readiness notification and subsequent repair are unproved. | Current-head green CI, provider-backed Telegram link, then a late review comment causing the same Task/workflow to repair and reverify. Preserve ordinary Condition demand throughout this trial. |
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
