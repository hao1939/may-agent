# Unified agent and workflow calls

**Design status:** Accepted and promoted to the [owning contract](../2a-design/execution-contributions.md).
**Implementation status:** Implemented and independently verified in source and
an authorized local trial. Host `d7fe07f80e` is merged as `e489ff32b6` in
[#589](https://github.com/hao1939/may-agent/pull/589); Quality and Container pass
on that exact head (3,494 tests, zero failures, two skips). The paired App review
branch is pushed at `8fb96e4819` and integrated into canonical source `90cc281b65`.
The human merged the PR; broader release is separate. Five late review findings
and a separately demonstrated schema-forwarding gap are assigned to May below.

The independently verified local pair was Host/SDK `4a9e0f9300` and App `90cc281b65`. The App source
preserves the reviewed unified migration, Scout current-input repair, newer audit
and planner fixes, and canonical knowledge publications. Its App/shared/Gym source
closures are identical to the independently reviewed `8fb96e4819` candidate.
That exact candidate passes 1,149 configured App tests across 81 files with
17,274 expectations, type/design checks and the current-input production probe.
The supported reload and independent binary/App/readiness read-back matched that pair.
Normal canonical reloads now retain the migration in source; the post-trial
reload gap is repaired.

The separate owner has since activated merged Host/SDK `e489ff32b6` and App
`ab3936b71b`, including continuous observations and concurrency6. Current readiness
is true. The matching-source baseline passes type/current-input checks; its App
scan stops at the older concurrency3 assertion. A model-surface warning in a long
temporary snapshot is path-budget dependent; the actual working check passes.
These observations stay distinct from final follow-up candidate verification.

The implemented contract provides one canonical catalog, mandatory
`{prompt,data?}`, common validated results and awaited calls. Invocation
permissions and public fork/session actions are removed. Independent production
probes cover all four call directions, immutable snapshots, bounded cancellation
and Task ingress. Canonical model calls require `finish()` with one bounded
correction for a missing report. Ordinary nested failures return error reports
with real child IDs; supervision/control errors retain their existing unwinding.

The local trial found and repaired two gaps that source inventory alone missed:
Task workers filtered profiles by caller App, and Scout's body ignored the current
assignment. New actual-worker tests invoke cross-App workflow and prompt targets;
36 owning/control tests and static checks pass independently. Live May and Scout
Task roots in the earlier trial expose the same sorted32-target catalog. A cross-App prompt helper
returns its real ID while retaining the caller's Task. The corrected original
Scout Task publishes prepared arXiv2611.19700v1 through the protected workflow at
`3cdda11f96`, with exact draft/hash, INDEX and digest read-back. Reentry inspects
that effect and avoids publishing it again.

A fresh May attempt on App `90cc281b65` lists the same 32 canonical targets and
successfully awaits both `alex/runtime-pattern-audit` and `alex/bob` through
`agents`. Actual child records retain May's caller Task and return the common
result envelope; the prompt helper returns the requested schema-checked nonce.
The original finding hash and single INDEX entry remain intact. This check adds
no source edits, domain actions or repeated protected publication.

Native GitHub observer event6742108 records the late review and successful checks
on Hostd7fe. May's existing Conversation route delivers one GitHub review-link
notice as Telegram message50734. The notification follows an explicit source-
delivery input on the retained May Task; this is evidence of the connected path,
not a claim that the original mixed Scout assignment specified every delivery
obligation automatically. Human approval stays on GitHub.

The remaining handoff is:

1. Complete verification and CI for the six post-merge fixes in draft
   [#594](https://github.com/hao1939/may-agent/pull/594), then trial the compatible
   local candidate. Retain the successful source/receipt identities.
2. The user owns the separate Task/ingress/event and periodic-work changes. The
   earlier source-only App241c trial retained six baseline periodic-event failures.
   The metric recurrence failure revealed a real missing producer: this Host pair
   has metric subscribers while canonical ae40 removed May's schedules. The final
   scoped candidate includes f85's fixture migration, which does not prove a
   replacement cadence runs. Its generation13 acceptance explicitly leaves that
   functionality to the separate owner. Merged/installed main now includes the
   user's #593 direct metric producer. Follow-up activation must preserve it and
   record actual integration evidence. A green
   configured suite alone is not cadence proof.

Exact revisions, source reviews, failed trials, scoped check totals and provider
receipts are in the [source review](../archive/reviews/agent-workflow-interface-source-review-20261117.md).
May implements through retained Tasks/workflows; Root owns design, independent
review/verification and publication assistance. The final cumulative ledgers
remain128/128 Host and64/64 App reservations, without reset, refund or automatic
renewal. Earlier retained allowances include conservative reservations rather
than an equal number of proved coding executions. The final development workflow
ended at its execution bound; its partial evidence remains unchanged. Root supplied
actual independent source review, and the scoped App Task accepted that reviewed
source contribution without fabricating a native review pass or another round.

## Post-merge follow-up

The human merged #589 and explicitly authorized continued refinements. A late
automated review identified these remaining implementation defects; the accepted
interface contract stays the same.

| Finding | Required behavior and regression |
| --- | --- |
| Workflow owner confused with caller App | Alpha and Beta may both declare `worker`. A Beta workflow uses Beta's captured owner to prepare definitions while retaining Alpha caller lineage. Exact Alpha addresses execute Alpha code. |
| Task root resolved by ambiguous bare agent name | Resolve each Task executor in its owning App namespace before availability, instructions and dispatch. Both Apps' `worker` Tasks run; child discovery remains complete. |
| Readonly helper loses inherited tool policy | Preserve the workflow's internal tool restrictions in hosted prompt helpers, including an unrestricted or absent parent. Inspect actual effective helper tools. No public invocation permission option returns. |
| Shared JSON references treated as cycles | Reusing an acyclic object in input, output or facts succeeds; actual cycles still fail. Root's production input/result probe reproduces both false rejections. |
| Managed settlement rejects an output-free blocker | A schema-backed prompt helper can return `blocked` without output. Successful completion still requires schema-valid output; supplied output validates across statuses. |
| Model tool drops the requested output schema | Bind the existing caller schema to the prompt helper's finish validation/correction. Identical invalid-then-valid replies must correct within the same child through both model and workflow adapters; parallel calls keep independent schemas. |

May owns one new finite post-merge outcome,
`may/goal/app_c3b29e84-3807-4fb0-8ce5-7bad04a05c70`, with an Alex source
contribution limited to 12 rounds, now retained as
`alex/input/appdep_973835fb69362841b2e57ccd`. The earlier Scout-owned coordination Task
remains fulfilled; its creator boundary is preserved. Original Host128/128 and
App64/64 usage remain historical, without reset or replacement. This new work
has a new source checkout/PR based on merged main `e489ff32b6`, preserving #590
and the user's merged observation/heartbeat/periodic changes. Root reviews the
design and source, independently verifies the candidate, and helps publish it.
The first attempted App-only revision of the Scout-owned Task was correctly
rejected; the ordinary new-goal route admits this separate outcome.

Exact findings and reproduction are retained as
`postmerge-review-589-findings.json` and
`postmerge-shared-reference-reproduction.json` in the trial directory. Root also
reproduces actual wrong-code dispatch, inherited write-tool exposure and managed
blocker failure. The first checkpoint is [draft #594](https://github.com/hao1939/may-agent/pull/594).
Its subsequent commits repair the captured-owner/global-caller edge and remove
the foreign bare-Task fallback, with actual tool/Task/result coverage. Fix the
two namespace defects first, then inherited tools and report/JSON admission.
The sixth schema-forwarding finding is independently proved by identical
scripted invalid-then-valid replies: merged code fails after one model reply while
the workflow call corrects and finishes after two. May's generation3 revision
preserves the same Alex contribution, actual usage and total12 limit. Its
`06629fae7a` checkpoint forwards the existing schema through an invocation-local
binding. Root's independent production probe now gets `done` and valid output
after two replies through both adapters; 31 owning tests pass across three files.
Earlier exact-head probes also pass for the original five findings. These scoped
checks do not establish full readiness: the preceding hosted head's Quality check
fails on 13 Task namespace fixtures, and fixture migration, independent final
review, current-head CI and compatible local activation remain open. Container
passed on that preceding head. Keep genuine App-local definitions in migrated
fixtures; a canonical map key alone does not make a global profile App-local.
Local verification before merge remains authorized; broad release and GitHub
merge remain human-owned. Task/ingress/event implementation remains outside this scope.

**Supports:** [Agent and workflow contributions](../2a-design/execution-contributions.md).
Let a caller assign bounded work and consume its result through the same contract,
whether the implementation uses a model or TypeScript.
**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first)
and [robust enough for the goal](../1-principles/design-philosophy.md#robust-enough-for-the-goal).
Remove invocation permissions and public background-helper management. Use ordinary
awaited calls, bounded cancellation and affordable redo with retained evidence.

## Accepted behavior

An agent can call an agent or workflow; a workflow can call an agent or workflow.
The caller discovers a named contribution, supplies its assignment, and receives
one result. It does not choose an executor kind or manage a child session.

| Concern | Decision |
| --- | --- |
| Invocation | Keep model `agents` and SDK `ctx.call`; share their resolution and execution contract. |
| Permissions | Every registered callable is discoverable and callable. Remove invocation ACLs and delegation profiles. |
| Input | Require `{ prompt, data? }` for every target. |
| Result | Require the same status/summary envelope and output validation for every target. |
| Discovery | Use one catalog with exact `<appId>/<name>` or `global/<name>` addresses. Reject duplicates. |
| Concurrency | Keep awaited calls and workflow joins. Remove public `fork` and its session-management surface. |

The contribution contract owns the enduring [input/discovery](../2a-design/execution-contributions.md#invocation-and-ownership)
and [result](../2a-design/execution-contributions.md#result-admission) rules.
This proposal records their implemented interface cutover. The examples below
match the locally verified candidate SDK.

## Ordinary use

Both adapters invoke the same target with the same input:

```ts
const input = {
  prompt: "Review this change against the requested behavior",
  data: { changeRef: "HEAD", acceptance: ["Empty input returns null"] },
};

// Model tool:
agents({ action: "call", agent: "alex/review-change", input });

// Workflow SDK:
const review = await ctx.call("alex/review-change", input);
```

The runtime resolves the exact target, validates input, executes a bounded child,
validates its report, and returns it. The model adapter prepares prompt execution;
the code adapter invokes the module. Neither creates an independently owned Task.

A successful review can return `status: "done"` with a negative verdict in
`output`. The caller decides what that verdict means for its assignment. A report
such as `status: "blocked", summary: "Patch written; test environment unavailable"`
retains useful output without claiming the assignment is finished. Host checks
execution and report validity; agents/App policy judge domain fulfillment.

## Input and call options

```ts
type ExecutionInput<T = unknown> = {
  prompt: string;
  data?: T;
};

type CallOptions = {
  timeoutMs?: number;
  schema?: TSchema; // Optional caller requirement for result.output.
};
```

`prompt` is mandatory and must contain non-whitespace assignment text. `data`
holds optional JSON-compatible domain parameters, references, acceptance criteria
or prior evidence. A target may require specific data fields. Both implementations
receive the entire envelope: code reads `ctx.input.prompt`/`ctx.input.data`; the
prompt adapter presents both fields to the model as assignment data.

Validate the common envelope and any target input schema against the same value.
A target schema can constrain `data` but cannot weaken the prompt requirement.
Discovery exposes the complete effective schema, including the common envelope.
Executable capabilities, Task coordinates and cancellation remain runtime context.
Author target requirements with one full-envelope `inputSchema`; remove the
temporary `dataSchema` compatibility surface rather than keeping two authoring
contracts after the cutover.

The model call accepts `options` beside `input`; the SDK accepts the same options
as its third argument. A supplied timeout is positive and can only shorten the
enclosing bound. The caller's output schema applies alongside any target schema.
Executor-specific skill selection, model-operation counts and tool configuration
belong to execution setup, outside these common call options.

New calls accept only this envelope. Migrate bare strings and `task` to
`{ prompt }`, and workflow payloads to `{ prompt, data }`. Move separate
`context_files`/`success_criteria` content into the envelope. Reject old or
conflicting authoring fields with useful correction feedback; do not silently
pick a field or drop supplied information.

Task/App ingress remains its own contract. Its execution adapter supplies a
meaningful prompt from the current assignment and preserves domain input in
`data`. Saved historical evidence remains readable without becoming another
supported format for new calls.

## Result and failure semantics

```ts
type ExecutionResult<T = unknown> = {
  id?: string;
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  facts?: unknown;
};
```

Require a nonempty summary. Keep output/facts JSON-compatible and preserve useful
partial evidence. The runtime binds `id` to the actual child execution; the
producer does not choose it or substitute the caller's ID.

| Situation | Caller-visible meaning |
| --- | --- |
| Contribution completed | `done`; the caller assesses the returned work. This does not settle the owning Task. |
| Contributor cannot finish its assignment | `blocked`, with useful output/facts and the remaining gap. |
| Unknown target or invalid input before execution | `error`, with no child ID. The caller can correct and retry. |
| Execution or report validation fails after start | `error`, with the actual execution reference and retained failure evidence. |
| Execution is cancelled | `interrupted` when a terminal report is available; supervisor cancellation may unwind the call directly. |

Both executors use the same report/output checks. Validate any supplied output
before exposing it as matching the target/caller schemas, across every status.
A successful report must include output when an output schema was requested.
An incomplete or failed invocation may omit output it could not produce.
Preserve schema-invalid material as diagnostics rather than valid typed output.
Correctable model finish reports remain correctable within their existing bound;
code failures return through the same caller recovery path.

Prompt execution must submit the required finish report; plain assistant prose
alone is not a successful finish. Code returns the equivalent report through the
SDK. Backend kind, session/workflow aliases, transcripts and output directories
stay in execution diagnostics, outside the common result payload.

Migrate diagnostic consumers as well as result producers. The legacy
`ExecutionResult.cliCalls` field supplied Host-recorded evidence to development
and Gym. The reviewed migration preserves its provenance through execution
diagnostics or the configured diagnostic observer, addressed by the actual execution reference.
Extend that owning read/projection only where a real consumer needs it; do not
retain a second result alias or treat producer-authored `facts` as trusted tool
receipts. Candidate verification must include those consumers.

Existing supervisor stop, capacity deferral and persistence-failure handling keep
their control meaning. They apply equally to either executor and cannot be
converted into a successful contribution. Runtime-generated failure diagnostics
remain distinct from the contributor's domain conclusion in execution evidence.

## Discovery and names

Use one rule for every registered agent or workflow:

1. An App-owned callable is `<appId>/<declaredName>`; a global callable is
   `global/<declaredName>`. Reserve `global` for that namespace. Components are
   nonempty, cannot contain `/`, and resolve exactly and case-sensitively.
2. Agents and workflows share the namespace. Source directory and owning agent
   are metadata, not address components or lookup priority. Duplicate canonical
   names reject catalog preparation/reload. A rejected reload preserves the prior
   valid catalog. No kind can shadow another. Equal declared names in different
   namespaces coexist; loading and registration must preserve them before the
   catalog is built, rather than shadowing or rejecting them by bare name.
3. Discovery returns one list of descriptors, sorted by canonical name:
   `name`, `description`, complete
   `inputSchema`, and optional `outputSchema`. Include the required-prompt base
   schema even when the target has no additional data requirements. Libraries,
   fixtures and unregistered files are not callable targets.
4. Calls use the listed canonical name unchanged. There are no bare-name aliases,
   local-first lookup or fuzzy dispatch. Replacing an implementation preserves
   the name and contribution contract; only one implementation is registered at
   that address in a catalog version.

Model `agents({ action: "list" })`, SDK `ctx.list()`, and standalone `listTargets`
return the same descriptor list for equivalent runtime configuration. These SDK
bindings are implemented. Listing is optional for statically authored workflows.
Calls and discovery within an invocation use the same prepared definition/catalog
snapshot; a reload does not silently redirect an active call tree.
Prepare the complete selected catalog within that invocation's finite timeout
and cancellation lifetime. Do not grow discovery by importing another owner on
its first call. A selected stalled import can fail bounded preparation; old
fixtures requiring unused imports to remain lazy must migrate to this rule.

The runtime catalog consists of configured agent definitions and workflow
entrypoints discovered by the existing loader. Invocation input cannot request
arbitrary module paths. All registered callables are listed and callable; there
are no per-caller, per-App or per-kind invocation permission checks. App names
identify ownership. Existing tool provisioning and Task mutation/fencing remain
with their owning APIs.

Native CLI backends remain execution setup/tool capabilities unless explicitly
registered as contributions. A registered CLI-backed contribution follows the
same catalog, envelope and result rules; do not append unconditional standalone-
only pseudo-targets to shared discovery or retain their bare-name call aliases.

Bind `agents` as a built-in cooperation tool for prompt execution, independent
of a delegation preset or the existence of a workflows directory. Code uses
`ctx.call` and `ctx.list` over that same catalog.

## Concurrency, cancellation and continuation

The model cooperation tool has two actions: `list` and awaited `call`. Remove
`fork`, `peek`, `follow-up`, `cancel`, `context` and `sessions` from that tool.
Runtime control and diagnostic APIs retain supervision and evidence access.

`fork` lets a model launch a helper, continue independent work, then collect the
result. Removing it gives up that ad hoc model-controlled background execution.
It also removes a separate public session-handle, polling and steering contract.
Use ordinary workflow concurrency for parallel bounded work:

```ts
const [behavior, tests] = await Promise.all([
  ctx.call("alex/review-behavior", { prompt: "Review behavior", data: change }),
  ctx.call("alex/review-tests", { prompt: "Review tests", data: change }),
]);
```

A workflow can start a call promise, perform independent bounded work, then join
it before returning. Every child settles or stops before its caller releases
execution capacity. Parent Stop or timeout propagates cancellation through the
child tree using existing signals and command cleanup. Callers need no repeated
remaining-time checks. Ordinary cancellation does not require preempting arbitrary
synchronous JavaScript or containing arbitrary detached processes.

Later eligible attempts may redo safe work from current input and retained
evidence. Keep the same Task, consumed allowance and known external effects;
inspect uncertain effects before repeating them. No exact stack restoration,
new allowance ledger or public resume mechanism is required. Explicit Stop does
not itself authorize automatic retry.

When another outcome must outlive the invocation, use the existing Task/request
and Condition return path. Tasks track durable work; workflows execute; watchers
observe; Conditions wake an eligible attempt. The caller retains its assignment
and judges the contribution. A helper's completion never settles that Task.

## Implementation and migration

The [source review](../archive/reviews/agent-workflow-interface-source-review-20261117.md)
records the exact pre-cutover gaps, installed baseline and validation limits.

This is a paired Host/SDK/App change. Apply the interface in one coherent source
cutover, preserving #585's valid test repair. The broader Host shared-`run()` and
parent-only SQLite migrations are separate work.

Root owns this design, task breakdown, independent review and trial assessment.
May owns implementation through Alex's existing development workflow, publication,
CI/comment follow-up and return evidence. The following are ordered checklist
items within the owned outcome, not additional Tasks for each code layer.
The existing local-candidate workflow binds evidence to one checkout. If the
paired App migration needs its own checkout and continuation, use a finite App
source contribution with its own exact revision and return through the existing
Task/Condition path. Retain the original delivery Task, its usage and the final
paired-activation obligation; a passing Host commit cannot certify App edits.

| Item | Implementation work | Completion evidence |
| --- | --- | --- |
| A — Catalog | Prepare one immutable callable catalog with exact canonical names, complete effective schemas and duplicate rejection. Bind model list, SDK `ctx.list()` and standalone list/dispatch to it. | Equivalent catalogs give identical sorted descriptors; no short-name fallback; a rejected reload retains the prior catalog; an active tree keeps its snapshot. |
| B — Calls | Share envelope, resolution and result checks across thin model/code adapters. Make `prompt` mandatory, preserve `data`, constrain options to timeout/schema, and attach actual execution IDs. | Production adapters cover all four call directions and standalone execution, including missing/blank prompts, malformed/partial reports and output schema failures. |
| C — Removal | Remove invocation ACLs/profiles, App/kind call denials, filtered discovery, and the public fork/session actions. Inject cooperation independently of workflow-directory presence. | Cross-namespace calls work without grants; tool schema contains only list/call; configuration and guidance no longer advertise removed controls. Task fencing and ordinary tool provisioning retain their own contracts. |
| D — Consumers | Migrate active Apps, Task adapters, definitions, schemas, fixtures and examples to canonical names and `{ prompt, data? }`; update result consumers. Normalize historical saved references only at read boundaries. | Host/SDK CI and Apps checks pass against the same candidate revisions. Retained Task/caller/effect/usage evidence remains readable; new legacy calls fail with correction feedback. |
| E — Execution | Keep joined workflow concurrency and inherited cancellation; preserve normal Task/Condition continuation and evidence on safe redo. | Stop/timeout through a mixed tree cleans up ordinary children, starts no further children, and preserves evidence; helper completion cannot settle its Task. |
| F — Local trial | Build and run the paired candidate Host/SDK/Apps before PR merge. Assign bounded coding work through May, observe workflow/PR/CI/comment follow-up, and verify Telegram review-link delivery. | Record exact candidate SHAs, executable identity, native Task/workflow references, current PR head/checks, addressed comment and notification receipt. Record failures as open gaps. |

Items A–F have source and local-trial evidence. Hostd7fe closes the actual-worker
catalog gap; App5a closes current-assignment precedence and prepared-evidence
forwarding. The 33-target disposition index supports source review and states
its effect limits; live catalogs and the exact protected publication supply
additional production evidence. Historical failure/repair checkpoints remain in
the [dated review](../archive/reviews/agent-workflow-interface-source-review-20261117.md).

Preserve these completed checkpoints during integration:

1. Required finish reports, bounded correction, valid output/facts, actual child
   identity and ordinary cancellation/steering/lineage/CLI-drain behavior.
2. Current invocation assignment/data ahead of inherited Task context, fresh
   judgment with retained valid evidence, bounded receipts/usage and quiet replay.
   Canonical target selection does not transfer Task ownership: explicit domain
   parameters remain necessary, and independently owned work uses App/Task requests.
3. Exact Host/SDK/App binding and supported receipt-backed activation. Keep the
   native provider immutable, retain legitimate installed changes and #590, and
   preserve known baseline failures until their separate owner repairs them.
   The earlier trial used4a9e/241c; the final reconciled installation uses4a9e/90cc.
   The canonical reload gap and bootstrap994f remain historical integration evidence.
   Keep f85's scoped fixture changes explicit; the superseded staged alternative
   a1bdf requires no replay or activation.

These are checkpoints within the saved outcome, not new Tasks or Host phases.
May implements through the retained development workflows; Root reviews, checks
and helps publish coherent commits promptly for parallel review. Keep current
Task requirements, execution guidance, exact checkout/provider bindings, bounded
local procedure scope and trusted receipt diagnostics available to specialists.
An exact setup dependency can return through the existing `clarify` decision;
it must not cause unchanged coding rounds merely to repeat a missing prerequisite.
Preserve wider delivery obligations without requiring publication or activation
before a local source contribution can return.

Guidance must follow the common contract too. Preserve the repaired Tech-lead
scope and truthful structured judgments without canned phrases or a universal
public May Task block. Delivery ownership remains in retained Task/caller state;
existing exact PR Conditions provide observation. Keep one registered address
for shared implementations, including `alex/evaluation-report-reader`. Historical
metadata and receipts remain evidence, without restoring a second authoring route.

Continue from the retained Host #589 and paired App branches, preserving their
complete histories, saved cross-repository selectors and every actual cumulative
reservation, including the original seven #585 rounds. Their creator owns saved
finite allowance revisions; no replacement Task resets usage. Keep unrelated work
separate. Push coherent committed checkpoints to the existing PR and App
review branch while implementation continues, stating actual checks and gaps. Full cutover readiness
is required for its readiness claim, not for sharing unfinished work for review.
The user owns the separate ingress/input and event-system proposals; this
implementation remains focused on the unified callable interface.

Review and local verification do not wait for merge. First run portable candidate
checks; then build the exact candidate and activate compatible components for the
user-authorized local trial using the supported rollout/cancellation path. Keep a
known rollback revision and preserve independent Tasks. Protected Scout
publication stays on its owning isolated workflow; Root never edits its canonical
knowledge directly. A local trial does not authorize GitHub merge or a broader
release. Return concrete failures through the existing owner for workflow repair.

Do not leave a second legacy authoring route or merge incompatible Host/App
halves. At activation, let old bounded attempts finish or cancel them through the
normal rollout controls. Start fresh eligible attempts with compatible Host/SDK/
App definitions and retained work. No live stack migration or concurrent old/new
authoring interfaces are required.

Historical readers retain old results. Normalize saved Task/executor references
from their recorded App/owner identity when reading them; new invocations use
canonical names. An ambiguous old reference returns a useful recovery error,
rather than enabling a short-name fallback for new calls. A failed trial uses
the existing recovery path without resetting Task identity or development usage.

## Acceptance criteria

- Exercise agent→agent, agent→workflow, workflow→agent and workflow→workflow
  through production adapters. Preserve the same prompt/data, result schemas,
  actual child identity and owning Task context when changing implementation.
  Cover Task-bound and standalone calls; invocation itself has no Task-only gate.
- Reject missing/empty prompts and retired authoring fields before execution.
  Preserve references/criteria and return useful validation feedback. Verify
  complete, partial, missing-output and malformed-output reports for both kinds.
- Verify exact canonical discovery/call agreement, duplicate rejection, failed
  reload retention and pinned active definitions. Cross-namespace bounded calls
  need no permission grants. Check every installed definition for collisions.
- Verify parallel joined calls after removing public `fork`. Cancel a mixed
  agent/workflow child tree through Stop and timeout; observe ordinary child
  cleanup, no new child starts after cancellation, and retained useful evidence.
- Reenter safely on the same Task with consumed allowance preserved. Helper
  completion cannot close it; later input and independent Conditions remain live.
- Assign a coding task once. The agent runs its workflow, publishes the PR,
  follows actual CI/review changes through watcher/Condition wakeups, addresses
  comments, and sends a Telegram link when it judges the current PR ready for
  human review on GitHub. Telegram delivery establishes notification only.

Portable contract checks cover adapters and failure cases; the local trial
establishes connected behavior. Old-head CI and earlier dispatch probes do not
prove this cutover. Record exact Host/SDK/App revisions and remaining limitations
with the trial in the [integration record](../archive/implementation/host-ingress-and-boundary-simplification-20261116.md#keep-one-model-facing-invocation-tool).
