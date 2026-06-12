# Design: May Console

**Status**: Draft
**Date**: 2026-06-05
**Aligned with**: `human-control-surfaces.md`, `runtime.md`, `sessions.md`, `events.md`, `webui.md`

## Purpose

May Console is a terminal console for the running May daemon.

It gives a human the same kind of terminal-native interaction surface that
Claude Code and Codex provide, but the process behind the terminal is not an
LLM runtime. It is a small REPL client attached to the daemon control socket.
The daemon owns agent lifecycle, chat lifecycle, event routing, session
selection, and persistence.

Opening May Console must be cheap. It attaches to the running daemon and
subscribes to events. It must not start, resume, steer, or wake an agent session
until the human enters a message or an explicit command. When the human does
enter a message, that message must target a known session or explicitly request
creation of a chat session; the console does not send free-floating input.

## Non-Goals

- It is not the Web UI chat surface.
- It is not a shell.
- It is not a second session manager.
- It does not run May directly.
- It does not implement project, metric, handler, or workflow mechanics.
- It does not invent a separate protocol from the daemon socket protocol.

The console is a terminal UI over the existing daemon boundary.

## Terminal UX Contract

May Console should emulate the terminal UX contract of Claude Code and Codex,
but not their runtime ownership model.

What Claude/Codex get right as terminal products:

- The terminal is the primary interaction surface.
- The process is long-lived.
- Reopening a terminal attaches to the same interaction context.
- Typed text has one obvious target.
- Prompt/status makes the current mode clear.
- Scrollback, copy/paste, and command history behave like a normal terminal.
- Startup does not surprise the user with unrelated work.

May Console should keep those user-facing properties. The key difference is
ownership: Claude/Codex are the agent runtime process, while `may-console` is a
client of a running daemon. May's daemon owns `ChatSession`, session lifecycle,
resume behavior, persistence, and event routing.

So May Console copies the terminal experience, not the runtime architecture.
It attaches, renders, and sends intentional input. It does not become another
agent runner.

Concretely:

| Claude/Codex terminal property | May Console equivalent |
|---|---|
| Long-lived interactive process | Long-lived `may-console` REPL; see Reconnect Contract for daemon restart continuity |
| Resume/continue is owned by CLI runtime | Resume/session ownership stays in daemon `ChatSession` and `SubagentManager` |
| Prompt represents active conversation | Prompt represents the selected target: May with chat id when known, a session, or disconnected |
| Bare text goes to visible conversation | Bare text goes to the selected target |
| Tool output is summarized in terminal | Daemon events render as compact session/tool/status lines |
| Reopen attaches to existing terminal | Reopen attaches to the same console process when hosted by a terminal multiplexer |

This comparison is a design constraint: May Console should feel as direct as
Claude/Codex in a terminal, while preserving the daemon as the single owner of
agent state.

## Process Model

```
terminal
  -> may-console process
    -> daemon Unix socket
      -> command router
        -> ChatSession
          -> SubagentManager
            -> May agent session
```

Responsibilities:

| Layer | Responsibility |
|---|---|
| `may-console` | Readline, command parsing, event rendering, reconnect |
| daemon socket | Framing, subscribe/status controls, event ingress |
| command router | Route human intent events such as `chat.start.requested`, `session.steer.requested`, `session.cancel.requested`, `runtime.reload.requested`, and project comments |
| `ChatSession` | Persistent May conversation and built-in chat commands |
| `SubagentManager` | Session execution, cancellation, resume, persistence |

The console never calls `manager.run()`, `manager.send()`, or
`manager.resumeSession()` directly.

## Startup Contract

On startup, the console resolves the daemon socket path from:

| Input | Meaning |
|---|---|
| `STATE_DIR` | State root, default `/app/.state` |
| `DAEMON_INSTANCE` or `INSTANCE` | Instance name, default `background` for the terminal profile |
| `DAEMON_AGENT` | Interface agent, default `may` |

After connecting, startup sends only:

```json
{ "type": "subscribe", "sessions": ["chat"] }
```

```json
{ "type": "status" }
```

Startup must not send `input`, `steer`, `fork`, `resume`, or any frame that can
start LLM work. In the canonical model, startup must not send
`chat.start.requested`, `session.steer.requested`, `session.cancel.requested`,
or any other state-changing intent event.

## Watch Scope vs Selected Target

The console has two separate pieces of local state:

| State | Meaning |
|---|---|
| Watch scope | Which events are displayed |
| Selected target | Where bare input and target-aware commands go |

They are related but not the same.

Default watch scope is `chat`, which follows May's human chat session and its
child sessions through the daemon socket's `subscribe: ["chat"]` behavior.
`all` maps to `subscribe: ["*"]`. `current` maps to a concrete session-id
filter such as `subscribe: ["s_123456"]`, which the daemon socket already
supports.

The selected target starts as May. It changes only by human intent:

