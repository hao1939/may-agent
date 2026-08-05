# Design: Human Control Surfaces

**Design status:** Accepted.
**Implementation status:** Partial. Canonical CLI, Telegram, Web/control
socket, and console ingress exist. The deployed Telegram path gives ordinary
input a fresh bounded May turn, stores inbound and outbound trace links in the
existing message index, captures each turn's reply target in immutable session
context, and recovers a reply target after restart. May-owned Telegram CLI
results also get one fresh review when their source session is gone. Proactive
messages and child summaries now wait behind May's enforced admission review.
Fresh Telegram turns receive focused trace/task evidence and bounded nearby
conversation. The seven-case approved Gym proof and live fail-closed proof are
complete. Full owner-task
reconciliation, broader async
completion handling, and session-independent caller identity still have
convergence gaps described below. A fresh May verification turn now wakes when
a human-linked app task reaches `converged` or `attention`. Legacy socket frames
remain compatibility ingress. The deployed runtime also gives an open Condition
an optional bounded review checkpoint: delivery resync wakes the same task
owner, and a human-linked checkpoint result wakes one deduplicated fresh May
review even when the task remains `waiting`.
**Aligned with**: `events.md`, `sessions.md`, `runtime.md`, `may-console.md`, `webui.md`

## Purpose

CLI, Telegram, Web, and May Console are different human channels into the same
agent system. They should differ in presentation, not in routing semantics.

The common rule is:

> Conversational input must target a logical agent conversation or an explicit
> execution session. Project-directed input targets the project app. There is
> no free-floating input.

The second rule is:

> Every state-changing human intent enters the daemon as a canonical event.

Read-only transport controls such as `subscribe` and `status` may remain
socket-local/read-model controls. They do not change system state. Anything
that starts work, steers work, cancels work, comments on a project, reloads
runtime config, or shuts down the system should be normalized into an event
envelope before it reaches runtime logic.

Direct and Gym agent runs are separate portable execution surfaces; they do not
control the autonomous daemon and therefore do not require its event bus.

## Layers

| Layer | Example | Durable? | Purpose |
|---|---|---:|---|
| Channel input | CLI argv, Telegram update, browser click, terminal line | No | Human-interface detail |
| Intent event | `session.steer.requested`, `chat.start.requested` | Yes | State-changing request entering the system |
| Domain event | `session.start`, `session.end`, `project.comment.created` | Yes | Fact that happened |
| Read/control frame | `subscribe`, `status`, generic app-action discovery/invocation | No | Stream/read control or translation through the daemon-owned action registry |

Channel adapters should be boring: parse the human action, resolve local UI
state if needed, and emit the canonical intent event. Typed app actions use one
generic daemon RPC so the loaded app registry validates input and emits that
event; the RPC is not another durable intent. The daemon owns session state,
chat creation, cold resume, cancellation, persistence, and follow-up domain
events.

## Human Turn Trace

Free-form conversational text enters as `human.input.received`. It is the
boundary/root event for one turn, not a request database object. The input
router emits one semantic child intent:

```text
human.input.received
  -> chat.start.requested       start a bounded conversation turn
  -> session.steer.requested    deliver to an existing session
  -> project.comment.created    attach project direction
  -> project.approval.submitted apply structured approval context
  -> runtime.*.requested        explicit runtime control
```

An explicit project-comment surface, such as `POST /api/projects/comment`, may
emit `project.comment.created` directly. In that path the comment event is the
persisted receipt and trace root. A conversational surface such as Telegram may
first record `human.input.received` and then emit the project comment as its
semantic child. Both paths converge on the same app-owner contract; neither
adds a request record.

A human conversation is a logical channel/thread relationship, not a session
and not a trace. One conversation may use many bounded May sessions. Each
standalone human turn receives a new trace. A reply to a prior
notification/result resolves that prior trace through its reply context. May
still interprets the new human message: a correction or decision continues the
request, while a clearly unrelated request starts a new linked trace.

### Conversation and request threads

The human sees one conversation with May. Inside it, several requests may be
open at the same time. A request thread is the connected view of one human
trace, its messages, linked owner task, evidence, and May closeout. It is not a
new task record or lifecycle object.

For Telegram, the logical conversation identity is the May agent plus the
Telegram chat and topic when one exists. `reply_to_message_id` is an explicit
anchor to a prior message; it is not the durable request identity. Deleting a
Telegram message or losing a session must not lose the request thread.

The channel message index records enough to recover the connection for every
inbound and outbound message:

- channel conversation identity and platform message id;
- platform reply target when present;
- human trace and parent event;
- linked app task or domain subject when present; and
- direction and delivery result.

This index is transport evidence and lookup data. Traces and domain tasks
remain authoritative for causality and work.

Resolve the request a new message refers to in this order:

1. The stored trace/task of the Telegram message or UI item explicitly replied
   to.
