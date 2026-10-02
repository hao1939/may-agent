# Task execution capability contracts

**Supports:** [Agent capability guidance and infra contract](task-execution-capabilities-20261002.md). Specifies proposed calling and return semantics supporting the agent guidance design.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [convention over configuration](../1-principles/core-principles.md#convention-over-configuration), and [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Draft supporting reference for the [purpose and value design](task-execution-capabilities-20261002.md), 2026-10-03.
**Implementation status:** Unimplemented for the proposed unified capability
exposure and caller reply choice. Existing mechanisms and historical source
observations are identified below. This document adds no runtime fields or
installed capabilities. The proposed reply choice is not implemented
by [PR #285](https://github.com/hao1939/may-agent/pull/285); existing
`state`/`continue` results remain supported.

Read the main design for why the parts exist and the paired agent guidance and
infra requirements. This reference owns detailed calling and execution semantics.
Each section identifies the value its contract supports. All reuse existing
Task, input, Condition, event and receipt mechanisms.

## Ownership and lifetime

**Value:** preserve responsibility across execution boundaries while keeping
short operations straightforward.

| Owner | Responsibility |
| --- | --- |
| App | Packages domain guidance, input/result contracts, capabilities and declared workflow procedures. Supplies the agent's assignment and permitted scope. |
| Agent | Chooses actions, decides whether it needs their answers, interprets facts and judges its next step or completion. |
| App-authored workflow | Executes a declared procedure through the same scoped capabilities and asks an agent when judgment is needed. |
| Task | Retains the assignment, admitted inputs, requests, Conditions, accepted results and current execution facts across attempts. |
| Attempt | Provides one bounded execution, current authority, workspace, cancellation and live access to Task capabilities. It can include many model turns and tool calls. |
| Executor adapter | Runs the selected worker, exposes its permitted capabilities, forwards input/cancellation and returns its result through the attempt boundary. |
| Infra | Validates and connects capabilities, supplies trusted identity, executes actions, persists accepted work, delivers results and maintains Task state. |

The Task and attempt are scopes and records, not additional decision makers.
An attempt ends on its final result, failure or interruption. Ending an attempt
does not erase an already accepted request. A receiving Task owns fulfilling
the requested outcome; the caller owns interpreting an answer it requested.
The caller also retains its original assignment. A contribution request and
its reply choice do not transfer that assignment; an actual handoff requires
an authorized ownership decision under the existing App contract.

An ordinary read, command or helper may finish within the attempt. Work promised
to survive the attempt uses existing Task/input ownership or a supported
provider operation with retained feedback. Capability code selects the needed
mechanics. Arbitrary shell-created work does not acquire that promise by itself.

## Four purposes for capabilities

**Value:** Help workers find an action by what they want to accomplish.

| Purpose | What the agent expresses | Existing implementation to build on |
| --- | --- | --- |
| Understand | Read the assignment, relevant input, earlier evidence, current results and available actions. | Task context, `tasks` reads/contracts, scoped SDK reads and existing catalogs. |
| Act | Perform an operation or ask another owner to achieve an outcome, with an explicit choice about the answer. | Named tools, App inputs/actions, bounded helpers, workflows and Task request admission. |
| Observe | Identify an external fact that matters to the assignment. | Conditions and App-owned observation capabilities. |
| Report and decide | Supply evidence and decide whether to continue, wait, converge or report incomplete work. | Progress/evidence records and the existing attempt-result admission. |

These are navigation groups for existing capabilities. They do not introduce
four services, a new scheduler, or a lifecycle for every tool call.

Reads return observations. Actions return a result, accepted work, or an error.
Observation interests return their accepted identity and later facts. A final
decision ends the attempt. Each contract makes that observable behavior clear.

## Discovery: useful actions in the current scope

**Value:** Make available actions understandable and usable with bounded discovery effort.

Supply a small catalog alongside the Task context. Each entry gives a stable
logical name, purpose and short input/result description. Load full input and
output schemas, examples, supported reply choices and any relevant effect or
cancellation semantics on demand.

For example:

> **Review a change** — Ask the responsible reviewer to assess a change.
> Supply the change reference and optional concerns. The answer contains
> findings and a recommendation. You can request the answer or submit without
> one. Accepted review work survives the current attempt.

The catalog describes what the caller can accomplish. Worker selection,
workflow implementation, event types, channels and storage paths remain behind
that contract. App action declarations and existing tool/observation contracts
provide the descriptions; infra projects them for the current invocation.
Use the existing tool descriptions as that catalog when they suffice. Add a
compact index and on-demand detail only where discovery cost warrants it;
there is no separate author-maintained capability registry. Full schemas stay
with the owning operations rather than being copied into this guide.

Only installed, permitted operations should be advertised as callable. A
read-only invocation receives the read operations of a capability. Infra must
enforce the same restriction at invocation, including if a caller supplies a
write action manually. Availability can change after discovery; rejection
before acceptance must say that acceptance did not occur. A timeout or lost
acknowledgment after dispatch may leave acceptance uncertain; expose the known
receipt or uncertainty instead of claiming that no work was accepted.

The model's tool schema, workflow SDK adapter and native executor bridge share
the owning operation's contract. Their syntax may differ. Task context and the
actual callable surface must agree; a catalog entry alone does not install a
tool in a native executor.

Keep initial context bounded. Supply current assignment, selected inputs,
outstanding work and relevant new facts first, with exact read/navigation
capabilities for details and history. Reading input does not fulfill it.

## Calling convention: intent and an answer choice

**Value:** Let the caller express the needed outcome and answer while infra carries coordination.

The meaningful parts of a request are the operation, its domain input and
whether the caller needs an answer. The following illustrates those semantics:

```json
{
  "capability": "review_change",
  "input": {
    "change": "example/change/42",
    "concerns": ["Task and agent boundary"]
  },
  "reply": "required"
}
```

`review_change` is an illustrative logical capability name. A named tool can
expose these inputs directly. Existing App actions can translate them into
their App input contract. A universal dispatcher or new durable operation
registry is unnecessary.

Infra derives caller Task, attempt, authority, execution limits and return
address from the invocation. It maintains durable request identities and
retry receipts. A small caller-local name can identify a request when later
declarations refer to it; that name does not require the agent to invent an
inbox, session or delivery identifier.

Infra retries delivery using the saved call identity. On a later attempt, it
supplies accepted references and results so the worker can use or explicitly
refer to them. The default is safe retry of that operation, with explicit
exceptions described [below](#safe-retry-by-default-explicit-exceptions).
An intentional new operation remains distinct even when its content matches;
similar text alone cannot establish replay identity.

The choice belongs to the caller, outside the receiver's domain requirements:

| Proposed choice | Caller intent | Promise |
| --- | --- | --- |
| `reply: "required"` | I need the answer. | Return the result directly or preserve a durable return path and deliver it to the calling Task. |
| `reply: "none"` | I do not need the result. | Confirm acceptance under the action's contract; create no caller result dependency or completion notification. Receiver work keeps its own owner. |

Use `reply` in the proposed schema because it expresses intent without
suggesting a thread or transport implementation. Here the user's sync/async
distinction concerns the answer. A required answer can arrive later while
independent work continues. It does not require blocking the whole Task.

Request/send capabilities that support both choices require the caller to
choose. A direct read has a fixed result contract and needs no extra choice.
Capabilities advertise only choices they implement; infra rejects unsupported
ones. Existing accepted work retains its saved semantics during migration.

### Safe retry by default; explicit exceptions

The general rule belongs to [Core Principles](../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions).
The [Host/App contract](../2a-design/system-boundary.md#retry-and-recovery-ownership)
owns retry responsibility, identity, execution bounds and failure visibility;
its [exception contract](../2a-design/system-boundary.md#safe-retry-and-declared-exceptions)
owns effect safety and disclosed limitations. These shared rules apply to
existing capabilities as well as the interfaces proposed here. They do not
establish that every installed operation already fulfills the default.

For this proposal, apply the same safe-retry behavior to both reply choices.
Infra recovers delivery through the saved request and return path. The caller
need not create another Condition or request to recover a missing acknowledgment.
An agent-requested retry or failover uses the same owning capability and authority
checks. The proposed reply convenience adds no replay registry, retry policy or
requirement for the agent to administer retries.

### Acceptance is specific to the action

One calling convention does not give every action the same completion promise:

| Action | What acceptance establishes | What it does not establish |
| --- | --- | --- |
| Durable App request | The addressed App has accepted the contribution through recoverable admission; exact Task attachment may still be pending. | The contribution has finished, or the caller's original assignment is fulfilled. |
| Human message | The installed communication capability has accepted its delivery obligation and any requested reply correlation. | The human has received, read, agreed to, or completed the request. |
| External operation | The provider/capability has accepted the operation as described by its contract. | Its effect has completed or the agent's intended outcome is satisfied. |

Return known acceptance, rejection or uncertainty and make retained work
discoverable. These are observable meanings, not a mandatory universal result
envelope. Direct reads and bounded calls retain their ordinary result shapes.
Trust accepted agent judgments by default, while recording delivery and
execution facts according to the evidence actually available.

### When an answer is required

For a short awaited call, return its result normally; no durable Condition is
needed merely to await it. If the action uses durable work, save the request
and exact caller return link before dispatch or an acceptance response. Return
a receipt indicating that the answer is pending, and retain the result path
across attempt boundaries.

For durable Task requests, the choice gives infra enough information to fill
the existing caller request/Condition bookkeeping. The agent must not submit
a second Condition or register an observer merely to receive the answer.
This is a convenience over existing owning records, not a second wait registry.

An answer that arrives while the attempt runs is available through the normal
Task input/read path. After yielding, the retained input can schedule a later
attempt. A result returned directly does not also need a duplicate agent wake.
An admission or execution failure follows the same caller correlation with
diagnostic evidence. Receiving a failure is evidence for a new decision, not
proof that the requested outcome succeeded.

The agent separately decides when no useful independent work remains and it
should report a wait through the supplied schema. A pending answer does not
automatically set the Task's execution phase or veto convergence. The agent
judges fulfillment under App policy; infra records that judgment and keeps
other facts accurate.

### When no answer is requested

Return a receipt only after the capability has actually accepted responsibility.
A queued event with no accepting owner is insufficient. Durable App admission
can accept work while exact Task attachment remains pending; preserve that
distinction and its recovery path. Rejection before acceptance remains a
caller-visible error.

For an App contribution, the receiving owner judges fulfillment. Infra executes
actions and records the accepted decision. Failures remain visible through that
owner, ordinary recovery and existing metrics/evaluation routes. The absence of
a requested answer does not remove work ownership or failure evidence. No result
Condition or routine completion wake is added to the calling Task.

This is responsibility for the requested contribution. The caller still judges
its own assignment and any promises it made. Disabling feedback does not, by
itself, satisfy those promises or authorize handing them off.
The caller judges whether accepted delegation fulfills its own assignment;
the reply choice adds no infra completion gate.

The receipt remains available if the caller later explicitly inspects the work.
Choosing no reply does not mean deleting provenance, hiding failures from
system oversight, or cancelling accepted work when the caller stops.

### Human communication follows the same convention

The agent supplies the logical recipient, message and answer choice. Infra
selects the installed interface, preserves any required reply correlation and
reports rejection or delivery failure according to the contract. An ordinary
message need not be represented as an approval.

Acceptance refers to the capability's delivery obligation. It cannot assign
work to a human or guarantee that the human will reply. Persisted work, transport
delivery and a received human answer remain distinct. A missing reply leaves
the retained interest available for later agent judgment; delivery does not
gate or rewrite the source Task's accepted outcome.

Conversation records and Telegram are implementation layers. The agent does
not select between them. Trusted approval decisions still use their supported
ingress and authority checks; ordinary reply text cannot grant authority by
claiming to be an approval.

For Conversation work, a capitalized **Request** is the existing record of an
accepted promise to the human. The agent decides which inputs refine one
intention and which are independent. Infra retains the associations and full
assigned scope across turns, validates explicit dispositions and commits the
reply and related changes together. Finishing the input batch cannot silently
discard an accepted Request. Routine observations need not create a promise
or human reply; the agent judges that obligation under the supplied contract.
This uses existing Conversation records, without making every capability call
or event a Conversation Request.

## Conditions express facts, independently of execution

**Value:** Retain interests and return changed facts without preventing independent progress.

An explicit Condition is appropriate when the agent needs an external fact,
such as a deployment becoming healthy or a human deciding a proposal. The App
supplies that observation's meaning and provider adapter. Infra resolves its
identity, observes it and presents changed facts through the owning Task.

Use an already returned operation reference when the capability owns the
external work. Avoid asking the agent to reconstruct provider identity,
invent an event type, or create duplicate polling for a supported action.

Conditions remain independent from the attempt decision. Existing interests
survive omission from a later result. Explicitly retiring an interest stops
that dependency; it neither cancels receiver work nor asserts that an external
fact became true. Changed facts invite judgment, not automatic domain success.

## Live actions and final decisions

**Value:** Let one attempt do useful work incrementally without losing accepted actions or duplicating bookkeeping.

An attempt may take many actions and return one final decision. Supported Task
changes made through a live tool, workflow SDK, executor adapter or final
declaration enter the same validation and admission implementation.

Live admission returns its receipt and preserves the running attempt. Final
admission also records the decision and releases the attempt. Previously
admitted actions and waits survive interruption and need not be repeated.
Only declarations supported by the result schema are executable; final prose
and arbitrary command descriptions do not become actions automatically.

Replaying an admitted request reuses its existing identity/receipt. Infra does
not promise exactly-once external effects for an arbitrary shell command.
Stale attempts cannot use Task capabilities to overwrite newer Task state.

| Decision meaning | Meaning |
| --- | --- |
| Continue | Useful work remains; end this attempt and schedule another. |
| Wait | The addressed work needs a retained result, fact or supported review checkpoint; yield execution capacity. |
| Converged | The agent judges the addressed work fulfilled; normal admission marks the request done. |
| Incomplete | Retain the unsuccessful attempt and unfinished work for ordinary recovery and agent judgment. |

These are semantic choices, not a new output enum. Use the invocation's actual
result schema. The existing ordinary Task contract expresses continuation with
`state: "waiting", continue: true`; the proposed `decision` migration remains
deferred. Helper completion settles its contribution. Completing addressed
requirements, closing a Task's lifetime and intentionally cancelling unfinished
work remain distinct operations with their existing authority checks.

The accepted decision is working truth by default, with no mandatory second
judgment or guarantee of objective correctness. The Host derives Task state
from accepted decisions, current execution, inputs, Conditions and owner
controls. The agent does not maintain a second copy of Task state.

Automatic late results respect the existing Task lifecycle. Retain history
for a closed Task; a late reply does not independently authorize reopening it.
The agent interprets new requirements and uses authorized controls.

## Agents, workflows and executor adapters

**Value:** Make the same operation dependable across worker types and reuse known procedures.

An agent and a workflow are ways to perform the assignment. An executor adapter
connects that work to the Host's `TaskAttempt` contract. It is not an additional
owner of the outcome or an independent semantic judge.

```text
Task -> bounded attempt -> executor adapter -> agent or authored workflow
               |                                    |
               +--- scoped capabilities and input ---+
               +--- actions and final result --------+
```

| Concern | Agent | App-authored workflow | Executor adapter |
| --- | --- | --- | --- |
| Understand | Reads the Task context and discovers relevant tool contracts. | Receives typed input/context and uses SDK reads; known operations need no repeated catalog lookup. | Supplies canonical context and access to the permitted operations. |
| Act | Calls a tool or returns a supported declaration. | Calls the corresponding scoped SDK capability or returns a supported declaration. | Bridges to that capability and carries identity, cancellation and results. |
| Observe | Chooses a Condition or a request whose answer is required. | Expresses the same interest under App policy. | Delivers facts through the existing Task input path. |
| Report and decide | Returns its judgment under the assignment. | Returns the procedure's result or obtains a judgment from an agent. | Returns the worker's result for normal admission; reports execution failure if it cannot do so. |

The invariant is the operation's meaning, authority, admission and feedback,
not identical interface syntax. A model gets a tool schema; workflow code gets
a typed function. A native executor needs a bridge when its model must call
the same operation live. All reuse the owning implementation. An adapter must
not infer domain success from process exit or successful delivery.
Require these semantics for operations an adapter advertises. Add an operation
to another adapter when an actual assignment needs it, rather than making
universal feature parity a prerequisite for this proposal. An unsupported
operation must be visible as unavailable, without invented fallback authority.

The SDK already supplies the main structure: `TaskExecutor` takes a
`TaskAttempt`; the attempt exposes reads, `apply`, `publish`, `reviseTask` and
live input. A Task-owned workflow receives its scoped equivalents through
`WorkflowContext`. Extend these connections where needed rather than passing
the Host's database, scheduler or unrestricted runtime into a workflow.

There are two uses of a workflow:

- **Executing the Task attempt:** its result is interpreted under that Task's
  declared workflow/result contract and goes through normal Task admission.
- **Contributing within another execution:** it returns a bounded contribution
  to its caller. The caller's owning procedure decides how to use that result.
  A helper's `done` does not by itself settle the parent's Task.

Standalone bounded calls may have no durable Task context. Their capability
surface must reflect that; do not invent a Task or grant Task mutations merely
to run a helper. Supported work that must outlive such a call still needs an
explicit durable owner.

### Reply choice is independent of JavaScript async execution

Workflow code awaits submission even when it requests no reply. That await
establishes acceptance or returns an error; it does not wait for receiver
completion. Dropping a JavaScript Promise is not durable delegation.

When a required answer is pending, a workflow can do independent steps or end
the attempt with a retained wait, just as an agent can. If it yields, the next
attempt uses saved inputs/results and existing receipts. Infra does not keep
an old JavaScript stack or Promise alive across restart. Short awaited helpers
retain their ordinary bounded-call behavior.

Task-bound helpers inherit the current execution's scope and restrictions.
Their permitted live changes use the same attempt capability; they do not
create a competing parent attempt or independently settle the parent's Task.
Durably submitted receiver work retains its own owner after the caller ends.

## Deliver knowledge where it is needed

**Value:** give the worker enough knowledge to decide well without loading every procedure into every invocation.

Use the existing instruction, context, schema and reference mechanisms. Each
piece has a different owner and lifetime:

| Knowledge | Owner and existing delivery path | When needed |
| --- | --- | --- |
| Stable execution rules | Host's short bundled execution instructions; executor adapters carry equivalent semantics. | Every applicable execution, retained through context compaction. |
| Role, domain rules and escalation policy | App's role guidance and workflow policy. Shared conventions belong in shared guidance. | The relevant agent or workflow invocation. |
| Current assignment and facts | Task context, live input, accepted results and exact reads. | At attempt start and as relevant facts change; mark stale or omitted observations. |
| Callable contracts | The owning capability's descriptions and schemas, projected into permitted tools and typed SDK calls. | Small discovery catalog first; full contract when selecting or invoking the capability. Supply the exact result schema before execution. |
| Procedures and examples | Existing knowledge references, skills and workflow documentation. | On demand, such as requesting review, recovering a failed action or interpreting a metric trend. |

Keep one authoritative definition of each operation and result shape. Derive
tool/SDK surfaces where practical and check their agreement; do not hand-copy
independent schemas into a new handbook. Examples teach combinations of
capabilities and reference those definitions. No new knowledge service or
universal input object is required. The agent can interpret free-form requirements
using the App's input contract while infra preserves the source input.

Workflow authors need the same rules in SDK documentation and executable
examples. Running workflow code receives typed context and capabilities; it
does not need a prose handbook loaded into memory. When the workflow calls a
model, that model receives the instructions, facts and contracts relevant to
its contribution. Executor adapters must supply what they advertise or expose
the limitation; a knowledge document cannot install a missing capability.

### Current foundation and verification

The current implementation already has a foundation: bundled Host execution
instructions, a refreshed Task decision brief, tool/result schemas and App
guidance. The [agent convention](../2b-manual/agent-convention.md) documents
their assembly. Knowledge files are available on demand, not automatically
loaded, and native executors assemble their own packets. This proposal calls
for consistent coverage of the contract across those paths; it does not claim
that all paths already provide it.

Verification has two parts. Inspect the actual instructions, messages and
callable schemas received by the worker, including after compaction or resume.
Then exercise the semantics: an accepted request survives interruption, a
pending review allows independent work, and a helper cannot settle its parent.
Use comparable model trials to assess whether agents apply the rules; source
checks and a shorter prompt alone do not establish better judgment or cost.

## Execution requirements exposed by recent fixes

**Value:** make completion, continuity and affordable execution dependable at the boundaries where past implementations failed.

The [PR review](task-capability-pr-review-20261003.md) makes several parts of
the contract more precise. These extend the main design's infra requirements, using existing
mechanisms rather than adding work for the agent to administer.

1. **Correct before finishing; stop after acceptance.** Return knowable
   schema/contract errors while the worker can correct them in its current
   invocation. Reuse the owning validator and retain final freshness/authority
   checks. An accepted finish ends that invocation: no later model request or
   tool effect in the same batch. Prior effects and remaining input survive.
2. **One execution bound.** Setup, authored work and nested calls share the
   execution's deadline and cancellation scope. Supported effect and result
   boundaries enforce it; catching a timeout does not grant more time. This
   does not promise forcible interruption of arbitrary synchronous code or
   rollback of an external effect that already happened.
3. **Advance input without losing requirements.** Keep receipt, consideration
   and fulfillment distinct. Advance notifications that an accepted report has
   considered while preserving unanswered requests. A retry must not keep a
   later correction behind the same restored input batch. The agent chooses
   which requirements its result answers; infra maintains the exact links.
4. **Bound retrieval work as well as output.** Exact reads and resume paths
   must remain usable as history grows. Use the owning indexed/paged reads;
   expose missing coverage and diagnostics. A short response does not prove
   that its database or transport work is bounded. Verify representative
   retained-history sizes and actual installed permissions at the relevant
   installation boundary.
5. **Deliver failures to the designated judging agent.** Failure before a
   worker starts, unsuccessful attempts and monitoring failures remain
   observable. Infra executes declared metric/Condition review routes; the
   receiving agent decides whether to observe, repair or escalate. Preserve
   an accepted investigation and its return path through ordinary Tasks. An
   alert, delivery receipt, investigation and recovered original requirement
   are separate facts. No fixed retry-count limit or infra-chosen remedy is
   implied. A stopped Host still needs installation-level health observation.

The App/installation owns selecting that reviewer and configuring its existing
route. Infra owns executing the route and retaining acceptance or failure.
For failure coverage before a worker starts, verify that review does not depend
on that same failed startup path. If the selected reviewer is also unavailable,
use only the configured fallback and expose unresolved delivery. Missing review
coverage is a gap, not permission to infer an owner from an alert label. These
requirements apply the existing [metric routing](../2a-design/metrics.md#ownership-and-routing)
and [intervention boundary](../2a-design/system-boundary.md#ownership-and-intervention);
they add no supervisor service or failure-count policy.

Acceptance checks must exercise real entry and return paths: invalid result
then correction, accepted finish in a mixed tool batch, delayed observation
without manual waking, restart after acceptance, later correction during retry,
and repeated failures reaching a reviewer. Test the distinct supported adapters
and lifetimes, without duplicating the same test for every named capability.

## Mapping existing capabilities

**Value:** Apply the common contract through existing owners, keeping the implementation small.

| Existing surface | Position in this design |
| --- | --- |
| Task context, `tasks.get/list/contract`, SDK reads | Understand: align discoverable operations and exact scoped reads. |
| Coding, page retrieval, provider tools | Act: keep direct result contracts and attempt-scoped execution. |
| Agent helpers and workflow calls | Act: retain bounded contribution semantics and inherited execution scope. |
| App inputs/actions and #285 `TaskChanges` | Act: reuse durable ownership and shared admission for requests. Add the reply choice at the caller boundary. |
| `message` and human interfaces | Act: connect logical recipient/message and the declared reply choice to existing delivery. |
| Conditions and resource observers | Observe: retain one interest lifecycle and automatic source execution. |
| Metrics, schedules and subscriptions | Execute declared observation/review rules and supply evidence; the responsible agent judges which action to take. |
| `finish` and Task/Conversation results | Report and decide: retain the owning context's result contract and ordinary acceptance. |
| Checkpoints, usage, diagnostics and recovery | Support execution and evidence; expose only useful permitted reads/actions, keeping routine bookkeeping automatic. |
| Native executor adapters | Provide the same supported scoped operations and contracts where needed; receiving a context packet alone is insufficient. |

## Implementation boundaries and review cases

**Value:** Verify that advertised capabilities fulfill their promises through actual entry and return paths.

The earlier capability review inspected Host `408fc6dd4` (PR #285 with main
`e2e5c8481`). Its focused loader, context, tool, read and observer checks had
110 passes and three installation-dependent skips. A separate synthetic
probe reached a publication sink through `tasks` under `readonly`; it did
not perform a live write. These are observations at that revision, not a rerun
against the subsequently narrowed #285 head. They motivate the following work:

Separate a broken existing promise from a proposed extension. Historical
observations identify places to check against the source and installation
chosen for a change; they do not establish that every limitation is still
present. Guidance alone can be sufficient when the needed action, wake and
context already work. Shared discovery and reply convenience remain proposals.

| Boundary | Observed limitation at the probe revision | Focused acceptance case |
| --- | --- | --- |
| Discovery and restrictions | Tool-name filtering retains mutable `tasks` operations under `readonly`. | Expose only permitted operations and reject a manually supplied forbidden operation before effects. |
| Message delivery | Raw `message` recording can lack an accepting human consumer. | Agent selects recipient/message; mocked interface delivers it; required reply reaches the exact caller. Missing delivery support rejects visibly. |
| Reply choice | #285's automatic request feedback follows an explicitly saved Condition; no `reply` field is implemented. | Required reply automatically gets the existing bookkeeping; no-reply creates no caller dependency or completion wake. Receiver work is identical. |
| Live admission | #285 shared admission is now merged; the earlier probe was against its candidate revision. Verify any further convenience against the merged boundary. | Tool/SDK/final declarations share authority and receipt behavior; a live action preserves the attempt. |
| Native executor exposure | Codex receives Task context, steering and final-result admission, without a live May capability bridge. | Native attempt can request review, continue testing, and use the same saved receipt/return path. |
| Agent/workflow agreement | Existing adapters expose related contracts through different entry points. | The same permitted request from a tool, SDK call or supported result declaration produces equivalent ownership and feedback; a helper result does not settle its parent. |
| SDK/model reads | Exact SDK metric/execution/result reads have uneven model exposure. | Add a narrow adapter only where a Task role needs it; successful discovery leads to a usable scoped read. |

For the chosen request capability, also exercise a fast reply before the caller
yields, interruption after acceptance, restart before feedback, duplicate
submission, changed requirements, receiver failure, and a late result for a
closed caller. No-reply work must remain owned and observable when the caller
ends. A pending result must not force waiting or reject an otherwise admitted
agent convergence decision.

Use existing Task, input, Condition, event and delivery records to close these
boundaries. Preserve the existing `state`/`continue` result contract and compatibility
behavior until a paired SDK/Host/App change explicitly introduces a new
request convention. This draft adds no runtime fields, changes no deployed
behavior, and does not expand #285's implementation claim.