- `/use <sessionId>` selects that concrete session and watches it.
- `/may` selects the May chat target and watches chat.
- `/new` selects May, clears the known May chat session, and makes the next
  bare message request a fresh chat.

The console may remember the current May chat session from `connected`,
`status`, or `session.start` events, but that remembered chat id is not a
separate input mode. It is only the concrete session used when the selected
target is May.

If the selected session reaches `session.end`, the console leaves that session
selected for audit. Bare input still emits `session.steer.requested` for that
session; the daemon decides whether cold resume is valid. The prompt should
make terminal state visible:

```text
may[s_123456 ended]>
```

From an ended session, `/may` selects May chat, `/use <other>` selects another
session, and `/watch current` continues to show only the selected session's
events.

## Selected Target Input

Default target is May:

```text
may[may]>
```

Once the console knows the concrete May chat session, the prompt includes its
short id so the human can audit which session is being reused:

```text
may[may:s_123456]>
```

While the selected target is active, the prompt includes status:

```text
may[may:s_123456 running]>
may[may:s_123456 ready]>
may[s_worker_a running]>
may[s_worker_a done]>
```

This prompt status is a lightweight liveness signal. The authoritative boundary
is still the event stream: tool/text events mean activity is arriving, and
`session.end` means the turn/session finished. For the May chat target,
`session.end status=done` is rendered as `ready`, because May's chat session is
available for the next message. For selected worker sessions, `done` remains
visible because the selected session itself has ended.

Bare text targets the selected target. When May is selected and the console
already knows the May chat session id, it emits:

```json
{
  "type": "session.steer.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123456",
    "message": "..."
  }
}
```

When May is selected and no May chat session is known, bare text explicitly
requests a chat session:

```json
{
  "type": "chat.start.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "agent": "may",
    "message": "...",
    "channel": "may-console",
    "channelThreadId": "local-terminal"
  }
}
```

Selecting a session makes that session the input target:

```text
may[s_123456]>
```

Bare text then steers the selected session:

```json
{
  "type": "session.steer.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123456",
    "message": "..."
  }
}
```

`/may` selects May again.

## Command Set

Commands start with `/`. Bare aliases for historical commands may remain, but
new behavior should be documented and tested as slash commands.

| Command | Behavior |
|---|---|
| `/help` | Print local command help |
| `/status` | Send socket control frame `{ type: "status" }` |
| `/sessions` | Alias for `/status`, rendered as active sessions |
| `/watch chat` | Subscribe to `["chat"]` |
| `/watch all` | Subscribe to `["*"]` |
| `/watch current` | Subscribe to `[currentSessionId]`; requires a current session |
| `/use <sessionId>` | Select that session as the target and watch it |
| `/may` | Select May as the target and watch chat |
| `/steer <message>` | Steer the selected session once; requires a selected session |
| `/cancel` | Cancel the selected session target, or the current May chat session when May is selected |
| `/cancel all` | Emit `session.cancel_all.requested` |
| `/new` | Select May, clear current May chat session, watch chat, and make the next bare message emit `chat.start.requested` |
| `/reload` | Emit `runtime.reload.requested` |
| `/restart` | Emit `runtime.restart.requested` |
| `/raw` | Toggle raw JSON event rendering |
| `/shell` | Exit console into an interactive shell |
| `/exit` | Close console |

Session ids can be abbreviated when unambiguous among active sessions shown by
the latest `/status`.

`/sessions` output must include enough of each `sessionId` to make `/use`
practical. The minimum useful row is:

```text
s_123456  may  idle  chat  "current task preview"
```

Abbreviations are accepted only when they match exactly one known active or
recent session. Ambiguous or unknown abbreviations fail locally and do not send
a daemon frame.

## Session Switching

The main path is:

```text
/sessions
/use s_123456
/steer continue from the last failure
```

For longer steering:

```text
/sessions
/use s_123456
continue from the last failure
run the focused test again
/may
```

`/use` sets both selected target and watch scope. That matches operator intent:
after selecting a session, the human usually wants to see and steer that
session.

When the selected session ends, the selection remains for audit. Sending more
input to that session is still explicit because the prompt names the selected
session; the daemon owns resume-or-reject semantics.

## Reconnect Contract

May Console should survive daemon restarts.

If the socket is missing or closes:

1. Print a concise disconnected status.
2. Keep the terminal process and prompt alive.
3. Retry with bounded backoff.
4. On reconnect, resend the current watch subscription.
5. Request `status`.
6. Preserve local raw/watch/selected-target state.

User input while disconnected should fail fast with a local message. It should
not silently queue messages unless the console later grows an explicit queueing
feature.

When May Console is exposed through the Web terminal, browser refresh is a
reattach, not a restart. The backend terminal manager keeps the terminal process
warm for its idle TTL and asks the terminal bridge to replay a bounded tmux
pane snapshot to the new browser client. That replay must include the latest
visible prompt/status so a refresh does not make the operator lose context or
wonder whether the selected agent is still responding.

## Rendering

