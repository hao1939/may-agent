# Design: Telegram Channel

**Design status:** Accepted.
**Implementation status:** Partial; the deployed path implements stable
conversation identity, inbound/outbound trace links, bounded ordinary turns,
concurrent reply targets, immutable per-session reply context, restart-safe
reply lookup, exact per-tool caller identity, and a narrow May-owned CLI
completion fallback. Proactive messages, alerts, and child-session summaries
now wait behind May's enforced admission review. Its seven approved Gym cases
pass all deterministic gates and both semantic judges. Broader async
completion handling still remains. Fresh Telegram turns receive exact
trace/task focus, latest durable evidence, and bounded nearby conversation.
One fresh May review also wakes when a human-linked app task converges or needs
attention. An integrity check keeps a terminal human-linked task visible
until that May closeout is delivered.

## Purpose

Telegram is the mobile human-control surface for May-agent. It should feel like
talking to the system, not operating a separate bot UI.

The channel has three jobs:

1. Let the human ask questions and steer active work.
2. Notify the human only when attention is useful.
3. Turn every human reply into tracked input with enough context for the
   receiver to act.

The rule is:

> Telegram replies provide a visible anchor. May-agent resolves that anchor to
> the durable trace and owner task, then gives May the relevant conversation
> context. Human text stays plain.

The first priority is understanding the human's intention. A question, request
for explanation or advice, correction, or uncertain response is not a project
decision. If the intention is clear, continue. If it is uncertain, state the
likely interpretation, answer what the existing context supports, and ask one
focused question. Keep consequential state pending until the intention is
clear.

## Implementation Posture

