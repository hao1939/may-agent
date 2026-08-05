# Design: May Console

**Design status:** Accepted.
**Implementation status:** Implemented for the focused terminal contract below;
work and attention summaries still depend on the broader conversation read
model.
**Aligned with:** `human-control-surfaces.md`, `runtime.md`, `sessions.md`,
`events.md`, `webui.md`, `web-terminal.md`

## Purpose

May Console is the terminal conversation surface for the running May daemon.
The Web terminal hosts this same console in a browser. A local terminal may run
it directly.

The mental model is deliberately small:

> Bare text always goes to May. A session is inspected, steered, or cancelled
> only by an explicit command that names that session.

The console is a small REPL attached to the daemon control socket. It does not
run May, own work, select an implicit worker, or persist a second conversation.
The daemon owns event routing and execution. Apps own durable work.

```text
human text
  -> may-console
  -> human.input.received
  -> one bounded May turn
  -> direct answer or app-owned continuation
  -> later material update, decision, or verified closeout
```

Opening the console is passive. It connects, subscribes, and reads status. No
agent work starts until the human enters text or an explicit control command.

## Non-goals

- It is not a shell. `/shell` deliberately leaves the console.
- It is not a session manager.
- It is not a persistent May agent session.
- It does not implement project, task, workflow, metric, or approval state.
- It does not infer that the latest session is the target of new text.
- It does not create terminal-only request or conversation records.

## User experience

The console should feel as direct as Claude Code or Codex without copying their
runtime model:

- the terminal process is long-lived;
- the prompt has one obvious meaning;
- scrollback, copy/paste, history, and reconnect behave like a terminal;
- ordinary output is readable rather than a raw event stream;
- startup never surprises the user with agent work.

The prompt is intentionally stable:

```text
may>
```

When the daemon is unavailable:

```text
may[disconnected]>
```

The prompt never contains a session ID. Seeing or watching a session does not
change where bare text goes.

## Process boundary

```text
browser or terminal
  -> may-console process
    -> daemon Unix socket
      -> command router
        -> bounded May session or explicit session control
```

| Layer | Responsibility |
|---|---|
| `may-console` | Readline, command parsing, quiet event rendering, reconnect |
| daemon socket | Framing, read controls, durable intent ingress |
| command router | Resolve human input into a bounded May turn or explicit control |
| app owner | Accept, reconcile, wait for, and close durable work |
| execution manager | Run, steer, cancel, resume, and persist session attempts |

The console never calls execution-manager methods directly.

## Startup contract

The socket path comes from:

| Input | Meaning |
|---|---|
| `STATE_DIR` | State root, default `/app/.state` |
| `DAEMON_INSTANCE` or `INSTANCE` | Instance, default `background` |
| `DAEMON_AGENT` | Interface agent, default `may` |

On connection, the console sends only a subscription and status request:

```json
{ "type": "subscribe", "sessions": ["*"] }
```

```json
{ "type": "status" }
```

Bounded May turns are separate execution sessions, so the legacy `chat`
subscription cannot find all of them. The console subscribes broadly and
filters locally for the normal May view. `/watch all` exposes the broad stream.

Startup must not emit a state-changing event.

## Ordinary input

Bare text always emits one human boundary event for the logical terminal
conversation:

