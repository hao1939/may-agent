# Tasks and communication resources

**Supports:** [Understand intent and close the loop](../2a-design/system-model.md#understand-intent-and-close-the-loop).
Preserve what was asked, carry the work forward and return useful answers without
making people or agents administer several work mechanisms. This supports
[May's purpose](../1-principles/purpose.md): useful results with decreasing
supervision and acceptable total cost.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first),
[one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource)
and [agents judge; infra executes](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
Reuse ordinary Tasks and their existing admission, actions, Conditions and return
contracts. Add communication records only for information they need to preserve.

**Design status:** Draft for review, 2026-10-04. Task-first ownership and the
supporting roles below capture the discussed direction; capability boundaries
and migration still need review.
**Implementation status:** Partial foundation exists. Conversation turns already
use the Task runtime, and accepted Requests have no execution lifecycle. The
ordinary communication capabilities and contract consolidation proposed here are
not implemented. This document changes no runtime behavior.

## The proposed rule

**Tasks own work. Conversation, Request and Topic support communication and
commitments around that work. Humans and agents can benefit from these roles.**

Handling a Conversation is a valid responsibility for an ordinary, long-lived
Task. Its agent understands messages, acts, asks for help and returns answers.
Conversation is the retained discussion that this Task uses. A turn is one
attempt of that Task, with the ordinary execution and recovery contract.

This does not require a Task per message, Request or Topic. The agent continues
in the existing Task while its responsibility fits, and commissions another
Task when an independent outcome or execution lifetime is useful. A Task that
is available between messages consumes no model calls merely by remaining open.

## Why each resource exists

| Resource | Information or responsibility it preserves | Boundary |
| --- | --- | --- |
| Task | An agent-owned assignment, admitted requirements, accepted contributions, Conditions and execution history. | Owns work and continuation. Human communication is optional. |
| Request | An accepted ask, its current scope, caller/answer relationship and disposition. Several messages may refine the same ask. | Tracks the commitment and response; execution and waits remain on Tasks. |
| Conversation | Messages, participants, reply relationships and discussion context across exchanges. | Useful for ongoing human or agent discussion. It does not schedule work or grant authority. |
| Topic | Optional grouping of related discussion, Requests and Task references. | A navigation/context aid, with no worker, completion state or delivery obligation. |

These roles do not imply four services or four new tables. An ordinary agent
request already has durable input and result correlation. That is sufficient
for a bounded assignment; it needs no extra conversational Request record.
A Conversation is useful when the exchange itself needs retained context.
Topics earn their place when a stream covers several subjects.

A Task can serve several Requests. One Request can involve several Tasks while
retaining one accountable Task for returning its overall answer. That Task may
be the Conversation handler or an explicitly assigned work Task. A Task link
alone does not transfer this responsibility. Separate Conversations may discuss
the same Task within their access scope; they do not acquire its execution state.

### What Request means in the current implementation

Today the name covers two related records:

- `TaskAppRequest` and admitted input preserve an addressed work call and its
  exact result relationship. The receiving Task performs the assignment.
- `AppConversationRequest` preserves an accepted conversational promise across
  messages, including scope, revision, Task references and an explained closure.

They share the idea of an ask and an answer, but they have different identities
and lifetimes. A human's request to deliver a change may lead to a narrower
agent request for review. Finishing the review does not fulfill the human ask.

Keep these existing records and relationships during the first implementation.
Use precise names in guidance and code where needed. Generalizing their meaning
does not justify a universal Request service, a second record for every call,
or a storage migration before a demonstrated use requires one.

## Two ordinary examples

### A human refines an ask while work continues

The human asks, "Fix the retry problem," then adds, "Also cover restart."
The handling Task's agent recognizes one Request with refined requirements.
Infra retains both inputs and the accepted scope; the agent need not invent
another Task merely because another message arrived.

The agent reproduces the issue, makes a change, requests review through the
ordinary Task request capability and retains a Condition for its return. It
continues testing while review is pending. A useful partial result can be
accepted and communicated while the remaining requirements stay open.

The responsible agent eventually judges whether the requested work is fulfilled
and supplies its explanation. Infra records that judgment and publishes the
reply through Conversation. Request fulfillment, Task closure and external
adapter delivery remain distinct facts. A new human ask can continue the
discussion without recreating the Conversation.

### An agent asks another agent for review

The coding Task submits an addressed review request. Infra delivers it to the
receiving Task and retains the return relationship. The caller adds a Condition
if it needs the result for later work; sending without a Condition does not
force it to wait. A supported direct helper can return within the same attempt.

The request and accepted result are enough for a straightforward review. If the
agents need several rounds of clarification, a scoped Conversation can retain
that exchange. A Topic is optional even then. The reviewer owns its contribution;
the caller retains its original assignment and judges what the contribution
means for that assignment.

The first implementation need not add a generic multi-agent chat service. It
should remove unnecessary human-only coupling while demonstrating this ordinary
request path without additional Conversation or Request bookkeeping.

## Agent decisions and infra promises

| Agent or declared App policy decides | Infra executes and records |
| --- | --- |
| Whether input refines an existing ask, introduces another ask or supplies evidence. | Original input, explicit associations and accepted scope revisions. |
| Which existing Task owns the work, or whether independent work is needed. | Admission, assignment, exact caller identity and result correlation. |
| What to say and to whom, and whether it answers an ask or reports partial progress. | Scoped publication, reply association, idempotent retries and delivery observations. |
| Whether to request help, keep working, wait or report a result. | Ordinary Task actions, Conditions, execution and recovery. |
| Whether the accepted ask is fulfilled, withdrawn or still unresolved. | The judged disposition, evidence/reason and associated answer without silently changing scope. |
| Whether discussion grouping is useful. | Optional Topic associations; execution never depends on them. |

The agent selects meaning and relevant recipients. It does not select Telegram
versus web, manufacture inbox keys, register a second return watcher or reconstruct
delivery links from messages. Infra derives identities from admitted input and
the executing Task. In an ambiguous mixed batch, the agent still selects which
inputs belong to which ask; bookkeeping cannot infer that meaning safely.

Accepted agent judgments are usable by default under the existing contract.
Acceptance is not guaranteed correctness or a new requirement for another LLM
to certify every result. A child contribution can be accepted while the larger
ask remains unfinished. An acknowledgment or partial answer does not silently
fulfill the whole ask, and a pending Condition does not globally prevent progress.

## One Task contract, with scoped communication capabilities

Retain the [ordinary attempt contract](../2a-design/task-attempts.md). A Task
handling messages can request work, retain Conditions, accept contributions,
continue, wait or report failure using the same meanings as every other Task.
An accepted conversational result must not mechanically imply convergence of
work that the agent explicitly says remains unfinished.

Communication adds these operations to the existing capability and admission
boundaries. These are semantic requirements, not new callable API names:

| Operation | Required behavior |
| --- | --- |
| Read relevant discussion and asks | Supply scoped context and exact reads; keep full accepted requirements available without dumping the whole history. |
| Record or refine an accepted ask | Preserve its input associations and current scope before consequential work; retain the change if the attempt later fails. |
| Publish an answer, question or progress | Bind the message to the intended recipient and ask using trusted context; record publication and expose transport failure independently. |
| Record an ask's disposition | Check authority and scope revision, preserve the agent's explanation and correlate the answer. Closure must not silently narrow the ask. |
| Organize discussion when useful | Update optional grouping without admitting, pausing, closing or redirecting work. |

Use the existing rule that live actions and actions supplied with the final
result go through the same admission semantics. Stable operation identity
prevents duplicate effects if an accepted live action appears again at finish.
Rejection remains correctable within the attempt where possible; final settlement
still validates current authority and revisions.

A final reply and Request closure must remain consistent. If a reply is published
live, later closure may cite that accepted message. If both are submitted at
finish, commit them consistently. A later failure cannot erase accepted input,
previous contributions or an already published reply, or falsely close an ask.
Saving the message establishes publication; provider delivery is a separate fact.
Transport failure remains visible and recoverable without rerunning completed work.

Authorization comes from the current assignment and explicit communication
scope. Being in the same Conversation, knowing a Request ID or appearing in
`taskRefs` does not grant permission to change someone else's promise or work.
The proposed default is that trusted admission binds the accepting Task to the
ask and its reply destination. An explicit assignment may carry that scope to
another responsible Task; a normal review request carries only its own return
scope, not permission to close the parent ask. Reuse these saved relationships
when checking a communication action instead of accepting model-supplied authority.
The accountable Task can communicate itself or request a contribution from a
designated communication Task; either uses ordinary Task execution. Ownership
and escalation retain the [existing agent/App boundary](../2a-design/agents.md#task-ownership-and-app-scope).

### Routing and recovery

Known Task replies and Condition answers use their exact saved return route.
Fresh unaddressed discussion can go to an ordinary intake Task under App policy.
Conversation ordering preserves conversational meaning; it does not serialize
all independent work discussed in that Conversation. Stop fences the selected
attempt. Cancelling work and withdrawing an ask remain separate decisions.

Operational findings go to an accountable Task under a declared App route.
They need no human Request, Topic or chat reply unless the agent identifies an
actual communication obligation. Reuse active investigation work when its scope
fits; a new report is not automatically a new Task. Exact duplicate delivery
reuses its receipt, while genuinely changed evidence remains available for judgment.

If the original Task cannot execute, its diagnosis must be able to reach an
available responsible Task independently. This is a requirement on the installed
route, not permission for core to invent repairs, transfer ownership or select
a supervisor. A dead Host still needs its installed operator/process recovery.
Publication, Task admission, owner consideration and verified recovery remain
separate evidence. Repeated failure samples update metrics; this proposal does
not introduce a model wake for every sample or a new periodic supervision loop.

## Current alignment and mismatches

The review inspected Apps source `458b0f1626` and Host candidate `da17e2cbc`
([PR #319](https://github.com/hao1939/may-agent/pull/319)). These are source
identities, not deployment receipts. Source paths below locate the reviewed
behavior and may change as implementation progresses.

| Current behavior and evidence | Assessment and proposed correction |
| --- | --- |
| [Task runtime](../../../may-agent/src/app/core/tasks/attempt-runner.ts) supplies claims, bounded attempts and recovery for Conversation too. | Keep it. There is no need for another scheduler or Conversation worker lifecycle. |
| [System Model](../2a-design/system-model.md#a-turn-or-a-task) presents a choice between a turn and a delegated Task. | Clarify the choice as continuing the current Task versus commissioning independent work. Keep interactive discussion natural. |
| [Conversation result](../../../may-agent/packages/sdk/src/app.ts) has one `followUp`, separate controls and Request updates; the attempt adapter returns it as `converged`. | Converge on ordinary Task execution decisions plus scoped communication effects. Remove special handoff restrictions through compatibility work. |
| [Request storage](../../../may-agent/src/app/core/state/conversation-requests.ts) retains scope/revision and closure without a scheduler, but authorizes updates through Conversation execution bindings. | Preserve the records and integrity checks. Authorize the responsible Task's scoped communication capability without requiring a special executor. |
| [May report routing](../../../may.app/app.ts) turns Evaluation publications and several operational notices into primary-Conversation input. | Declare ordinary responsible work routes; reserve conversational handling for the actual discussion/answer responsibility. |
| [Metric composition](../../../may.app/metric-follow-through.ts) translates ordinary Task decisions into the special Conversation result or another work handoff. | Remove that conversion when ordinary Task communication is supported; retain metric meaning and episode correlation. |

A read-only schema probe accepted an ordinary waiting result containing a request,
its return Condition and `continue: true`; Conversation's schema rejected the
same work decision. It also rejected a combined handoff and cancellation while
accepting either separately. This proves a contract difference, not an authorized
execution of those actions. Authority and identity must still be checked per effect.

The motivating runtime audit found that Evaluation diagnosed a broken Conversation
executor, but all 11 published reports remained pending in that same execution
path. This supports correcting routing; it does not show that Conversation Tasks
are inherently wrong or that ordinary Tasks cannot fail. PR #319's admission
guard remains necessary until a replacement input boundary is verified.

## Alternatives and costs

| Choice | Benefit | Cost or reason to decline |
| --- | --- | --- |
| Keep special Conversation execution and add another escalation exception. | Small immediate operational correction. | Leaves two work contracts and the same conversion burden in other capabilities. Useful containment, insufficient as the final boundary. |
| Give every Task a Conversation, Topic and conversational Request. | Uniform-looking object graph. | Adds records, context and synchronization without value for simple agent calls or autonomous work. |
| Merge all ask/call records into one new Request engine first. | A single public noun. | Risks a second lifecycle and a broad migration before shared behavior is proven. |
| Use ordinary Tasks with scoped communication capabilities. **Recommended.** | Reuses execution and preserves communication only where useful. | Requires careful authority, result-contract and retained-state compatibility work; benefits need a connected trial. |

The main tradeoff is replacing executor-specific restrictions with explicit
capability scope. Do not weaken authority merely to remove special cases. Retain
only communication context relevant to the Task, so reuse does not expand every
prompt. Human ordering and pending asks must survive the simplification.

## Incremental implementation and review

The immediate operational routing correction can use existing ordinary goal
admission and proceed independently. It need not wait for the capability
consolidation below, and it should not introduce another escalation protocol.

1. **Prove the common contract in an isolated fixture.** Run an ordinary Task
   with human input, a scoped accepted ask and a reply destination. Let it request
   review, keep its Condition, continue testing and publish partial progress.
   Reuse existing admission and action boundaries. Review the smallest necessary
   capability schema before teaching it as available.
2. **Consolidate the Conversation adapter.** Translate retained legacy decisions
   into the common contract without rerunning their effects. Preserve message,
   input, Request, Task and operation identities, exact returns and stop fences.
   Keep compatibility readers until saved work can resume. Remove the special
   `followUp` writer and forced convergence only after the common path is verified.
3. **Adopt the work routes in May.** Move operational handling to ordinary
   accountable Tasks, reuse matching active work, and remove metric result
   conversion. Keep human discussion and intentional human updates available.
   Repeated semantic-review selection is a separate policy issue: changing the
   receiver alone does not prove less review cost or timely intervention.
4. **Update the owning contracts and agent guidance.** Integrate accepted rules
   in System Model, message/Conversation contracts, Task attempts, escalation and
   the Task execution skill. Remove misleading turn-versus-Task wording and old
   App-owns-Task statements. Keep this proposal only for remaining decisions;
   archive implementation evidence separately.

Preserve accepted history and pending requirements during migration. Do not
interpret queued human replies, reopen closed work, or mark old input handled
merely because a route changed. Existing cancelled Conversation lineage and
successor identities remain readable; redesigning that history is not required.
The existing [standalone-agent Task proposal](standalone-agent-tasks.md) stays a
separate admission change. No production deployment or data repair is authorized
by accepting this design document alone.

## Evidence required before adoption

| Case | What must be demonstrated |
| --- | --- |
| Two messages refine one ask | Same accepted Request and fitting Task; both requirements remain readable after restart. |
| Several asks share a batch | One answer cannot silently fulfill an omitted ask; scoped partial acceptance preserves the rest. |
| Review is pending while testing continues | Ordinary requests/Conditions and continuation work with communication, without a special handoff or another Task solely to yield. |
| Simple agent-to-agent review | Exact caller result with no extra Conversation, Topic or conversational Request. |
| Live reply followed by failure/retry | Accepted publication survives; replay does not duplicate it; unfulfilled work and waits remain visible. |
| Request closure after a scope change | Stale closure is rejected; current agent judgment and explanation can be accepted without an extra completion judge. |
| Unauthorized reference | A copied Conversation/Request/Task identity grants no mutation or recipient authority. |
| Broken Conversation execution | An existing declared owner route reaches a working Task; diagnosis admission alone is not reported as handling or recovery. |
| Old follow-up and return after upgrade | Exact retained identities/results remain usable; no replayed effects, lost Conditions or silent reopening. |
| Human Stop and later input | Only the selected execution stops; published work and unresolved asks survive, and later input can continue through the supported route. |

Use portable deterministic regressions for identity, admission and restart.
Then compare bounded agent runs on a human refinement and an agent review:
requirements addressed, useful results, bookkeeping corrections, unnecessary
handoffs, latency and token cost. Source/schema checks do not establish agent
comprehension or live recovery. Lower cost is only an improvement with useful
outcomes and preserved obligations.

## Decisions to review

The recommendation is to accept the resource boundaries and incremental direction
above. Before implementation, settle the smallest public communication-action
shape, the concrete authority binding described above, and how legacy results
map into common admission without losing identity. Keep a standing intake Task
as an App convention, rather than a mandatory core Task for every Conversation.

Generic multi-agent discussion, participant management and unified Request
storage are future needs to demonstrate, not prerequisites for the first slice.
The [capability proposal](task-execution-capabilities-20261002.md) remains the home
for common discovery and agent guidance; this proposal supplies its work versus
communication boundary.