2. A subject clearly named by the human.
3. The only plausible open request in the conversation.
4. If several consequential requests still fit, state the likely
   interpretation and ask one focused question.

Do not select the globally latest message, the latest May session, or the
closest text match as the request identity.

The runtime exposes one read-only conversation view, backed by existing
messages, events, traces, app tasks, and durable preferences. Given a
conversation and optional reply target, it returns:

- the focused request: original intent, trace, status, owner, and task;
- related human and May messages in order;
- latest meaningful evidence and the next closure condition;
- compact summaries of other open requests that could make the reference
  ambiguous; and
- relevant accepted decisions and human preferences.

The same view may back an internal context reader and a paginated Web/debug
API. It assembles existing truth; it does not accept work, change status, or
create another conversation database. Raw history remains available on
demand, while normal May turns receive only the focused thread and relevant
nearby context.

Telegram reply presentation follows a separate, simple rule:

1. An immediate answer replies to the exact incoming human message.
2. A late result from a known source session replies to the human message that
   started that session.
3. Other progress reports, decision packets, or closeouts reply to the latest
   human message linked to that request trace.
4. If no later human message exists, they reply to the original request.

When a late result names the exact execution session that produced it, the
transport first recovers that session's persisted `channelMessageId`. Older
session records may fall back to `requestId` only when it has the exact form
`telegram:<positive message id>`. If the exact source session has no valid
target, send the result without a Telegram reply edge. Never attach it to the
newest message from a shared trace merely to create a reply.

Never route work by that presentation target. After delivery, store the new
Telegram message id with the same trace and task links so a later human reply
can recover the request directly.

A session is only one execution attempt. Reusing an idle session may remain a
context-cache optimization, but correctness must behave as if every turn could
start in a fresh session. Durable work, caller identity, completion routing,
and human follow-up must never depend on one mutable "current May session" or
on that session remaining resumable.

The selected input's trace travels with the bounded turn through session
execution, delegation, terminal `session.idle` / `session.end`, and channel
delivery. When the turn creates durable app work, the chat branch may finish
after May acknowledges the request while the linked app-intent/task branch
continues. The app branch, not the chat session, owns the unfinished work.

The semantic intent is the lifecycle opener. `human.input.received` itself is
an external boundary fact and is not convention-paired. For chat work,
`session.idle` or `session.end` closes the turn intent. Channel delivery is a
linked transport projection; explicit approval/confirmation is required only
when the domain workflow asks for it.

Read-only controls remain outside this path when the surface knows they are
controls. For example, a status button or exact CLI `may status` command can
query the read model directly. Natural-language text such as "what needs
attention?" remains human input and goes through Chat-May.

## Long-Running Human Requests

A request is long-running when its result may arrive after the current May
turn ends. Duration in minutes or days is irrelevant. The convention is:

```text
human input and turn trace
  -> bounded May session understands the outcome
  -> owning app accepts or reuses one durable task
  -> May acknowledges the owned continuation
  -> app owner executes, waits, recovers, and records evidence
  -> completion, failure, material movement, or missed checkpoint wakes May
  -> a fresh bounded May session reviews the evidence
  -> May replans, asks one real authority question, or delivers one closeout
```

There is no new generic human-request record or May task tree. Existing objects
keep their existing meanings:

| Concern | Source of truth |
|---|---|
| What Hao asked | `human.input.received` and its trace |
| What durable outcome was accepted | linked app intent and owner result |
| What work remains | the owning app's task resource and Conditions |
| What execution attempt ran | bounded session, workflow, or CLI-task record |
| Whether May still owes a result | open durable branch plus missing reviewed channel delivery |

### Ownership and durable continuation

May first finds the app that already owns the requested outcome. The app owner
answers, rejects, reuses existing work, or creates/revises one durable task.
May does not choose a foreign app merely to hold work, copy the task into
`may-agent.app`, or keep unfinished work only in chat text.

A bounded one-off outside an app may use an event-tracked asynchronous worker
with May accountable for its result. If the work needs repeated recovery,
waiting, scheduling, or domain state, it belongs in the responsible app.

Before May tells Hao that work will continue, the durable branch must identify:

- the original human trace;
- the accountable app/owner and canonical task or async reference;
- the expected owner result and terminal outcome proof; and
- either the event that wakes May or an exact review checkpoint when no event
  arrives.

These are links and existing domain fields, not a new closure-contract entity.
An accepted event, queued task, started worker, completed helper, or owner claim
is progress only. It is not the terminal outcome unless the owning domain says
so and the required evidence supports it.

### May supervision

The app owner executes. May supervises outcome and human closure. May wakes on:

- owner progress, failure, attention, or terminal events;
- a missed task Condition or review checkpoint;
- a material change in scope, risk, authority, or proof;
- a correction, status request, or reprioritization from Hao.