```json
{
  "type": "human.input.received",
  "source": "may-console",
  "owner": "agent:may",
  "data": {
    "actor": "human",
    "text": "review Gym",
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

The event does not contain a session target. The command router starts one
bounded May turn and keeps the human trace attached. A short answer may return
during that turn. If an app accepts durable work, the May turn may finish while
the app continues. Later progress or closeout does not depend on resuming the
same May session.

After the socket durably accepts the event, the console prints an honest
receipt:

```text
[accepted #1234] May is handling this turn.
```

Acceptance is not completion.

## Explicit session control

Watching and controlling are separate operations:

```text
/watch s_123456
/steer s_123456 continue from the failed test
/cancel s_123456
```

`/watch` changes output only. It never changes the target of bare text.
`/steer` and `/cancel` name their session on every invocation. The daemon owns
active, idle, cold-resume, terminal, and rejection behavior.

If the human enters bare text while watching one session, the console first
returns to the quiet May view so the new bounded turn and its response remain
visible. The text still goes to May; it never steers the watched session.

Session IDs may be abbreviated only when the latest status contains one
unambiguous match. Unknown or ambiguous IDs fail locally.

## Commands

| Command | Behavior |
|---|---|
| `/help` | Print local help |
| `/status` | Read compact daemon status |
| `/sessions` | List known execution sessions |
| `/watch may` | Return to the quiet May view |
| `/watch all` | Show all subscribed runtime events |
| `/watch <sessionId>` | Show one session without changing input routing |
| `/steer <sessionId> <message>` | Explicitly steer one session |
| `/cancel <sessionId>` | Explicitly cancel one session |
| `/cancel all` | Explicitly cancel all running sessions |
| `/debug` | Toggle compact session and tool details |
| `/raw` | Toggle raw JSON rendering |
| `/reload` | Request runtime reload |
| `/restart` | Request runtime restart |
| `/shell` | Leave May Console for an interactive shell |
| `/exit` | Close the console |

`/use`, `/may`, and `/new` remain harmless compatibility guidance only. They
never create a sticky input target. Commands require `/`; the word `status` in
ordinary text is a message to May, while `/status` is the read-only control.

Future `/work` and `/attention` commands may read the shared conversation view
once that read model is available. They must not introduce console-owned state.

## Rendering

Normal mode is a human conversation, not an operations log. It shows:

- connection state;
- acceptance receipts;
- May's streamed response or terminal summary;
- human-directed messages;
- failed May turns;
- requested status/session output.

It hides successful tool calls, unrelated sessions, heartbeats, and generic
daemon chatter. `/debug`, `/watch all`, and `/raw` progressively expose more
detail.

| Event | Normal rendering |
|---|---|
| `connected` | One connection line |
| `ok` for `human.input.received` | Accepted receipt, never “done” |
| `status` | Requested session table |
| May `text` | Stream response text |
| May `session.end` | Fallback summary, or visible failure |
| `message.created` to the human | Human-directed message |
| unrelated session/tool/info event | Hidden |
| unknown | Hidden unless raw mode is on |

The renderer coordinates with readline so asynchronous output does not corrupt
the current input line.

## Web terminal hosting

The Web terminal is a PTY host for May Console, not a separate chat client.
Its May profile opens this console and offers shortcuts for status, sessions,
May-only watching, all-event watching, and debug mode. Browser code does not
route human intent itself.

A browser refresh reattaches to the warm PTY/tmux process while the terminal
manager's idle TTL remains open. The terminal host does not replay an arbitrary
raw ANSI tail as durable conversation history. Durable review comes from
messages, traces, app tasks, and session transcripts.

The transport, resize, focus, and multi-client rules remain in
`web-terminal.md`.

## Reconnect

If the daemon socket closes, May Console:

1. reports disconnection once;
2. keeps the prompt and terminal process alive;
3. retries with bounded backoff;
4. restores the current watch subscription;
5. requests fresh status.

Input while disconnected fails locally and is not queued. Reconnect preserves
presentation preferences such as watch, debug, and raw mode. It does not
restore an input session because no such mode exists.

## Canonical events

State-changing commands use the same event contracts as other human surfaces:

```json
{
  "type": "session.steer.requested",
  "source": "may-console",
  "owner": "agent:may",
  "data": { "sessionId": "s_123456", "message": "continue" }
}
```

```json
{
  "type": "session.cancel.requested",
  "source": "may-console",
  "owner": "agent:may",
  "urgency": "high",
  "data": { "sessionId": "s_123456" }
}
```

Socket-local `subscribe` and `status` frames remain read controls. Older socket
shortcut frames remain compatibility ingress for older clients; May Console
does not use them.

## Implementation ownership

- `projects/may-agent/packages/terminal/bin/may-console.cjs` owns terminal
  interaction and canonical intent emission.
- `projects/may-agent/packages/terminal` owns Web terminal PTY profiles.
- `projects/may-agent/packages/control` owns socket framing and persistence
  acknowledgment.
- daemon command routing owns bounded May turns and explicit session control.
- apps own durable work and its evidence.

## Test contract

Tests cover the behavior boundary:

- startup sends only broad subscription and status frames;
- bare text emits `human.input.received` for May with no session target;
- each bare message requests a bounded May turn even when old sessions exist;
- the acceptance receipt says accepted, not completed;
- `/watch <id>` does not change bare-input routing;
- bare text from a session-only watch returns to the May view before starting
  the turn, so May's response is visible;
- `/steer <id> <message>` emits one explicit steer event;
- `/cancel <id>` emits one explicit cancel event;
- missing, unknown, and ambiguous session IDs fail locally;
- reconnect restores watching and status without starting work;
- normal rendering hides unrelated session and successful tool noise;
- raw mode preserves full diagnostic access.

The essential guarantee is simple: opening and watching are passive, bare text
always goes to May, and controlling an execution session is always explicit.