The renderer consumes canonical event envelopes. Socket-local frames such as
`connected` and `status` are control/read-model frames rather than durable
events, but they use the same JSONL transport.

```ts
const data =
  event && typeof event.data === "object" && event.data && !Array.isArray(event.data)
    ? event.data
    : {};
```

Default rendering:

| Event | Rendering |
|---|---|
| `connected` | One-line daemon/instance/session status |
| `status` | Active sessions with agent, status, kind, task, short id |
| `session.start` | May chat start or child delegation line |
| `text` | Stream text for watched session |
| `tool_call` | Dim one-line tool summary |
| `tool_result` | Show errors by default; hide successful noise |
| `session.end` | Status, duration, summary/error if present |
| `message.created` | Human-directed message notification |
| `info` | Daemon info line |
| unknown | Hide unless raw mode is enabled |

Raw mode prints each event as compact JSON.

The prompt should be restored cleanly after asynchronous output. Renderer code
must coordinate with readline so streamed text does not corrupt user input.

## Intent Events

May Console uses the same human intent events as CLI, Telegram, and Web. The
examples below are canonical event envelopes. Socket-local read controls such
as `subscribe` and `status` remain transport frames because they do not mutate
state.

Read/control frames:

```json
{ "type": "subscribe", "sessions": ["chat"] }
```

```json
{ "type": "status" }
```

State-changing intents:

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

```json
{
  "type": "session.steer.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123456",
    "message": "continue"
  }
}
```

```json
{
  "type": "session.cancel.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "sessionId": "s_123456"
  }
}
```

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

Console steering uses the same semantic event as Web UI and Telegram steering.
The transport is different, but daemon-side behavior is intentionally shared.

The current implementation still accepts shortcut ingress frames such as
`input`, `steer`, `fork`, `cancel_all`, `reload`, and `shutdown`. Those are
compatibility frames. They should normalize at the socket boundary into the
canonical intent events above.

## Current Implementation Status

`packages/terminal/bin/may-console.cjs` has the terminal UX slice:

- attach-only startup with `subscribe ["chat"]` and `status`
- reconnect with resubscribe/status refresh
- `/sessions`, `/use`, `/watch`, `/may`, `/steer`
- session id abbreviation with ambiguous-id rejection
- selected-target prompts for May with chat id when known, session,
  disconnected, and ended states
- local failure for disconnected input
- e2e coverage through the real console process and a fake daemon socket

Compatibility status:

- May Console emits canonical human intent envelopes for state-changing input.
- The daemon socket may still accept older shortcut ingress frames for older
  clients, but those are compatibility inputs at the socket boundary.
- Command routing should consume the canonical intent events:
  `chat.start.requested`, `session.steer.requested`,
  `session.cancel.requested`, `session.cancel_all.requested`,
  `runtime.reload.requested`, and `runtime.restart.requested`.

## Implementation Slices

1. **Daemon intent handlers**
   - handle `chat.start.requested` as create-or-bind, not always-create
   - handle `session.steer.requested` with the existing resume-or-send behavior
   - handle `session.cancel.requested`
   - handle `session.cancel_all.requested`
   - handle `runtime.reload.requested` and `runtime.restart.requested`

2. **May Console event emission**
   - emit canonical intent events for every state-changing command
   - keep read controls such as `subscribe` and `status` transport-local

3. **Cross-surface convergence**
   - migrate CLI send/steer/cancel to canonical events
   - migrate Telegram normal/reply/cancel/new behavior to canonical events
   - migrate Web POST actions to canonical events
   - add shared e2e assertions for emitted intent event shapes

## Test Contract

Tests should cover behavior, not terminal cosmetics:

- Startup sends only `subscribe ["chat"]` and `status`.
- Startup does not emit `chat.start.requested`,
  `session.steer.requested`, `session.cancel.requested`, or any other
  state-changing intent.
- Bare text with May selected emits `session.steer.requested` when a May chat
  session is known, otherwise `chat.start.requested`.
- `/use <id>` selects a session target and subscribes to that session.
- Bare text with a selected session emits `session.steer.requested`.
- `/steer <message>` requires a selected session and emits
  `session.steer.requested`.
- `/steer <message>` without a selected session fails locally.
- `/may` selects May and returns to chat watch.
- `/cancel` with May selected emits `session.cancel.requested` for the current May
  chat session if known.
- `/cancel` with a selected session emits `session.cancel.requested`.
- `/cancel` without a resolvable selected target fails locally.
- `/new` clears current May chat session, selects May, and makes the next
  bare text emit `chat.start.requested`.
- Selected session `session.end` keeps the session selected for audit and
  future daemon-owned resume decisions.
- Ambiguous session-id abbreviation fails locally.
- Input while disconnected fails locally and is not queued.
- Reconnect resends the active subscription and requests status.
- Renderer ignores unrelated session text outside `watch all`.
- Raw mode prints unknown events instead of hiding them.

These tests make the important guarantee explicit: opening or reconnecting the
console is passive; only human input causes May or another session to work.