At a check-in May reads the durable task and evidence, leaves healthy work
alone, and steers only outcome, scope, priority, safety, or proof. May does not
micromanage the owner's patch or commands. One missed checkpoint triggers
owner review. Continued lack of evidence after a bounded recovery causes May
to replan through the same task, ask the owner to change execution, route a
runtime fault to its owner, or escalate the exact remaining authority blocker.
It does not create duplicate recovery tasks or wait silently forever.

Every long-running request has an event-driven completion wake. A review
checkpoint is the backstop for missing movement, not a fixed human-update
schedule. Healthy internal progress is silent.

### Break glass

May normally preserves the app boundary. May may take direct control when Hao
explicitly asks May to handle the work, the accountable path is broken after a
bounded recovery, urgent harm would result from waiting, or no app owns a
bounded outcome. Faster execution, implementation curiosity, healthy owner
progress, or unclear human intent are insufficient reasons.

```text
bounded May turn
  -> may.break-glass.started with reason, scope, proof, and stop condition
  -> one linked privileged May attempt
  -> direct repair, agent/CLI use, or ownership-system recovery
  -> verify the human outcome
  -> may.break-glass.completed or may.break-glass.failed
  -> fresh May review closes the request or restores app ownership
```

Break glass uses the original human trace and ordinary session and evidence
records. It is not another request or task object. A missing terminal event is
an execution-recovery problem. The shared runtime may retry or surface that
attempt, but must not infer success.

The attempt is temporary and bounded. It may use full tools and may cross an
app-local agent boundary, but it does not bypass exact human authority,
credential, security, or irreversible-change requirements. If work needs an
ongoing schedule, repeated reconciliation, or durable domain wait, May repairs,
selects, or creates the accountable app path and hands the work back.

### Human communication

May uses at most the messages the situation needs:

1. An initial acknowledgement after durable ownership is accepted. State the
   understood outcome, who owns it in plain language, what proof May will
   review, and whether Hao needs to act.
2. A material update only when the outcome, delay, risk, approach, or human
   need changes. Worker acceptance, retries, and "still working" are internal.
3. One verified closeout, or one complete decision packet when human authority
   genuinely remains.

A material break-glass takeover may replace the normal ownership
acknowledgement with one short update stating why May is taking control, what
outcome she is proving, and whether Hao needs to act. Internal commands and
routine recovery remain silent.

Say "I am routing it" while durable acceptance is pending. Say "the owner is
handling it" only after acceptance. A promise such as "I will report the
result" is valid only when the durable branch and May wake already exist.
While acceptance is pending, May says Hao does not need to act and does not
promise an acceptance update or another message. Acceptance tracking stays
internal. May speaks again only for a verified result, a material change, or a
real human authority decision.

The pending-routing reply carries only three facts: May is routing the request,
durable acceptance is pending, and Hao does not need to act. It stops there.
The accepted work reference, terminal proof, completion wake, and bounded
review checkpoint belong to the internal commitment until they exist.

When Hao asks for status, May reads durable state instead of asking a worker to
rediscover it. The response states the current phase, latest meaningful
evidence, next closure condition, and whether Hao needs to act.

### Session loss and prepared context

Losing the original session never loses the request. Completion routes by app
task and trace; `sessionId` is only an optional execution/resume hint. If the
old session is alive, runtime may steer it. Otherwise runtime starts a fresh
bounded May review session with a prepared context packet containing:

- the incoming message or wake event and reply target;
- the original human intent and May's last delivered response;
- the accountable owner, task, current state, and latest evidence;
- the expected terminal proof and next review condition;
- relevant recent conversation, accepted decisions, and Hao preferences.

Raw messages remain available. A rolling summary alone is insufficient for
approval, correction, or preference-sensitive meaning. Resolve reply/trace and
task identities before semantic retrieval. If one interpretation is clearly
supported, proceed. If several consequential open requests remain plausible,
state the likely interpretation and ask one focused question.

One logical conversation may therefore have several isolated May sessions at
once: a current human turn, an owner-result review, a stalled-work review, and
a proactive-attention review. Each tool call captures its immutable
conversation, trace, and session context at invocation. Human-facing output is
serialized through May's reviewed outbound path so concurrent sessions cannot
send contradictory or duplicate messages.

## Canonical Human Intent Events

### Start a bounded conversation turn

Free-form channel text first records the human boundary. Use this when the
human is talking to May rather than explicitly controlling one execution
session.

```json
{
  "type": "human.input.received",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "actor": "human",
    "text": "hello",
    "conversation": {
      "id": "may-console:local-terminal:agent:may",
      "channel": "may-console",
      "channelThreadId": "local-terminal"
    },
    "target": { "agent": "may" },
    "context": { "forceNew": true }
  }
}
```

The input router derives `chat.start.requested` and starts a bounded turn in the
logical channel/agent conversation. It does not create a new conversation
identity. Continuity comes from prepared conversation context, not from one
process-local session surviving. `forceNew` applies to the execution attempt,
not the logical conversation.

