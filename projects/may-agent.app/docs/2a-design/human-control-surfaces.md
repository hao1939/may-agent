# Design: Human Control Surfaces

**Status**: Draft
**Date**: 2026-06-05
**Aligned with**: `events.md`, `sessions.md`, `runtime.md`, `may-console.md`, `webui.md`

## Purpose

CLI, Telegram, Web, and May Console are different human channels into the same
agent system. They should differ in presentation, not in routing semantics.

The common rule is:

> Human input must target a known session, or explicitly request creation of a
> chat session. There is no free-floating input.

The second rule is:

> Every state-changing human intent enters the daemon as a canonical event.

Read-only transport controls such as `subscribe` and `status` may remain
socket-local/read-model controls. They do not change system state. Anything
that starts work, steers work, cancels work, comments on a project, reloads
runtime config, or shuts down the system should be normalized into an event
envelope before it reaches runtime logic.

## Layers

| Layer | Example | Durable? | Purpose |
|---|---|---:|---|
| Channel input | CLI argv, Telegram update, browser click, terminal line | No | Human-interface detail |
| Intent event | `session.steer.requested`, `chat.start.requested` | Yes | State-changing request entering the system |
| Domain event | `session.start`, `session.completed`, `project.comment.created` | Yes | Fact that happened |
| Read/control frame | `subscribe`, `status` | No | Stream selection and read-only status |

Channel adapters should be boring: parse the human action, resolve local UI
state if needed, and emit the canonical intent event. The daemon owns session
state, chat creation, cold resume, cancellation, persistence, and follow-up
domain events.

## Canonical Human Intent Events

### Start or create a chat session

Use when a human wants to talk to an agent and no current chat session is known
for that channel/agent.

```json
{
  "type": "chat.start.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "agent": "may",
    "message": "hello",
    "channel": "may-console",
    "channelThreadId": "local-terminal"
  }
}
```

The daemon decides whether to create a fresh chat session or bind this request
to an existing chat session for that channel/agent. If it creates a session, it
emits normal session lifecycle events.

This is a create-or-bind request, not a strict "always create" command. If the
daemon already has an active chat session for the same channel/agent identity,
it should bind the request to that session and deliver the message there. A
surface that truly wants a fresh conversation must say so explicitly with a
future field such as `forceNew: true`; absent that flag, continuity wins.

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
  "owner": "agent:may",
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

Runtime code deployment follows the same ownership rule. The agent may build
the binary in the mounted workspace, but install and restart must be a
supervisor-owned one-shot:

```bash
cd /app/projects/may-agent
bun run deploy
```

`bun run deploy` bundles the runtime, writes the staged deploy marker, then
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
| May Console | Prompt shows the selected target and status: May with chat id when known, a session, or disconnected. Bare text targets the selected session with `session.steer.requested`, or the selected May chat session; if no May chat is known, emit `chat.start.requested`. |
| CLI | Non-interactive commands must name the intent: `chat`, `steer`, `cancel`, `comment`, `emit`. Ambiguous commands fail locally. |
| Telegram | Reply-to-message context is attached to `human.input.received`; command-router may steer a known session or route to May with an enriched delivery message. Otherwise the chat has a current May chat session; if absent, emit `chat.start.requested`. |
| Web | Visible UI context selects target. A session page steers that session; an agent chat page targets or creates that agent's chat session; buttons emit one explicit intent event. |

If a target cannot be resolved, the channel should fail locally with a clear
message. It should not silently send the text to May as a fallback.

## CLI Contract

The CLI should be scriptable and explicit. Good commands are shaped by intent:

```text
may chat may "hello"
may chat dev "please review this"
may steer s_123 "continue"
may cancel s_123
may cancel --all
may comment projects/aks-rp-e2e "managedsystem pool should be next"
may emit metric.breach '{"metricId":"x"}'
may status
```

Exit behavior:

- `0` means the daemon accepted the intent or the read succeeded.
- `1` means local validation failed or daemon delivery failed.
- The CLI should print the target socket/path and event type on failure.

## Telegram Contract

Telegram is optimized around reply context. The human reply is plain text; the
system attaches notification metadata and command-router enriches the internal
delivery message.

- Replying to a project notification emits `human.input.received` with project
  context; command-router or May decides whether that becomes
  `project.comment.created`, a May chat turn, or a project event.
- Replying to a session notification emits `human.input.received` with session
  context; command-router may emit `session.steer.requested` for that known
  session using an enriched delivery message.
- A normal message targets the Telegram chat's current May chat session.
- If that chat session is unknown, the message emits `chat.start.requested`.
- Unknown slash commands should show help or fail locally. They should not have
  the slash stripped and be sent as ordinary text.

Useful commands:

```text
/status
/sessions
/use <sessionId>
/steer <message>
/cancel
/cancel all
/new
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

## Compatibility Path

The current daemon socket accepts older shortcut frames such as `input`,
`steer`, `fork`, `cancel_all`, `reload`, and `shutdown`. Those are compatibility
ingress frames. They should normalize at the socket boundary before events are
emitted to the bus. In code terms, the target is `packages/control/src/protocol.ts`
or a normalization layer immediately beside `packages/control/src/server.ts`,
not the command router. The command router should consume canonical intent
events after normalization, while temporarily keeping old cases only as a
compatibility bridge.

This keeps old clients working while giving every channel one durable semantic
contract.

`session.cancel.requested` is currently special-cased as a socket command type
so legacy flat frames can bypass canonical envelope validation. That is a
transitional compatibility rule. After socket-boundary normalization, durable
`session.cancel.requested` events should use the canonical envelope with
`source`, `owner`, and object `data`.

## Test Contract

Each human surface should have tests for the same behavior:

- Existing session target sends `session.steer.requested`.
- Missing chat target sends `chat.start.requested`, not free-floating `input`.
- Cancel session sends `session.cancel.requested`.
- Cancel-all sends `session.cancel_all.requested`.
- Project comment sends `project.comment.created`.
- Unknown or ambiguous target fails locally.
- Opening/attaching to the surface does not emit a state-changing event.

The point of these tests is not UI coverage. It is preventing CLI, Telegram,
Web, and May Console from drifting into different meanings for the same human
intent.
