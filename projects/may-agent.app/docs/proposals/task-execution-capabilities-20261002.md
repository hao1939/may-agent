# Agent capability guidance and infra contract

**Supports:** [Host And App Boundary](../2a-design/system-boundary.md). Connects needed agent abilities to guidance and dependable infra contracts.

**Choice basis:** [Simplest sufficient solution at acceptable cost](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff), [agent-first mechanism selection](../1-principles/code-vs-data.md#before-adding-runtime-behavior), and [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Draft for review, 2026-10-02; reorganized around project purpose on 2026-10-03.
**Implementation status:** Unimplemented for the proposed unified capability
exposure and caller reply choice. Existing Task, input, Condition and executor
mechanisms provide the foundation. This document changes no runtime behavior.
Proposed interfaces and observed implementation limits are recorded in
[the supporting contract reference](task-execution-capability-contracts-20261003.md).

## How to read this proposal

Start with the example and value below. Review [the remaining calling and discovery choices](task-execution-capability-contracts-20261003.md)
when assessing an interface change. Use [the current agent guide](../2b-manual/task-execution-guide.md)
to perform work today; its text is usable directly as a skill. The
[90-PR review](../archive/reviews/task-capability-pr-review-20261003.md) supplies
dated evidence, including successful behavior worth preserving.

## Purpose

This feature design supports [useful action within authority](../2a-design/system-model.md#enable-useful-action-within-authority)
and [continued work](../2a-design/system-model.md#carry-work-through-change-and-interruption).
The project purpose belongs to [May's goal](../1-principles/purpose.md#mays-goal):
useful results with decreasing supervision, acceptable total cost, and work that
remains understandable and steerable.

Its contribution is to give agents usable knowledge and actions while infra
handles execution and coordination. Agents can interpret changes, choose a
response to failure and carry work forward without administering delivery.
An honest blocker helps the human decide, but does not fulfill the original ask.

The design must enable four outcomes:

- **Useful judgment:** the agent has the knowledge, current facts and actions
  needed to choose an effective next step.
- **Dependable execution:** accepted decisions become actions and visible
  results, with routine coordination handled by infra.
- **Continued responsibility:** requirements and accepted work survive changes,
  waits and failures, so the agent can adapt without losing the assignment.
- **Reusable, affordable operation:** Apps add domain abilities on a shared
  foundation; agents and people spend less effort administering the work.

Every part below must contribute to one or more of these outcomes. For a new
part or change, explain the need, the value it adds, why the existing mechanism
is insufficient, and how we can observe the benefit. Merge, remove or defer a
part that adds no distinct value. Internal plumbing is justified by the contract
it enables; it need not become a concept the agent or human must manage.

### What would be enough

On representative work, an agent can understand the assignment, discover and
use an available action, continue independent work, and receive the result or
failure without arranging delivery. After interruption, it can use retained work
and incorporate corrections without losing unanswered requirements. The human
does not need to reconstruct the assignment or remind an owner to collect results.
Judge this alongside outcome quality, duplicate effects and total execution cost.

The existing Task model already supplies much of this foundation. This proposal
organizes its guidance and identifies missing behavior; its inventory is not a
list of new features to build. Repairs to existing promises and the proposed
reply convenience are separate changes. A common convention is worthwhile when
it removes repeated decisions or wiring, without requiring every capability to
use the same API shape. The [purpose and philosophy review](../archive/reviews/task-capability-pr-review-20261003.md#purpose-and-philosophy-review)
records the alternatives, costs and limits behind those choices.

## From an intention to a useful outcome

Consider: "Improve this change and get it reviewed."

1. The agent understands the requested outcome, current requirements and its
   authority. Infra supplies the relevant input, prior work and usable actions.
2. The agent makes the change and asks for review because the answer will help
   it judge the outcome. Infra accepts the request and retains its return path.
3. The agent runs tests while review is pending. A new requirement refines the
   same assignment; infra makes it reachable without losing earlier obligations.
4. If a read fails, the agent can choose another supported read. If execution
   stops, infra retains accepted work and provides it to a later attempt.
5. The agent uses the available evidence to decide whether to revise, continue,
   wait, ask for help or report completion. A pending review is a fact for that
   judgment; it does not independently dictate the decision.
6. Infra records the accepted judgment, applies the addressed request changes,
   and delivers the result. The human sees the outcome, evidence and remaining
   uncertainty without managing delivery or retry bookkeeping.

A straightforward answer may complete in the current Conversation. Independent
work uses a durable owner when it needs to outlive that execution. The system
should introduce only the coordination required by the assignment.

## Why each part exists

These parts are responsibilities, records and interfaces within the existing
system. Their value does not imply a separate service or agent for each row.

| Part | Value it provides | When it is needed |
| --- | --- | --- |
| Agent judgment | Turns an intention and evidence into useful actions, interpretations and completion decisions. | Understanding meaning, choosing an approach, assessing an outcome or changing course. |
| App guidance and policy | Supplies domain knowledge, assignments, authority policy and success conventions that can evolve independently of infra. | Applying the common execution foundation to a particular responsibility. |
| Conversation and accepted Requests | Keep discussion natural and retain the promises made to a human across turns. | Closing the loop on an accepted ask; routine observations need not create a promise or reply. |
| Current context and detail reads | Let the agent decide from current requirements and accepted evidence without rebuilding all history. | Starting, steering or resuming work; additional detail is read when relevant. |
| Discoverable capability contracts | Make useful actions understandable and callable while infra handles their execution mechanics. | Reading facts, performing operations, requesting contributions or communicating with a logical recipient. |
| App-authored workflows | Reuse a known procedure, reducing repeated planning while preserving places for agent judgment. | A procedure is useful across assignments; an ordinary action needs no workflow wrapper. |
| Task and retained inputs | Carry durable responsibility across executions, including unanswered requirements and accepted contributions. | Work needs continuation or later control; an ordinary bounded helper need not create its own Task. |
| Attempt and executor adapter | Run a chosen worker with usable context, tools and execution limits; allow it to stop without losing durable work. | Executing an agent, workflow or helper. One attempt can contain many actions and model calls. |
| Conditions and routed events | Return relevant changed facts without model polling or agent-managed delivery. | A result or external fact matters beyond a direct call. Waiting facts can coexist with useful progress. |
| Accepted results and receipts | Make progress reusable and responsibility inspectable after interruption or handoff. | Distinguishing acceptance, fulfillment and unresolved work; retaining evidence for later correction. |
| Metrics, diagnostics and evaluation | Make repeated failure, cost and missing progress available for an agent to assess and respond to. | Individual attempts cannot explain a trend, or an owner needs help. A recorded alert alone is insufficient. |

For example, a Condition earns its place because it preserves an interest in a
later fact and brings that fact back. It is unnecessary merely to describe a
short awaited read. An evaluator adds value by interpreting evidence and choosing
follow-through; another report that no owner can act on does not establish that
value. These tests apply to existing components as well as proposed additions.

## Division of responsibility

> Agent decides; infra executes.

The agent judges meaning, useful actions, fulfillment, repair and escalation.
The App packages domain guidance, capabilities and policies. A workflow executes
a defined procedure and asks an agent when judgment is needed. Infra supplies
usable facts and permitted actions, executes accepted decisions, preserves work,
delivers results and maintains state.

Infra can execute standing decisions, such as configured retries or observation
schedules, without another model call. It does not independently choose a remedy
or judge domain success. Trusted caller policy supplies authority; seeing Task
context does not grant it. Tasks and attempts are scopes and records, not
additional decision makers.

Delegation gives the receiver responsibility for the requested contribution.
The caller retains its original assignment. Choosing not to receive a reply
does not hand over that assignment or establish that it is fulfilled.
The agent judges whether accepted delegation is enough for its own assignment.

An accepted judgment is working truth by default. It normally settles the work
it addresses without a compulsory second judgment. Evidence and outstanding
facts remain available for correction; acceptance is not guaranteed correctness.

## Guidance for agents and workflow authors

Read [Working on a Task](../2b-manual/task-execution-guide.md) directly as the
agent's operating guidance. It teaches the current assignment, reads, actions,
Conditions and result contract through one example. Humans and agents use that
same document; do not maintain a second skill copy or inject this whole proposal
into every attempt.

The proposed additions below should make that work easier: discover useful
actions by purpose and express whether an answer is needed while infra supplies
the bookkeeping. Until implemented, use the exact schemas exposed to the attempt.
The four capability purposes organize discovery, not new services or work states.

## Infra feature and contract requirements

The desired capability surface must provide the corresponding behavior below.
The contract includes meaning, input/output schemas and runtime behavior.
Documenting a promise is insufficient without the feature that fulfills it.

| Guidance rule | Infra must provide | Acceptance example |
| --- | --- | --- |
| Assignment | Supply the assignment, admitted input, authority and exact result contract. Preserve source input/provenance; enforce scope at admission. | A helper sees parent context but cannot independently settle its parent's Task. |
| Current facts | Supply bounded current context, freshness/coverage markers and usable detail reads. Keep input visibility separate from fulfillment. | A newly visible requirement remains outstanding until an accepted result addresses it; failed refresh is marked explicitly. |
| Actions | Advertise only installed, permitted operations with input/result and lifetime semantics. Derive trusted caller identity. For durable work, save ownership and required return bookkeeping before confirming acceptance. | A required review reply reaches its caller after restart; no-reply work remains receiver-owned without a caller completion wake. Missing delivery support rejects visibly. |
| Progress and waiting | Retain accepted Conditions and required replies across attempts; observe and deliver changed facts. Keep observation status separate from the worker's execution decision. | A pending review allows testing to continue. A worker can yield for the saved answer without creating a second observer. |
| Judgment | Validate and record the worker's decision and derive Task state. Trust the App's judgment by default; preserve outstanding facts without adding an infra semantic veto. | An authorized, valid convergence decision settles addressed work even if a related Condition remains pending; both facts remain accurately recorded. |
| Resume | Own routine retries, backoff and recovery within existing execution bounds. Make replay of the same operation safe by default, preserving identity and accepted work. Enforce scope and stale-attempt fences. Disclose exceptions with recovery guidance and honest effect uncertainty. | Infra recovers a lost acknowledgment without asking the agent to resend: one admitted request, no duplicate effect. An unsafe external resend is exposed as an exception rather than silently replayed. |
| Failure | Return actionable validation/execution errors with available acceptance evidence. Retain correlated failures and usage for permitted reads, existing metrics and observation routes. Deliver evidence through the declared route and execute authorized repair/escalation actions. | An evaluator agent receives a recurring failure trend, judges whether investigation is needed and submits the chosen action; infra retains and delivers that work. |
| Consistent execution | Route live tools, SDK calls and supported final declarations through the owning admission implementation. Supply equivalent supported semantics through executor adapters. | The same permitted request has the same ownership and feedback through each surface; a live action does not end the attempt. |

Infra requirements cover enforcement, execution and records. The responsible
agent interprets facts and chooses a response. Its App supplies domain guidance
and configured routes. For failure review, the App/installation must identify
the reviewing owner and a usable path to it, including failures before the
assigned worker starts. Infra executes that declared route and retains its
delivery or admission failure. Metrics being available does not by itself
establish that a reviewer received the evidence or accepted an investigation.
Missing coverage remains explicit; infra cannot invent a supervisor or promise
that an agent will diagnose every pattern. See the existing
[ownership and intervention contract](../2a-design/system-boundary.md#ownership-and-intervention).

## Calling convention: intent and an answer choice

The caller decides whether it needs an answer. This preserves one receiver
request while letting infra supply the caller's bookkeeping automatically.
The proposed `reply: "required"` returns an answer directly or through a retained
return path; `reply: "none"` confirms accepted responsibility without creating a
caller completion dependency. Neither choice transfers the caller's original
assignment. Both report known acceptance or rejection; a lost acknowledgment
normally triggers recovery or retry of the same operation. Infra must not turn
it into a new request. If acceptance is still uncertain, retain that fact while
following the shared [retry and recovery contract](../2a-design/system-boundary.md#retry-and-recovery-ownership)
and its [declared exceptions](../2a-design/system-boundary.md#safe-retry-and-declared-exceptions).
A required answer can arrive later while other useful work continues. It
requests feedback; it is not an infra-enforced prerequisite for convergence.

This is a proposed convenience over existing request/Condition records, not an
implemented field in [PR #285](https://github.com/hao1939/may-agent/pull/285).
That PR retains the current `state`/`continue` result format. Use the exact
installed contracts until a paired change introduces a new interface. The
[calling contract](task-execution-capability-contracts-20261003.md#calling-convention-intent-and-an-answer-choice)
owns the example schema, return behavior and workflow semantics.

## How we judge the design's value

Check ordinary successes, recovered failures and unresolved cases. A stored
result or a healthy process is insufficient evidence of a fulfilled requirement.
Likewise, a useful assessment can finish while the problem it identifies remains
unresolved. Use the same distinction when judging the design itself.

| Intended value | What to look for in representative work |
| --- | --- |
| Useful judgment | Appropriate actions and outcomes; corrections incorporated; missing evidence distinguished from a negative result. |
| Dependable execution | Accepted work reaches its owner; results return; correctable errors reach the worker; accepted finish stops further execution. |
| Continued responsibility | Unanswered requirements and independent waits survive interruption; a later attempt can adapt using prior evidence; recurring failures reach a judging owner. |
| Reusable, affordable operation | Less human coordination and agent bookkeeping; Apps and executors reuse the same contracts; prompt, retrieval and execution costs improve without degrading behavior. |

Compare like-for-like assignments and inspect the actions as well as the final
answer. The [90-PR review](../archive/reviews/task-capability-pr-review-20261003.md) provides evidence
for the contract, including retained finished work and recovered failures. Its
matched context comparison reduced model calls from 227 to 152, while full
behavioral acceptance fell from 29/30 to 27/30. Cost and quality need separate
measurement; fewer calls alone do not establish an improvement.

These are review questions for existing trials and observations, not a requirement
for a new scoring service. Structural checks establish infra behavior; comparable
model trials and observed work establish whether the agent uses it effectively.

### Behaviors to preserve and teach

The [positive evidence review](../archive/reviews/task-capability-pr-review-20261003.md#successful-behavior-to-preserve)
includes completed work, recovered mistakes and appropriate decisions to wait
or leave existing work unchanged. Use these as on-demand guidance examples:
incorporate a correction into the same assignment, try a supported alternate
read after failure, complete the addressed work while retaining independent
obligations, and reuse an existing result or investigation when it remains
relevant. Let the agent judge when new evidence warrants a different action.

Keep normal work simple: use the existing assignment defaults, retain unchanged
Conditions automatically, and trust accepted results without a compulsory
second judgment. Compare successful behavior as well as failure recovery when
changing prompts or adapters. Less context or fewer tokens is useful only in
conjunction with fulfilled requirements and appropriate actions.

## Supporting contracts and evidence

The [operating guide](../2b-manual/task-execution-guide.md) is directly usable
as agent guidance. This proposal describes desired infra additions and their
value. Exact contracts and App knowledge remain available on demand. The
[authoring guide](../2b-manual/design-authoring.md#make-guidance-usable-by-agents)
owns how one document serves human and agent readers.

- [Supporting capability contracts](task-execution-capability-contracts-20261003.md): discovery, calls, workflows, Conditions, live/final actions, context delivery and implementation checks.
- [Review against 90 PRs and successful work](../archive/reviews/task-capability-pr-review-20261003.md): evidence, limitations and verification priorities.
- [System model](../2a-design/system-model.md) and [Host/App boundary](../2a-design/system-boundary.md): the existing ownership and execution foundation.
- [Attempt input/output proposal](task-attempt-decision-schema-20261002.md): current #285 contract and deferred schema proposals.

## Smallest next implementation

Start with one real assignment: request a change review, continue testing,
incorporate a correction and use the returned contribution. First establish
that path using installed schemas. Inspect what the actual worker can read
and call; repair the first missing context, action or return connection through
its existing owner. A native worker needs a usable bridge for that operation
if it is the worker chosen for the assignment. A complete bridge for every
capability and executor is outside this first change.

Then trial the proposed reply choice on that same request. Let infra fill the
existing caller bookkeeping. Compare required reply with no reply: both retain
the receiver's contribution; only the former owes a caller result notification.
Keep the current result schema and explicit observation mechanism. Human
messaging uses its own delivery contract and gets a separate trial when changed.

Check fast results, lost acknowledgment followed by safe retry, interruption
after acceptance, receiver failure and late
results after closure through normal admission and return paths. Check ordinary
success and agent behavior too: useful testing continues, corrections remain
accounted for, and accepted work is reused when appropriate. Review the chosen
capability's failure route; a delivered investigation is evidence of review,
not proof that the original problem was repaired.

This milestone is sufficient when the path works without manual return wiring
or rescue, preserves the existing successful behaviors, and reduces repeated
caller bookkeeping at acceptable cost. Measure comparable outcome quality,
human interventions, duplicate work, calls/tokens and retrieval cost before
claiming improvement. If a smaller guidance or wiring repair suffices, stop
there. Expand only for another demonstrated need; do not couple this work to a
universal dispatcher, catalog service, result-schema migration or new monitoring
system. These remain proposed checks, not results of a new execution trial.