`session.steer.requested` remains appropriate when the human explicitly targets
one active execution attempt. A normal new chat turn and an autonomous review
of background work should not be attached to whichever May session happened
to start most recently.

### Steer an existing session

Use when the channel has a concrete session target.

```json
{
  "type": "session.steer.requested",
  "source": "telegram",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123",
    "message": "continue from the failing test"
  }
}
```

The daemon decides whether the session is running, idle, terminal-but-resumable,
or not steerable. The channel should not implement those lifecycle mechanics.
The daemon handler must preserve the existing resume-or-send behavior: active
or idle sessions receive `manager.send()`, while cold/terminal sessions attempt
the existing `manager.resumeSession()` path and report failure if the session is
not resumable.

### Cancel a session

```json
{
  "type": "session.cancel.requested",
  "source": "web-ui",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123"
  }
}
```

Cancel is session-scoped. If a channel cannot resolve the intended session, it
must fail locally or ask the human to choose a session. It must not silently
upgrade `/cancel` to cancel-all. Broad cancellation is always the explicit
`session.cancel_all.requested` intent.

### Cancel all sessions

This is deliberately explicit because it is broad.

```json
{
  "type": "session.cancel_all.requested",
  "source": "may-console",
  "owner": "agent:may",
  "urgency": "high",
  "data": {
    "reason": "human requested cancel all"
  }
}
```

### Project comment

Project comments are already domain-level events because the comment itself is
the fact to persist and route:

```json
{
  "type": "project.comment.created",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "target": { "project": "aks-rp-e2e" },
  "data": {
    "projectPath": "projects/aks-rp-e2e",
    "comment": "Focus next on managedsystem pool coverage.",
    "author": "hao"
  }
}
```

### Runtime controls

Reload, restart, and shutdown are also state-changing requests. They should be
event-shaped rather than ad hoc command frames:

```json
{
  "type": "runtime.reload.requested",
  "source": "telegram",
  "owner": "agent:may",
  "data": {
    "reason": "human requested reload"
  }
}
```

```json
{
  "type": "runtime.restart.requested",
  "source": "may-console",
  "owner": "agent:may",
  "urgency": "high",
  "data": {
    "reason": "human requested restart"
  }
}
```

`runtime.restart.requested` must not run inline `supervisorctl restart
may-agent ...` from the `may-agent` process. The runtime hands restart ownership
to supervisord by starting the one-shot `may-agent-restarter` program:

```bash
supervisorctl start may-agent-restarter
```

After supervisor accepts that start request, the restarter continues even if
the `may-agent` process exits or crashes. If `may-agent` crashes before handing
the request to supervisor, normal supervisor `autorestart` owns process
recovery. If supervisord or the container dies, the container runtime owns
recovery.

The independent maintenance process also probes the daemon control socket.
It allows a two-minute startup grace. After that, one slow or failed probe is
ordinary load, so it does nothing. If the control socket fails, maintenance
checks the daemon's durable heartbeat and current session rows before counting
the probe as a daemon failure. A fresh heartbeat proves the daemon event loop
is alive even when the control surface itself is broken; that socket failure
remains a separate observable repair concern. Six consecutive failures of both
signals may request the same supervisor-owned restarter, with a cooldown to
prevent restart loops. Any probe that can still see current active sessions
starts one bounded grace period for that work, even when the control socket is
unavailable. Failed probes do not continuously extend that period. If
responsiveness does not return before the grace expires, recovery proceeds.
This covers a live but unresponsive event loop without repeatedly interrupting
in-flight work or putting liveness, scheduling, or restart behavior into any
project app.

The restarter leaves the maintenance process running during ordinary liveness
recovery, preserving its cooldown state. A staged binary deploy also restarts
maintenance so the watchdog itself moves to the deployed version.

Runtime code deployment follows the same ownership rule. The agent may build
the binary in the mounted workspace, but install and restart must be a
supervisor-owned one-shot:

```bash
cd /app/projects/may-agent
bun run deploy
```

`bun run deploy` builds the current May code and applies it to the running May
service. The script uses the available control path: the supervisor socket when
it is reachable, otherwise `docker exec may-agent`. `bun run reload` is
intentionally not a code deploy command; `/reload` and
`runtime.reload.requested` reload agent/app definitions.

The deploy command bundles the runtime, writes the staged deploy marker, then
asks supervisor to start `may-agent-restarter`. The restarter installs
`bundle/may-agent` to `/usr/local/bin/may-agent` while the runtime is stopped,
then starts `may-agent` / `may-agent-web`. If the live restarter does not
support staged deploy, recreate the container from the updated image; do not
do an inline stop/copy/start from the agent process.

The deploy command returns after supervisor accepts the one-shot. The caller
must verify closure by checking supervisor status, the restarter log, and that
`bundle/deploy-requested` was removed.