Telegram ingress, delivery, stored reply metadata, exact short controls, and
May attention enforcement exist. The gate fails closed and sends only May's
reviewed text. Its approved Gym proof and live rollout proof are complete.
Complete owner-task conversation resolution, session-independent completion,
reviewed closeout, narrow command failure, and noise control remain convergence
work.
The current gap list lives in
[human-control-surfaces.md](human-control-surfaces.md#runtime-convergence-gaps)
so this accepted contract stays focused on target behavior.

## Outbound Human Inbox Deputy

May owns the human inbox. A producer may propose human attention, but it does
not decide that Hao must be interrupted. Before proactive text reaches
Telegram, May must understand the intended outcome and choose one disposition:

| Disposition | Meaning | Human delivery |
| --- | --- | --- |
| `handle` | May can safely complete, dismiss, retry, record, or merge the work into an existing semantic record under delegated authority. | No |
| `route` | A project, runtime, or specialist owner must act first. | No |
| `clarify-producer` | The proposal lacks the exact decision, proof, owner attempt, or consequence needed for judgment. | No |
| `reject` | The request is stale, unsafe, secret-bearing, or outside the human channel contract. | No |
| `deliver` | A real human authority, preference, or private-input boundary remains after owner work. | Yes |

This is stronger than a notification filter. May must push the underlying work
forward. Suppressing a message while leaving its task or escalation orphaned is
a failure. A handled or routed proposal records what May did, who owns the next
move, what proof will close it, and when it should be reviewed again.
For recovered work, that means recording the recovery evidence and closing the
transient record; a statement that no action is needed is not closure by
itself.

### Flow

```text
owner, workflow, evaluator, handler, or digest proposes human attention
  -> persist the original event and trace
  -> route the candidate to May's human-attention inbox
  -> May reads the current issue, owner state, prior attempts, and duplicates
  -> May chooses handle, route, clarify-producer, reject, or deliver
  -> record the review disposition against the original event
  -> only a deliver disposition creates an admitted outbound notification
  -> Telegram stores and sends the admitted message
  -> any human reply returns through the existing intention-first reply path
```

`message.created`, `escalation.created`, project approvals, and their existing
closure events remain the domain lifecycles. The deputy review is an admission
and audit fact, not another approval, task, or escalation lifecycle.

Direct responses to a Telegram turn are already solicited conversation and do
not enter the proactive-attention queue. Proactive digests may use a reviewed
deterministic policy, but the policy is still owned by May and must preserve the
same secret, deduplication, and expiry rules.

### May's decision order

May reviews a candidate in this order:

1. Recover the original issue, requested outcome, accountable owner, current
   state, expected closure, and semantic identity.
2. Check whether the issue is already resolved, superseded, duplicated, or
   waiting on a current exact condition.
   A duplicate of valid open work is `handle`: merge its new evidence into the
   existing record and preserve the original owner. It is not a new human
   request. Attach the new run evidence to that record. Deliver an update only
   if the commit, checks, required action, or decision meaning materially
   changes.
3. Ask whether May can safely handle it under established delegation.
4. If another owner can act, route it there and require closure proof.
   A failed validation closes with a passing rerun or a precise blocker;
   diagnosis or a claimed fix alone is progress, not terminal proof. May
   reviews the returned result.
5. If the producer has not supplied enough evidence, ask the producer for the
   missing facts instead of making Hao reconstruct them. A destructive or
   cleanup proposal is judgeable only when it names the exact affected objects,
   accountable owner, current state and proof, and final safety check. May
   reviews the completed packet again before acting or delivering it.
6. Reject requests that ask for secrets through Telegram. Route authorization
   and credential retrieval through the accountable runtime owner and secure
   credential surface. Follow the work until access and the diagnostic finish,
   or until a real authorization decision remains. Record both checkpoints;
   merely saying the diagnostic proceeds is not closure proof.
7. Deliver only when an exact human decision remains. Recommend a choice when
   current evidence supports one.

May may handle routine operational recovery, low-risk Git-backed cleanup,
duplicate suppression, stale-state repair, owner routing, and status
explanation. May must preserve human authority for undelegated policy,
preference-sensitive benchmark truth, spending, sensitive-access
authorization, broad irreversible change, and an explicit approval contract.
May may prepare and recommend those decisions; May cannot silently submit them
on Hao's behalf.

### Convention over configuration

Any existing `message.created` addressed to `human` or `human:operator` is a
candidate automatically. Producers do not register with the deputy, select a
policy, create a deputy task, or enter another lifecycle. They should include
the owner, requested outcome, evidence, and a stable domain identity when those
facts already exist. Missing facts cause May to inspect the trace or return the
proposal; they do not create more configuration.

May records one correlated `human.attention.reviewed` audit event. It contains
the source event id, disposition, understood intent, reason, next owner or
action, and the proposed delivered text when delivery is justified. This event
is a review fact, not a task, approval, or message lifecycle.

The understood intent describes what the producer proposes; it does not adopt
that proposal as May's instruction. The disposition, reason, next action, and
delivered text must not contradict one another.
Constraints also preserve time: “take no action during this review” remains
compatible with a bounded future action after explicit approval. Record that
condition instead of turning the review restriction into a permanent ban.

Use existing identities for deduplication in this order: approval id, blocker
id, conversation id, repository + pull request + required action, or a stable
producer key. Run ids, timestamps, session ids, and wording changes never make
the same issue new. Add a new identity mechanism only after real failures show
that these conventions are insufficient.

The Telegram transport has one admission check. In shadow mode it sends the
current message and records what May would have done. In enforcement mode it
delivers only a successful `deliver` review. Review failure preserves the
candidate and fails closed. Direct conversation responses bypass this check.

Attach this check after May is registered but before opening socket/HTTP
ingress or starting cron work. A durable event accepted before the admission
subscriber exists is still a silent drop from the deputy, even if another
transport prints it.

### Decision packet

When May chooses `deliver`, the human message contains only what Hao needs to
decide:

```text
Decision needed
Approve the exact Gym scorer change?

May recommends
Approve.

Why you are needed
This changes the approved meaning of May's evaluation.

Proof
May chose the correct cleanup in all three trials. Only the wording-based
scorer failed. The scorer self-test and regression controls pass.

Reply
approve — apply this fingerprint and run a fresh baseline
reject — keep the current scorer and revise the proposal

After your reply
May will apply the decision, verify the new baseline, and report the result.
```

The required parts are:

1. one decision in plain language;
2. May's recommendation, or a clear statement that evidence is balanced;
3. the exact reason human authority is required;
4. the minimum proof needed to judge the recommendation;
5. bounded options with consequences;
6. what May will do and verify after the reply.

These parts apply when a human decision remains. An accepted digest is an
information delivery, not a decision packet. It states the useful facts and
never invents approve/reject choices, a recommendation, or a pause threat.

Keep a decision packet at 120 words or fewer and a requested digest at 90 words
or fewer. Internal suppression notes should normally fit within 80 words. The
after-reply step
preserves the exact approved scope and named proof. A generic canary or health
check does not replace a promised fresh baseline or other explicit result.
Compactness removes repetition and internal detail, never a proof fact needed
to explain the current failure or judge the recommendation.

Reject vague menus such as “accept, assign an owner, provide input, or hold.”
May should know the owner and the missing input before interrupting Hao. Ask
one focused question.

### Examples

| Candidate | May disposition | Result |
| --- | --- | --- |
| One handler timeout followed by a successful retry | `handle` | Record recovery; include it in the ops digest. |
| Provider failure with an accountable project owner and recovery condition | `route` | Wake the owner and track the later recovery proof. |
| “Approve cleanup of some stale files” without exact paths or current proof | `clarify-producer` | Ask the producer for bounded scope and proof. |
| A current, proven Gym scorer change whose truth is preference-sensitive | `deliver` | Recommend a choice and send the exact decision packet. |
| Request to paste a base64 kubeconfig into Telegram | `reject` | Route the runtime owner to the secure credential surface. |
| The same pull request reported again under a new campaign run | `handle` | Update the existing semantic record; send nothing unless the required action changed. |
| Requested daily Ops or Scout digest | `deliver` | Send the compact digest under its accepted policy. |

### Failure behavior

If May's review fails, preserve the candidate and retry through the May/runtime
owner. Keep raw text internal. A review failure never turns into automatic
human delivery. For urgent candidates, use a short bounded retry and a safe
structured fallback assembled only from validated fields.

Every admitted notification expires or closes. A later review should dismiss
resolved and superseded candidates instead of reopening them.

### Regular behavior review

Gym's daily Telegram field review reads proactive candidates and May's
`human.attention.reviewed` facts. It compares the proposed message, May's
disposition, any delivered text, owner handoff, closure evidence, and a later
human correction when one exists.

The runtime schedule and durable checkpoint are active. The 2026-07-30 run
reviewed 11 completed interactions and retained five strong signals: three
positive examples and two actionable gaps. Enforcement rollout must verify
that the scanner continues to interpret `admitted`, `delivered`, owner action,
and closure fields correctly.

Review every critical failure and a small sample of successful decisions.
Prefer strong reusable evidence over volume. Classify the responsible layer:
May judgment or knowledge, Telegram routing, the producer or owner workflow,
the evaluator, or runtime. Strong evidence may draft a lesson, benchmark, or
incident, but it never changes approved truth automatically.

`may-agent.app` owns the shared transport, review execution, recovery, and
health of this convention. May states the intended platform outcome and proof;
the existing `tech-lead` owner diagnoses and implements platform changes.
Underlying project work remains in its accountable app. Do not copy routed
work into the `may-agent.app` task tree.

### Proof before rollout

Replay recent Telegram candidates before enforcing the gate. The proof set
must include recovered handler errors, project-owned product failures, weak
approval packets, a valid Gym approval, a secret request, duplicate pull
request notices, and accepted digests.

The enforcement candidate has transport and end-to-end regression proof. On
2026-07-30 all seven approved Gym cases passed all eight deterministic gates
and both semantic judges. Two incomplete closure answers were correctly
rejected; a small May checklist fixed both reruns. Recent replay suppressed a
recovered timeout and preserved the accepted Ops and Scout digest, with no
critical authority violation in the proof set.

Hao approved enforcement rollout. Runtime commits `ac7bc76e` through
`4eeb6bf3` were deployed on 2026-07-30. The first smoke exposed a startup race:
the control socket accepted events `4666830` and `4666832` before Telegram
admission subscribed. Commit `a93fbd7f` moved admission ahead of external
ingress and cron startup and added an ordering regression. The clean deployed
binary hash is
`19df585a748dab1b5876b20785f5eea779294342ce5929b2cd10c8feb01b1b63`.

Post-fix source event `4667365` immediately started a live May review and
produced enforced audit event `4667420`: `admitted=false`, `delivered=false`.
No Telegram notification row or Telegram delivery event was created. May
omitted required action/closure fields twice, so the runtime recorded review
failure and still failed closed. Keep that behavioral miss in the daily Gym
review; it does not reopen transport rollout.

Measure:

- correct `handle` / `route` / `clarify-producer` / `reject` / `deliver`
  judgment;
- zero critical authority violations;
- zero secret-bearing human messages;
- human-required precision;
- semantic duplicate suppression;
- time from proposal to owner action or human decision;
- closure proof after May handles or routes a proposal; and
- completeness of delivered decision packets.

Start in shadow mode: record May's disposition while current delivery remains
unchanged. The existing daily review measures disagreements and closure. Enable
admission enforcement only after the approved Gym cases and recent replay show
zero critical authority violations. Production changes stay Git-committed so
rollback is a normal revert.

Keep release proof separate from May's lessons. The held-back transfer suite
tests new wording and mixed cases: stale urgency after recovery, a real spending
decision after owner proof, a materially changed duplicate, a useful digest
with one secret-bearing item, a cleanup that became bounded, and a balanced
preference decision. Hao reviews each case in plain language before its label
changes from `draft` to `approved`. Draft cases do not authorize enforcement.

## Reply Context Model

There are three separate layers. They must not be collapsed into one string.

```text
Human-visible Telegram text
  Plain language only. It describes the situation and the decision needed.

Received event metadata
  `human.input.received.data.context` stores channel context such as
  `conversationId`, `originalIssue`, `expectedClosure`, and notification
  summary fields.

Internal delivery message
  The context reader combines the human reply with the focused trace, owner
  task, evidence, and relevant messages for a bounded May turn.
```

The received event keeps human text and metadata separate. A minimal envelope
looks like:

```json
{
  "type": "human.input.received",
  "data": {
    "text": "approve",
    "conversation": {
      "id": "telegram:chat:12345:topic:0:agent:may",
      "channel": "telegram",
      "channelMessageId": 511
    },
    "context": {
      "telegramReply": {
        "traceId": "trace-approval-123",
        "parentEventId": 510,
        "taskId": "approval-123"
      }
    }
  }
}
```

Any prepared prompt is a system-generated view, not human-authored text. Keep
the structured links on routed events so reports and health checks can verify
closure without parsing prose.

## Priority 1: One Logical Human Conversation

The first priority is smooth communication and no lost replies:

> Human channels emit canonical input events. The command router uses attached
> context to resolve the request, then starts a bounded May turn with prepared
> context.

Telegram, Web UI, and default terminal input all address one logical
conversation with May. That conversation may use many bounded sessions.
Telegram reply chains are anchors into request traces, not session bindings.
Only an explicit execution-control command such as `/steer <session> <message>`
targets a live session directly.

Terminal can be more flexible: normal text starts a bounded May turn, while
operator/debug commands may attach to other sessions explicitly.

May owns the human-control channel by default. A normal reply goes to a bounded
May turn with source, focused request, owner state, and relevant messages
attached. May first decides whether the human is deciding, asking, correcting,
steering, starting unrelated work, or expressing uncertainty. May then decides
how to handle it:

- fix the issue directly,
- delegate to another agent,
- resume the original session,
- emit a project or escalation event,
- ask the human a follow-up,
- or close the conversation with a result.

This keeps every user interface simple. The transport does not need to know
whether a reply should become a project event, an escalation resolution, or a
new investigation. It only needs to preserve local context and emit
`human.input.received`.

Transport boundary:

- Store every inbound and outbound Telegram message id, its reply target, and
  its trace/task links.
- Store that context for every chunk of a split message and carry it through
  delivery acknowledgements so a follow-up stays attached.
- On reply, recover that context from `reply_to_message_id`.
- Attach conversation/session/notification context to `human.input.received`.
- Use the Telegram reply chain as a human-visible anchor, never as the durable
  request identity.
- Do not execute project decisions, classify approvals, or repair blockers in
  transport code. May and project agents do that work.

The only direct approval path is a deliberately narrow command grammar for an
exact advertised reply such as `approve`, `reject`, or `hold`. This is a
control command, not natural-language inference. A longer, mixed, questioning,
or uncertain reply must reach May with the original issue attached. The router
must never default an unrecognized reply to a decision.

May turn rule:

```text
human input from Telegram
  -> recover the replied-to message when present
  -> resolve its trace/task through the conversation view
  -> start one bounded May turn with prepared context
  -> let May understand the intent and act
```

An explicit `/steer` command may target a named active execution session. A
normal reply never goes to whichever May or worker session happens to be
current.

The local channel context needs a small envelope:

```ts
interface TelegramConversationContext {
  // Stable logical conversation: agent + Telegram chat + optional topic.
  conversationId: string;
  // Durable request causality when this message belongs to known work.
  traceId?: string;
  parentEventId?: number;

  originalIssue?: {
    eventType?: string;
    eventId?: number;
    sourceAgent?: string;
    sourceSessionId?: string;
    projectPath?: string;
    taskId?: string;
    reason?: string;
    requestedAction?: string;
  };

  lastHandledBy?: {
    agent?: string;
    sessionId?: string; // execution hint only; never durable routing state
  };

  expectedClosure?: string[]; // e.g. ["escalation.resolved", "project.owner.requested"]
  staleAfterMs?: number;
}
```

Human-visible text is not routing data. Prose like `From: aks-explorer` or
`Project: aks-rp-e2e` is useful to the human, but the router should use stored
conversation, trace, event, and task links to enrich May's input.

Recommended flow:

1. Human replies to a Telegram message.
2. Router looks up `reply_to_message_id` in `notification_messages`.
3. Telegram emits `human.input.received` with the human reply in `data.text`
   and recovered metadata in `data.context.telegramReply`.
4. Command router builds the internal delivery message by combining the human
   reply with a compact attached-context block.
5. If the reply is an exact short approval command, command router may emit the
   typed approval with the stored exact identity, project target, and current
   app owner. The human-facing May owner must not replace the app owner on the
   returned decision event.
6. Otherwise, approval and escalation replies go to May so May can understand
   the human's intention before changing state.
7. For normal language, command router starts a bounded May turn with the
   resolved request, stable `conversationId`, incoming `channelMessageId`, and
   relevant conversation context. These values are immutable session context,
   not a shared "next reply" slot. Only an explicit session-control command
   targets an execution session directly.
8. May answers, delegates to the app owner, changes direction, asks one focused
   question, or closes the request.
9. Transport replies to the incoming human message for an immediate answer.
   A result from a known source session replies to the human message that
   started that session. Other later progress or closeout replies to the latest
   human message in the same trace, falling back to the original request. It
   stores the new message with the same links.

For a late result that carries an exact `sourceSessionId`, source-session
routing is authoritative. Recover its persisted `channelMessageId`; for old
records accept `requestId` only when it is exactly
`telegram:<positive message id>`. If neither is valid, send standalone. Reject
the tempting fallback to a newer message on the shared trace, because a visible
standalone result is safer than a confident reply to the wrong request.

This preserves natural conversation without depending on a persistent May
session.

### Conversation Examples

Message sent while May brokers a project escalation:

```json
{
  "conversationId": "telegram:chat:12345:topic:0:agent:may",
  "traceId": "trace_escalation_100",
  "originalIssue": {
    "eventType": "escalation.created",
    "eventId": 100,
    "sourceAgent": "aks-explorer",
    "sourceSessionId": "s_blocked",
    "projectPath": "projects/aks-rp-e2e.app",
    "reason": "No ready work while gaps remain.",
    "requestedAction": "Ask human how to proceed."
  },
  "lastHandledBy": {
    "agent": "may",
    "sessionId": "s_may_broker_456"
  },
  "expectedClosure": ["escalation.resolved", "project.owner.requested"]
}
```

Plain May chat response:

```json
{
  "conversationId": "telegram:chat:12345:topic:0:agent:may",
  "traceId": "trace_human_turn_789",
  "lastHandledBy": {
    "agent": "may",
    "sessionId": "s_chat_789"
  }
}
```

### Message Responsibility

The component that sends a human-facing message should provide:

- `conversationId` for the logical Telegram chat/topic with May
- `traceId` when continuing a known human request
- `originalIssue` when the message is about an escalation, project, task, or
  blocked session
- `lastHandledBy` when May delegated or resumed work
- `expectedClosure` when the producer knows what event should eventually close
  the loop

Telegram transport should not infer ownership from prose. It may keep best
effort fallback for legacy messages, but new messages must carry conversation
context.

### Original Session Gone

If the original or last-handling session is gone, the reply is still not lost:

```text
reply to Telegram message
  -> read conversationId + traceId + originalIssue
  -> emit human.input.received with attached metadata
  -> assemble current owner task, evidence, and relevant messages
  -> start a fresh bounded May turn
  -> May decides whether to resume, delegate, replan, or ask follow-up
  -> May confirms what happened
```

The fallback prompt should be compact:

```text
Human replied in Telegram conversation telegram:chat:12345:topic:0:agent:may.
Focused request trace: trace_escalation_100.

Original issue:
<structured issue summary>

Human reply: <reply>

Handle the reply. Close or update the original issue when done.
```

Do not silently drop the reply if the previous worker/project session cannot be
resumed. Session loss is irrelevant to request ownership and human follow-up.

### May As Broker For Escalations

It is acceptable, and often desirable, for `escalation.created` to route to May
first. May is the human-facing broker and can decide whether the issue needs a
human, another agent, or an automatic repair.

When May reaches out to the human, the human reply starts a bounded May turn
with Telegram reply-chain context attached. May's
notification must include the original escalation as `originalIssue`, so May can
fix, delegate, resolve, or replan the real problem.

May does not have to emit `escalation.resolved` immediately. It may first
investigate and fix the issue. But the reply must stay attached to the original
issue until May emits one structured outcome: resolved, dismissed, routed to the
project owner, or converted into an exact follow-up wait.

Escalation replies have one extra routing rule:

> `sourceSessionId` is resume context, not the Telegram reply target.

For a human-owned escalation, the reply must go to May first. May is the
human-facing decision agent: it reads the human reply plus restored context,
decides the next event, and emits the structured closure or follow-up. Only
after a terminal event does the escalation lifecycle resume the original source
session.

```text
human reply
  -> human.input.received(context.originalIssue.eventType = "escalation.created")
  -> fresh May turn receives the trace and current escalation state
  -> May emits escalation.resolved, escalation.dismissed, or an exact follow-up
  -> escalation-lifecycle resumes sourceSessionId/checkpointRef
```

The notification may store `sourceSessionId` inside `originalIssue` and
`resume`, but it should not store that value as the direct reply `sessionId`.
If legacy rows do contain it, command-router should prefer the
`expectedClosure`/`originalIssue` rule and route the reply to May rather than
steering the source session directly.

## Notification Context

Keep the existing `notification_messages.data` JSON blob, but standardize its
shape. This avoids a schema migration while giving the router a reliable
contract.

```ts
interface TelegramNotificationData {
  text: string;
  summary?: string;

  subject?: string; // "AKS RP E2E focus approval"
  kind?: string; // "approval" | "blocker" | "failure" | "digest" | "session"
  severity?: "P0" | "P1" | "P2" | "P3";

  projectPath?: string;
  sessionId?: string;
  taskId?: string;
  eventId?: string;

  conversationId?: string;
  conversation?: TelegramConversationContext;
  actionHints?: string[]; // ["approve", "adjust <changes>", "hold"]

  staleAfterMs?: number;
  dedupKey?: string;
  supersedesKey?: string;
}
```

New producers should prefer trace metadata when the related event id is known.
`conversationId` plus `conversation.originalIssue` remains useful
transport context, but it should not become a second lifecycle identity.
Telegram transport should not execute the domain decision itself.

## Routing Rules

Reply routing should stay deterministic:

1. If the human message replies to a Telegram message with a stored
   `conversationId`, attach that id and its context to
   `human.input.received.data.context.telegramReply`. If the stored message has
   a source event id, set the received input event's `trace.parentEventId` to
   the message event id and preserve the same `trace.traceId`.
2. Else if it replies to a stored notification without `conversationId`, attach
   the stored notification/session context as legacy fallback.
3. Else if it replies to a Telegram quote with no DB row, build a quote fallback
   context from the quoted text.
4. Else if it is a bare Telegram message, resolve a clearly named subject or
   the only plausible open request. If neither applies, treat it as a new turn;
   if several consequential requests fit, ask one focused question.
5. Legacy notifications without a conversation envelope should still be
   delivered with the stored notification/session context.
6. Command router is the boundary that turns the received event into a bounded
   May turn or an explicit typed control. It must not select a mutable current
   session.
7. Project-specific events, escalation resolution, session resume, and task
   steering beyond the direct session target are agent/owner decisions after the
   receiver sees the enriched delivery message. Those decisions should emit
   normal events linked back to the human input event.

If the notification is stale, do not silently execute it. Send a short message:

```text
That request is stale. I opened a fresh status check instead.
```

Then emit normal May input with the stale context attached.

## Intention Handling

Human replies are not limited to the options shown on an action card. A reply
may be a decision, a question, a correction, a request for May's recommendation,
or a combination of these.

Use this order:

1. Recover the original issue and current decision boundary.
2. Understand what the human is trying to achieve.
3. Answer any question that current evidence already supports.
4. If the intended next action is uncertain, state the likely interpretation
   and ask one focused confirmation.
5. Emit a decision event only when the decision meaning is clear and its exact
   identity is current.

Examples:

- `approve` -> submit the exact current approval.
- `What is this about? What do you suggest?` -> explain, recommend, and keep the
  approval pending.
- `I think path five is active` -> treat it as a correction, investigate, and
  do not approve or adjust by inference.
- `Maybe. Can you prove rollback first?` -> provide or obtain the proof, state
  the likely intent, and ask one focused confirmation if needed.

## Human Channel Adapters

For now, do not introduce a new built-in service concept. The simpler rule is:

> Human channels are platform adapters. Normal input starts a bounded turn in
> the logical May conversation; only an explicit execution target uses the
> steer path.

Each adapter should stay small:

```text
Telegram adapter
  -> inbound Telegram messages
  -> outbound Telegram replies/notifications
  -> Telegram message id context store

Web UI adapter
  -> browser chat input
  -> May chat stream
  -> links to project/task/event pages

Terminal adapter
  -> default input to bounded May turns
  -> explicit attach/debug commands for other sessions

Read-model command adapter
  -> /status, /projects, /tasks, /sessions
  -> fast deterministic responses without starting extra LLM work
```

Adapter responsibilities:

- Accept human input from one channel.
- Add channel-local context, such as Telegram reply-chain context.
- Resolve the focused request and start a bounded May turn.
- Deliver May output or acknowledgements back to the human when appropriate.
- Provide fast read-only commands where a full May turn is unnecessary.

Adapter non-responsibilities:

- Do not decide project plans.
- Do not classify approvals.
- Do not repair blockers.
- Do not own project task trees.
- Do not replace project/domain UIs.

This keeps the current architecture simple:

```text
human channel adapter
  -> conversation context reader
  -> bounded May turn
  -> May decides/delegates/emits events
  -> adapter delivers visible result when needed
```

Projects may still provide their own domain UI under project routes, but that UI
should call stable project actions or emit project events. It should not reach
into human-channel adapter internals.

If Telegram, Web UI, and terminal later duplicate too much code, we can factor
shared mechanics into a built-in human-interface module. That should be a
refactor after the adapter boundaries are clear, not a design requirement now.

## No Silent Drops

Every Telegram input receives one useful human-visible response, but the
transport does not add a redundant acknowledgement before a fast May answer.

- If May finishes in the current turn, that answer is the confirmation.
- If work continues, May sends one acknowledgement after an app owner or
  tracked async worker accepts it. The message states the understood outcome
  and whether the human needs to act.
- When the work finishes, May sends one reviewed closeout with evidence.
- If durable ownership cannot be established, May reports that exact failure
  instead of promising a later result.

Example:

```text
Understood. The platform owner is investigating the repeated replies. I will
review the root cause, regression proof, and rollout result. Nothing is needed
from you now.
```

The deployed path sends fast answers without a redundant receipt, keeps later
CLI results on the same trace, and recovers exact reply targets from durable
session metadata. Final owner-task closeout still needs the broader async
completion fallback described in the human-control design.

## Noise Control

Telegram should be attention-first, not event-log-first.

Recommended policy:

- `P0`: immediate, always send.
- `P1`: immediate, dedupe by `dedupKey` with cooldown.
- `P2`: batch into a digest unless it asks for human input.
- `P3`: do not push by default; visible in web/console.

Repeated notifications with the same `dedupKey` should update or collapse:

```text
AKS RP E2E still blocked

Same blocker repeated 5 times in 42m.
Latest: task not found: network-acns-cilium-network-policy...

Reply: investigate / mute 2h / show details
```

Telegram supports editing messages. When practical, store the message ID and
edit the existing notification instead of sending a new one for the same
dedupKey. If editing is unavailable or fails, send a collapsed follow-up.

## Status And Control Commands

Natural language should remain primary. Slash commands are for fast mobile
read-models and safety controls:

- `/status` - compact system/project status, no LLM session required.
- `/projects` - list project posture, current attention, exact waits, and last movement.
- `/project <id>` - focused project status and useful links.
- `/tasks <id>` - canonical task sections and current Conditions.
- `/sessions` - active sessions and what they are doing.
- `/quiet <duration>` - mute P2/P3 notifications.
- `/watch <project>` - raise attention level for one project.
- `/cancel <session>` and `/cancel all` - explicit cancellation.
- `/help` - show the above plus examples.

These commands should query read models directly where possible. They should not
spawn a general chat session unless the command asks for analysis.

## Convenience Features

High-value refinements:

- **Reply examples**: every actionable notification includes the exact replies
  it understands.
- **Human acknowledgements**: confirmations describe the outcome, not internal
  event names.
- **Project links**: include web links for task review, event trace, or feature
  page when relevant.
- **Digest mode**: grouped summary for repeated low-priority events.
- **Stale reply detection**: avoid applying old approvals or steering to
  terminal work.
- **Context health metric**: track percentage of Telegram notifications with
  `conversationId` and useful `originalIssue`.
- **Reply-actionable metric**: track replies that reach May with conversation
  context and produce a delivery/result confirmation without needing a
  clarification turn.

## Non-Goals

- Telegram should not become the full web UI.
- The channel should not require buttons or custom clients to be useful.
- The router should not hide state changes in free-form chat when a typed event
  exists.
