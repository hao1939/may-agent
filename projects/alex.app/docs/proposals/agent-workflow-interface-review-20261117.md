# Unified agent and workflow calls

**Design status:** Accepted direction; implementation and verification are active.
The interfaces below define the requested cutover.
**Implementation status:** Follow-up required. Host [#585](https://github.com/hao1939/may-agent/pull/585)
is merged into main `0606e2df16d0a44016bbef1c6294dac4c4c11d94`; its shared
tool name still fronts incompatible inputs, results, discovery and permission
handling. Source merge and installed-runtime activation are separate facts.
Draft [#589](https://github.com/hao1939/may-agent/pull/589) publishes the partial
catalog, standalone dispatch, SDK discovery and built-in cooperation checkpoint
`166d8d15b1` for parallel review.
Production model/SDK parity, removal of old
interfaces and paired App migration remain incomplete. No candidate is activated.
The focused Task-revision fix #590 is active locally; that activation does not
activate this callable cutover. The [live source review](../archive/reviews/agent-workflow-interface-source-review-20261117.md)
records later local checkpoints, failed checks and the remaining connected proof.

**Supports:** [Agent and workflow contributions](../2a-design/execution-contributions.md).
Let a caller assign bounded work and consume its result through the same contract,
whether the implementation uses a model or TypeScript.
**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first)
and [robust enough for the goal](../1-principles/design-philosophy.md#robust-enough-for-the-goal).
Remove invocation permissions and public background-helper management. Use ordinary
awaited calls, bounded cancellation and affordable redo with retained evidence.

## Proposed behavior

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
This proposal specifies their pending interface cutover. Examples below show
proposed syntax, not the currently deployed SDK.

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

Migrate diagnostic consumers as well as result producers. In particular,
`ExecutionResult.cliCalls` currently supplies Host-recorded evidence to development
and Gym. Preserve its provenance through the existing execution diagnostics or
configured diagnostic observer, addressed by the actual execution reference.
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
   valid catalog. No kind can shadow another.
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
return the same descriptor list for equivalent runtime configuration. `ctx.list()`
is a proposed SDK binding. Listing is optional for statically authored workflows.
Calls and discovery within an invocation use the same prepared definition/catalog
snapshot; a reload does not silently redirect an active call tree.

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

For the next Host continuation, finish A–C at the production boundary before
spending the remaining rounds on standalone fixtures alone:

1. Prepare the shared catalog from captured agent definitions and workflow
   modules. `manager-agents-tool.ts` and `workflow-tool.ts` currently prepare
   incompatible lookups; use the SDK `CallableCatalog` as the common authority,
   including `ctx.list()` bindings. Capture definitions before asynchronous
   imports; a missing target in that snapshot must not fall through to a newer
   live registry. Check duplicates across all selected workflow directories.
2. Reduce the model tool to list/call with mandatory structured input and common
   options. Remove the procedure-only/deny branches and corresponding loader and
   configuration fields. Internal runtime cancellation and diagnostics remain
   usable by their owning Host APIs without public helper-session actions.
3. Route workflow child calls through that captured catalog and common report
   validation. Migrate Task adapters and required production fixtures in the same
   branch. A focused production test should list then invoke the exact listed
   agent and workflow names, preserving prompt/data and the result envelope.
4. Bind the separate App contribution to the resulting candidate SDK, migrate
   active registrations and consumers, then run broader checks and paired trials.

These are source checkpoints within the saved outcome, not new approval gates or
renewed allowances. Record coherent partial progress when a bounded round ends;
do not preserve a retired API just to keep its old fixtures green, or claim the
whole cutover from a passing standalone test.

For D, the live trial also exposed two concrete consumer-context defects in
Alex's `develop-change.ts` specialist prompt. State the bounded local-candidate
scope beside the wider Task acceptance, so Bob does not require PR publication
or deployment before returning source evidence. Allow the existing `clarify`
decision to name a missing setup dependency, instead of requiring an unchanged
candidate to cycle through implementation after a prerequisite failure. Preserve
the owning Task's delivery requirements, actual failed receipts and consumed
rounds. These are App prompt/return corrections within migration, with no new
Host phase, classifier or allowance rule. See the
[observed boundary failure](../archive/reviews/agent-workflow-interface-source-review-20261117.md#task-ingress-and-event-assessment).

Migrate guidance and tests that prescribe the retired interface as well. Preserve
the creator's acceptance and meaningful regressions; update fixtures and calls
that encode old names, envelopes or built-in CLI assumptions. Preserving an old
test's literal input cannot require retaining the interface being removed.
Tech-lead's instructions also currently make publication depend on an embedded
May Task block. Keep delivery ownership and caller links in retained Task state;
do not make that public block or a separate May delivery Task a universal
publication prerequisite. The existing exact PR Condition provides observation
without the block, as the focused #590 trial demonstrated. Historical body
metadata may retain its current optional routing meaning. These are consumer
corrections within D, not a new watcher registry or source of publication authority.
Its implementation guidance also prescribes canned judgment phrases and says to
inspect only referenced files while asking the same contributor to implement a
change. Make the current implementation assignment and relevant investigation
the scope; require truthful bounded evidence without mandatory answer phrases.
The trial's repeated unchanged implementation reports motivate this correction,
but its behavioral effect still needs a fresh native run.

Current App source also re-exports `evaluation-report-reader` from both Alex's
and Evaluator's workflow directories. Under the agreed App namespace these are
two registrations for `alex/evaluation-report-reader`, so preparation must
reject them. Register the shared implementation once and migrate consumers to
its canonical address; agent-local forwarding files are unnecessary when all
callers share the catalog. Inventory similar registrations before paired
activation. Do not silently skip a duplicate because its implementation matches.

May should implement from current Host main in the retained Task-owned worktree,
with the saved cross-repository selector and cumulative development allowance
revised by its creator. Preserve the seven consumed #585 rounds and their
receipts; do not renew them through a replacement Task. Because #585 is merged,
publish the correction as a follow-up PR, excluding unrelated changes. Coordinate
any App companion changes explicitly rather than mixing unrelated workspace edits.
Push coherent committed checkpoints to that draft PR while implementation
continues, stating the actual checks and remaining gaps. Full cutover readiness
is required for its readiness claim, not for sharing unfinished work for review.
The user owns the separate ingress/input and event-system proposals; this
implementation remains focused on the unified callable interface.

Review and local verification do not wait for merge. First run portable candidate
checks; then build the exact candidate and activate compatible components for the
user-authorized local trial using the supported rollout/cancellation path. Keep a
known rollback revision, preserve independent Tasks, and leave protected Scout
publication untouched. A local trial does not authorize GitHub merge or a broader
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