```json
{
  "type": "runtime.shutdown.requested",
  "source": "telegram",
  "owner": "agent:may",
  "urgency": "high",
  "data": {
    "reason": "human requested shutdown"
  }
}
```

## Target Resolution

Each channel keeps only enough local state to make the human interaction
ergonomic. That local state is not authoritative.

| Channel | Targeting rule |
|---|---|
| May Console | Bare text always emits `human.input.received` for a bounded May turn. Watching never changes input routing. `/steer <sessionId> <message>` and `/cancel <sessionId>` are explicit session controls. |
| CLI | Non-interactive commands must name the intent: `chat`, `steer`, `cancel`, `comment`, `emit`. Ambiguous commands fail locally. |
| Telegram | Reply-to-message context is attached to `human.input.received`; command-router may steer an explicitly referenced active session or route to May with an enriched delivery message. A normal message starts a bounded May turn with `chat.start.requested`. |
| Web | Visible UI context selects target. A session page steers that explicit session; an agent chat page starts a bounded turn in that agent conversation; buttons emit one explicit intent event. |

If a target cannot be resolved, the channel should fail locally with a clear
message. It should not silently send the text to May as a fallback.

## CLI Contract

The CLI should be scriptable and explicit. Good commands are shaped by intent:

```bash
may-agent --emit chat.start.requested \
  '{"agent":"may","message":"hello","channel":"cli"}'
may-agent --emit session.steer.requested \
  '{"sessionId":"s_123","message":"continue"}'
may-agent --emit session.cancel.requested '{"sessionId":"s_123"}'
may-agent --emit session.cancel_all.requested \
  '{"reason":"human requested cancel all"}'
may-agent --emit project.comment.created \
  '{"projectPath":"projects/aks-rp-e2e","comment":"managedsystem pool should be next","author":"hao"}'
may-agent --status
```

Exit behavior:

- `0` means the daemon accepted the intent or the read succeeded.
- `1` means local validation failed or daemon delivery failed.
- The CLI should print the target socket/path and event type on failure.

## Telegram Contract

Telegram is optimized around reply context. The human reply is plain text; the
system attaches notification metadata and command-router enriches the internal
delivery message. Telegram supplies the reply anchor; the conversation view
resolves the durable request thread.

