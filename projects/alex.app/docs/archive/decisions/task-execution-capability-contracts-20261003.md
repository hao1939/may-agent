# Task execution capability contracts

**Supports:** [Agent capability guidance and infra contract](task-execution-capabilities-20261002.md). Connects proposed discovery improvements to existing calling and return contracts.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [convention over configuration](../1-principles/core-principles.md#convention-over-configuration), and [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Draft supporting reference for the [purpose and value design](task-execution-capabilities-20261002.md), 2026-10-03.
**Implementation status:** Unified capability exposure remains proposed. Requests
and separate caller Conditions use the existing source contract, including
[PR #285](https://github.com/hao1939/may-agent/pull/285). Historical source
observations are identified below. This document adds no runtime fields or
installed capabilities; existing `state`/`continue` results remain supported.

Read the main design for why the parts exist and the paired agent guidance and
infra requirements. This reference applies the owning App and attempt contracts
to discovery and execution. Each section identifies the value it supports. All
reuse existing Task, input, Condition, event and receipt mechanisms.

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
its caller Condition do not transfer that assignment; an actual handoff requires
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
| Act | Perform an operation or ask another owner to achieve an outcome. | Named tools, App inputs/actions, bounded helpers, workflows and Task request admission. |
| Observe | Identify a request result or external fact that matters to the assignment. | Conditions and App-owned observation capabilities. |
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
output schemas, examples, result-observation support and any relevant effect or
cancellation semantics on demand.

For example:

> **Review a change** — Ask the responsible reviewer to assess a change.
> Supply the change reference and optional concerns. The answer contains
> findings and a recommendation. Declare a caller Condition to observe the result.
> Accepted review work and its result remain inspectable across attempts.

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

## Requests and caller Conditions

**Value:** Assign work and observe its result without mixing receiver responsibility
with caller scheduling.

The [App input contract](../2a-design/agent-app.md#admission-and-clarification)
owns requests and their correlation. A request describes the receiver's work;
a separate Condition records the caller's interest in its result. They can be
submitted together through the existing Task changes surface:

```json
{
  "requests": [{
    "id": "review",
    "appId": "reviewer",
    "input": {
      "kind": "message",
      "data": {"message": "Review example/change/42, focusing on the Task and agent boundary."}
    }
  }],
  "conditions": [{"requestId": "review"}]
}
```

This is a Task changes payload, not a complete final attempt result. `reviewer`
is illustrative: the receiving App must expose the corresponding input contract.
Use a live tool, workflow SDK or executor capability actually supplied to the
attempt. No universal capability dispatcher or additional request mode is needed.

The caller supplies a stable local request ID. Infra derives trusted Task,
attempt and authority, owns durable identities and resolves
`{ "requestId": "review" }` to the existing completion Condition. A Condition may also refer to
an already admitted request in the same caller generation. The agent does not
manufacture transport identifiers or register a second observer.

Omitting `conditions` submits identical receiver work without adding a caller
result interest. Ownership, accepted results and failure evidence remain retained
and inspectable. Declaring the Condition connects result observation and caller
wakeup; it does not change the request's meaning or force the caller to stop
independent work. Its attempt decision remains separate. Omitting an existing
Condition from a later declaration preserves it; use explicit retirement when
that interest no longer applies. Retirement does not cancel receiver work.

A short bounded call returns its result normally and needs no durable Condition
merely because it is awaited. For durable work, admission returns a receipt;
completion arrives later through the saved Condition or is available by reading
the retained work. A receipt proves acceptance, not fulfillment of either the
receiver's contribution or the caller's assignment.

### Safe retry by default; explicit exceptions

The [Host/App contract](../2a-design/system-boundary.md#retry-and-recovery-ownership)
owns retry responsibility, identity, execution bounds and failure visibility;
its [exception contract](../2a-design/system-boundary.md#safe-retry-and-declared-exceptions)
owns effect safety and disclosed limitations. Apply the same rules whether or
not the caller declared a Condition. Infra recovers delivery through the saved
request identity. Lost acknowledgment does not call for a new request or Condition.

Repeating the same local request ID in the same caller generation reuses its
admission; changing the content under that identity is rejected. Intentional new
work uses a distinct identity, even when its text matches. Retain uncertainty
where external acceptance or effects cannot be established safely. An agent
chooses a repair or failover through the owning capability and authority checks.
These rules add no replay registry or agent-managed delivery loop.

### Acceptance is specific to the action

| Action | What acceptance establishes | What it does not establish |
| --- | --- | --- |
| Durable App request | The addressed App has accepted the contribution through recoverable admission; exact Task attachment may still be pending. | The contribution has finished, or the caller's original assignment is fulfilled. |
| Human message | The installed communication capability has accepted its delivery obligation and any supported reply correlation. | The human has received, read, agreed to, or completed the request. |
| External operation | The provider/capability has accepted the operation as described by its contract. | Its effect has completed or the agent's intended outcome is satisfied. |

Return known acceptance, rejection or uncertainty and make retained work
discoverable. These meanings do not require a universal result envelope. Direct
reads and bounded calls retain their ordinary result shapes. Execution failures
remain correlated with the receiver work and available through existing
recovery and oversight paths, regardless of a caller Condition. A failure fact
supports the next decision; it does not satisfy the requested outcome.

### Human communication uses its existing contract

The agent supplies a logical recipient and message through the installed
communication surface. Infra handles delivery and supported reply correlation.
An ordinary message need not become an approval or acquire a new answer-choice
field. When a human decision matters to the Task, retain that interest using the
supported Condition/approval contract. Delivery is not a human decision, and
reply text alone cannot grant authority outside the trusted decision ingress.

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

An explicit Condition records interest in a request result or external fact,
such as a deployment becoming healthy or a human deciding a proposal. For request
results, infra resolves the saved request reference. For external facts, the App
supplies the observation's meaning and provider adapter. Infra observes the fact
and presents changes through the owning Task.

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
| Observe | Declares a Condition for a request result or external fact. | Expresses the same interest under App policy. | Delivers facts through the existing Task input path. |
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

### Awaiting submission and awaiting completion

Workflow code awaits durable submission, with or without a caller Condition.
That await establishes acceptance or returns an error; it does not wait for
receiver completion. Dropping a JavaScript Promise is not durable delegation.

While a caller Condition observes a pending result, a workflow can do independent
steps or end the attempt with a retained wait, just as an agent can. If it yields,
the next attempt uses saved inputs/results and existing receipts. Infra does not keep
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

The [PR review](../archive/reviews/task-capability-pr-review-20261003.md) makes several parts of
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
| App inputs/actions and #285 `TaskChanges` | Act: reuse durable ownership and shared admission for requests; caller Conditions separately observe their results. |
| `message` and human interfaces | Act: retain logical recipient/message, existing delivery and supported reply correlation. |
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
context already work. Shared discovery remains a proposal; request/Condition
separation is an existing contract to preserve and verify.

| Boundary | Evidence or behavior to verify | Focused acceptance case |
| --- | --- | --- |
| Discovery and restrictions | Tool-name filtering retains mutable `tasks` operations under `readonly`. | Expose only permitted operations and reject a manually supplied forbidden operation before effects. |
| Message delivery | Raw `message` recording can lack an accepting human consumer. | Agent selects recipient/message; mocked interface delivers it; required reply reaches the exact caller. Missing delivery support rejects visibly. |
| Request/Condition separation | #285's request-result observation follows an explicitly saved Condition. This is intended behavior, not a missing request option. | The same receiver request retains results and failure evidence with or without a caller Condition; adding the Condition connects result observation and caller wakeup. |
| Live admission | #285 shared admission is now merged; the earlier probe was against its candidate revision. Verify the installed boundary. | Tool/SDK/final declarations share authority and receipt behavior; a live action preserves the attempt. |
| Native executor exposure | Codex receives Task context, steering and final-result admission, without a live May capability bridge. | Native attempt can request review, continue testing, and use the same saved receipt/return path. |
| Agent/workflow agreement | Existing adapters expose related contracts through different entry points. | The same permitted request from a tool, SDK call or supported result declaration produces equivalent ownership and feedback; a helper result does not settle its parent. |
| SDK/model reads | Exact SDK metric/execution/result reads have uneven model exposure. | Add a narrow adapter only where a Task role needs it; successful discovery leads to a usable scoped read. |

For the chosen request capability, also exercise a fast reply before the caller
yields, interruption after acceptance, restart before feedback, duplicate
submission, changed requirements, receiver failure, and a late result for a
closed caller. Receiver work must remain owned and observable without a caller
Condition and when the caller ends. A pending result must not force waiting or
reject an otherwise admitted agent convergence decision.

Use existing Task, input, Condition, event and delivery records to close these
boundaries. Preserve the existing request/Condition separation, `state`/`continue`
result contract and compatibility behavior. This draft adds no runtime fields,
changes no deployed behavior, and does not expand #285's implementation claim.
