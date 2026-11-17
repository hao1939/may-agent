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