May owns proactive human attention. A producer's human-directed message or
escalation is a candidate, not delivery authority. May handles it, routes it,
returns it for missing context, rejects it, or admits one decision-ready
message. Telegram delivers only admitted proactive notifications. The full
contract is in [telegram-notifications.md](telegram-notifications.md#outbound-human-inbox-deputy).

- Replying to a project notification emits `human.input.received` with project
  context; command-router or May decides whether that becomes
  `project.comment.created`, a May chat turn, or a project event.
- Replying to a session notification emits `human.input.received` with session
  context. Normal language starts a bounded May turn so May can understand the
  intent and may then resume or steer that session. Only an explicit session
  control such as `/steer` targets it directly in command-router.
- A normal message emits `chat.start.requested` for a bounded turn in the
  Telegram/May conversation. It does not depend on a current May session.
- Immediate May answers reply to the incoming message. Later updates and
  closeouts reply to the latest human message in the resolved trace, falling
  back to the original request. The Telegram reply target is presentation, not
  routing state.
- Unknown slash commands should show help or fail locally. They should not have
  the slash stripped and be sent as ordinary text.

Useful May Console commands:

```text
/status
/sessions
/watch may|all|<sessionId>
/steer <sessionId> <message>
/cancel <sessionId>
/cancel all
/reload
/help
```

## Web Contract

The Web UI is a read model plus explicit action adapter.

- GET endpoints return read models.
- POST endpoints emit canonical intent events.
- The UI should show the target before sending.
- Buttons either perform the action or clearly draft a message; do not mix the
  two meanings.
- Session pages steer the visible session.
- Agent chat pages target the resolved agent chat session or request creation
  with `chat.start.requested`.

HTTP route names can stay ergonomic, but their implementation should be a thin
adapter over event emission. For example:

| HTTP action | Intent event |
|---|---|
| `POST /api/sessions/:id/message` | `session.steer.requested` |
| `POST /api/sessions/:id/cancel` | `session.cancel.requested` |
| `POST /api/agents/:name/message` with no chat session | `chat.start.requested` |
| `POST /api/projects/comment` | `project.comment.created` |
| `GET /api/projects/:id/actions` | Discover optional typed action schemas |
| `POST /api/projects/:id/actions/:actionId` | Validate and emit the action's semantic event |

For a project app, the filesystem/UI path and event target are different
identifiers. A path such as `projects/aks-rp-e2e.app` locates the app, while
the emitted event targets the loaded app id (`aks-rp-e2e`). The HTTP adapter
must not derive the event target from the human-facing `owner/id` project
identity in `project.json`; doing so sends the comment to an owner inbox that
the app task reconciler does not consume.

## Compatibility Path

The current daemon socket accepts older shortcut frames such as `input`,
`steer`, `fork`, `cancel_all`, `reload`, and `shutdown`. Those are compatibility
ingress frames. They should normalize at the socket boundary before events are
emitted to the bus. That normalization lives in
`projects/may-agent/packages/control/src/protocol.ts` beside the socket server. The command router
consumes canonical intent events and retains only explicit compatibility cases
for older internal producers.

This keeps old clients working while giving every channel one durable semantic
contract.

A flat `session.cancel.requested` shortcut is explicitly normalized into the
canonical envelope. A caller that already sends canonical `source`, `owner`,
and object `data` passes ordinary envelope validation.

## Test Contract

Each human surface should have tests for the same behavior:

- Existing session target sends `session.steer.requested`.
- Missing chat target sends `chat.start.requested`, not free-floating `input`.
- Cancel session sends `session.cancel.requested`.
- Cancel-all sends `session.cancel_all.requested`.
- Project comment sends `project.comment.created`.
- Project comment returns its persisted event ID and receives exactly one
  correlated `project.owner.reviewed` result.
- Typed project actions remain discoverable, reject invalid input before
  emission, and return the direct semantic event ID without wrapper events.
- Unknown or ambiguous target fails locally.
- Opening/attaching to the surface does not emit a state-changing event.
- Conversational free-form input uses `human.input.received` as the trace root
  and one normalized intent as its child; explicit project-comment ingress may
  use `project.comment.created` directly as its receipt and root.
- Normal conversation input uses `chat.start.requested` for a bounded turn;
  `session.steer.requested` is reserved for an explicitly targeted execution
  attempt or a compatibility path during convergence.
- The turn's `session.idle` / `session.end` stays in the same trace and closes
  the conversational branch. A linked durable app branch remains open until
  its own terminal event.
- Forked/workflow/CLI work, app task results, May review, and final outbound
  delivery remain connected to the originating human trace without depending
  on the originating session.
- Losing or restarting the original session starts a fresh May session with a
  prepared context packet and does not lose durable work or the human closeout.
- Concurrent May sessions capture immutable caller trace/session context and
  cannot steal one another's tool results or Telegram delivery.
- Telegram reply anchors resolve through the channel message index to a trace
  and optional owner task before semantic retrieval. Deleted or missing reply
  messages fall back to named subject, then the only plausible open request,
  then one focused clarification.
- Conversation context is assembled as a read model over existing events,
  traces, messages, tasks, and preferences. It does not become a second request
  lifecycle or task store.
- A future-result promise is rejected or rewritten unless a durable owner
  reference, completion wake, and proof condition already exist.
- A missed review checkpoint wakes the same app owner. Its human-linked result
  wakes one May review; healthy progress does not create repetitive human
  updates.
- Bare cancel never becomes cancel-all; broad cancellation requires the
  explicit `session.cancel_all.requested` intent.

The point of these tests is not UI coverage. It is preventing CLI, Telegram,
Web, and May Console from drifting into different meanings for the same human
intent.

## POC Evidence

The isolated Gym proof in
[May conversation follow-through POC](../../../gym/benchmarks/may-conversation-follow-through/POC-RESULTS.md)
supports this design direction without changing production routing:

- the trace-based conversation model passed 8/8 deterministic infrastructure
  cases; the narrow current-session replay model passed 1/8;
- current May passed the three-turn development trajectory with 12/12 behavior
  checks and both calibrated semantic judges, including accepted completion
  wakes and missed-progress checkpoints before a later-result promise;
- current May passed the held-back four-turn transfer trajectory with 8/8
  behavior checks and both judges;
- current May passed the held-back stalled-request case in three consecutive
  trials. It kept the same owner task, required changed execution or a proved
  blocker after an empty recheck, routed broken supervision to its runtime
  owner, kept routine recovery silent, and reserved Hao for exact authority;
- the direct-reply admission case exposed a conflicting deputy instruction:
  decision-only work was told to put future language in the human response.
  After that conflict was removed and the routing commitment gained one worked
  closure-chain example, May produced the correct pending-routing reply and
  complete internal requirement in three consecutive decisions. Two passed
  both semantic judges; one identical correct decision split the judges and is
  evaluator variance, not a May behavior failure; and
- the typed contract made owner, proof, reply target, and human action explicit.
  An isolated May prompt overlay was not required for the passing baseline.

This proves the model and test method, not live Telegram readiness. Start with
one read-only shadow resolver over existing Telegram notification records. It
reports whether an explicit trace or task link exists and does not change live
routing.

The deployed narrow path now covers CLI-worker completion after the source May
session disappears. The CLI task keeps its originating trace. If the captured
session still exists, the runtime steers it as before. Otherwise, only a
May-owned result linked to indexed Telegram human input starts one fresh May
review on the same trace. Repeated terminal delivery reuses that review.

Live evidence also exposed a reply-target race in the deployed bounded-turn
path: inbound message `45974` and outbound messages `45976`/`45977` shared the
correct trace, but both outbound messages replied to older message `45971`.
The command router synchronously started the session before Telegram recorded
the new target in its mutable pending slot. The deployed fix captures
`conversationId` and `channelMessageId` in the session invocation, persists
them in session metadata, and publishes them on `session.start`. Telegram binds
the response from that immutable session context; a bounded turn no longer
uses the shared pending slot.

The fix passes the focused race, overlap, persistence, closeout, and E2E
tests, TypeScript, all 9 deterministic Gym checks, and both calibrated semantic
judges. Hao approved rollout, and commit `2648a3c9` was deployed on 2026-07-30.
The installed binary matched the staged binary, the deploy marker cleared, and
May, Web, and maintenance returned healthy.

The first post-rollout exchange closed the direct-response proof. Human input
`45984` started session `s_1785404509853_6` with `channelMessageId: 45984`.
Response `45987` kept trace `event:4646877` and recorded `replyToMsgId: 45984`.
It did not reuse the older reply target.

The same exchange exposed a separate late-message bug. Message `45986`
contained a correction produced by earlier May work but replied to newer input
`45984`. Tool factories still read one mutable current-session value per agent,
so overlapping May sessions could label a tool call with another session and
then fall back to the newest message on their shared conversation trace.

Commit `5673f369` binds every tool execution to its own session using
async execution context. The message event carries that exact source session,
and Telegram prefers the source session's immutable reply target over a trace
fallback. The exact overlapping-session regression, focused Telegram and
lifecycle suites, TypeScript, and the full 2,074-test CI suite pass. Hao
approved rollout, and the commit was deployed on 2026-07-30. The installed
binary matched the staged binary, the deploy marker cleared, and May, Web, and
maintenance returned healthy. The next applicable late tool messages provided
the live Telegram proof below.

The post-rollout proof exposed one final compatibility edge. Late messages
`45991` and `45992` carried the correct source sessions and content, so they no
longer attached to a newer unrelated request. They were sent without reply
edges because both source sessions were already idle and Telegram had deleted
their in-memory reply maps. Their persisted session records still identified
the original inputs: newer records use `channelMessageId`, while these legacy
records retained `requestId: telegram:45984` and `requestId: telegram:45981`.

The narrow candidate fix reads that persisted session record when a late
source-session message arrives. It prefers `channelMessageId`, accepts the
strict legacy request-id form, and suppresses shared-trace reply fallback when
an exact source session is present. A missing or malformed target therefore
produces a standalone message instead of a wrong reply. Focused tests cover an
idle source session, a legacy record, a malformed record, and a newer competing
trace target. The full runtime suite passed 2,077 tests, and the related Gym
scenario passed all 9 deterministic checks plus both semantic judges.

Hao approved rollout, and runtime commit `3c589082` was deployed on 2026-07-30.
The staged and installed binaries had the same SHA-256 hash, the deploy marker
cleared, May, Web, and maintenance remained running, and the Web surface
returned HTTP 200.

The next natural late result closed the visible proof. Outbound Telegram
message `45998` carried source session `s_1785400723038_66`. That idle legacy
session had no persisted `channelMessageId`; it retained only
`requestId: telegram:45978`. The deployed fallback recovered `45978` and stored
`replyToMsgId: 45978`. It did not attach the result to newer human messages
`45981`, `45984`, `45988`, or `45993`.

That correct reply edge also exposed a separate startup-recovery defect: the
result existed only because deployment resumed several completed idle Telegram
turns. An idle chat turn has already answered or closed its human input. On
restart, retire it and reject replay of its old prompt. A chat turn that was
still `running` may resume so interrupted work can finish.

The narrow candidate applies that rule at startup. It leaves generic session
recovery unchanged, resumes running chat work, retires idle chat sessions, and
lets the next human input start a fresh bounded turn. Full CI passed 2,079 tests
with zero failures. The May follow-through Gym scenario passed all 9 behavior
checks and both semantic judges. Hao approved rollout and runtime commit
`6faa9fbd` was deployed. The later `66e5d944` deployment restart started no
legacy chat turn and emitted no old chat reply.

Keep the broader conversation view and app-task reconciliation separate. The
narrow CLI fallback does not justify a new request table, scheduler, daemon, or
generic completion abstraction.

## Runtime Convergence Gaps

- Flat socket command frames remain accepted for compatibility but normalize
  into the same canonical event path.
- Non-app legacy projects still use command-router discussion-file mutation.
  V3 project apps receive `project.comment.created` without command-router file
  mutation and own any resulting state change.
- Persistent `ChatSession` reuse remains on non-Telegram surfaces. The
  deployed Telegram path treats a session as one bounded execution:
  ordinary language starts a new turn, while only explicit `/steer` targets an
  execution session.
- Startup recovery now retires completed idle chat turns while still resuming
  chat work that was running when the process stopped. Commit `6faa9fbd`
  removed the defect that produced old live message `45998`; the later
  `66e5d944` deployment restart started no legacy chat turn and emitted no old
  chat reply.
- `notification_messages` now indexes inbound and outbound Telegram messages,
  reply edges, stable chat/topic/May conversation identity, and available
  trace/task links without adding a table. A seven-day replay had found traces
  on all 229 human-directed source events but none of the 225 delivered
  `message.created` rows. Inbound indexing, outbound trace copying, and stable
  identity are now deployed. Approval and notification-specific ids are
  retained as request lineage instead of replacing the stable Telegram
  conversation id.
- The deployed Telegram path captures conversation and channel-message
  identity in immutable session context and can recover the latest inbound
  human message by trace from the durable index. A tested candidate also
  recovers an idle source session from persisted metadata, including strict
  legacy `telegram:<id>` request records, without guessing a newer trace target.
  The candidate is deployed, and live message `45998` proved the legacy
  recovery path against several newer competing human messages.
- The deployed conversation reader uses the already-resolved Telegram
  reply trace/task, existing event trace, and message index to assemble the
  focused project, owner, state, latest durable evidence, and a bounded nearby
  conversation for a fresh May turn. It creates no new request state and never
  routes by text similarity. Named-subject fallback, canonical app-task detail,
  neighboring open-request summaries, and filtered preference retrieval remain.
- Tool execution now uses exact async session context and carries the source
  session on outbound messages. The old mutable per-agent value remains only as
  a compatibility fallback outside a running tool call. Live proof confirmed
  exact source identity and exposed the idle-session lookup edge described
  above.
- CLI-task completion has a deployed fallback for May-owned Telegram work:
  preserve the original trace, reuse a live source session, or start one
  deduplicated fresh May review when that session is gone. Commit `3f43ddbf`
  now gives that fresh review the existing durable conversation view: exact
  trace, available task/project links, recent durable events, and a bounded
  Telegram window. It adds no request state. Fourteen focused tests and
  TypeScript pass; the clean deployed binary hash is
  `06596f1d519e991a2a50a033a907c3e48242934793f05187369874c60d8f1251`.
- May's deputy rule and Gym contract now reject a later-result promise until
  the accepted branch names its owner task or worker, terminal proof,
  completion wake, and missed-progress checkpoint. The strengthened
  development trajectory passes 12/12 checks and both semantic judges. The
  remaining runtime gap is structural admission: an unconstrained chat path
  can still speak before those links are mechanically checked.
- Deployed follow-through joins a terminal
  `project.task.reconciled` fact to the existing `project.owner.reviewed` task
  reference and original Telegram trace. For `converged` or `attention`, it
  starts one deduplicated fresh May review on the original request; `waiting`
  progress and tasks without a human link stay silent. The deployed path
  adds one exception: an app owner result caused by
  `condition-review-checkpoint-missed` starts a fresh May review when the task
  is human-linked, even if it remains `waiting`. The request id includes the
  owner attempt, so replay is deduplicated while a later missed checkpoint can
  still receive a new review.
- The deployed integrity check reports every terminal human-linked app
  task until a May review started from that exact terminal event produces a
  delivered closeout on the original trace. The query uses indexed event types
  and materializes the small human-linked task set; it ran in about 5 ms on the
  2.2 GB live database. The deployed path covers active missed checkpoints through
  the existing Condition and resync path; a broader query-level invariant for
  every open human-linked branch remains unnecessary unless live proof exposes
  another lost-wake case.
- Hao approved the stalled-request truth and rollout on 2026-07-31. Runtime
  commit `487ff749` was deployed from a clean worktree. The staged and installed
  binaries shared SHA-256
  `68fd0eb8603df65f32a8d6b7017dffbb2696761f3dbd84016efc10ccc654a14e`,
  the deploy marker cleared, May, Web, and maintenance returned running, and
  the Web surface returned HTTP 200.
- The deployed path holds proactive messages, alerts, and child-session
  summaries until May reviews them; only `deliver` sends May's reviewed text,
  and review failure retries once then fails closed. All seven approved Gym
  cases pass eight deterministic gates and both semantic judges. Commit
  `a93fbd7f` also guarantees admission attaches before external ingress and
  cron startup. Live source event `4667365` produced enforced audit `4667420`
  with no Telegram delivery. Its incomplete May decision became a held-back
  Gym case. Runtime commit `66e5d944` requires complete action and closure
  proof; live source event `4668507` then produced completed `handle` audit
  `4668539` on the first attempt, with no notification row or delivery event.
- Gym's daily Telegram field review is active and checkpointed. Its
  2026-07-30 run reviewed 11 completed interactions and retained five strong
  signals. The enforcement rollout must prove that this review continues to
  understand admitted delivery, suppression, owner action, closure evidence,
  and later human corrections.
