# May Console

**Design status:** Accepted.
**Implementation status:** Implemented.

May Console is a small terminal adapter for the running daemon. It owns
readline, rendering, reconnect, completion, one local Task watch, and typed
resource commands. It does not run May, own Tasks, or manage sessions.

```text
terminal -> may-console -> daemon socket -> Conversation and Task resources
```

## Starting it

Inside the container:

```bash
may-console
```

From the Runtime source checkout:

```bash
node packages/terminal/bin/may-console.cjs
```

The socket is derived from `STATE_DIR`, `DAEMON_INSTANCE`/`INSTANCE`, and
`DAEMON_AGENT`. Opening or reconnecting is passive and creates no work.

## Commands

| Command                | Meaning                                               |
| ---------------------- | ----------------------------------------------------- |
| `/apps [app]`          | List Apps or show one App                             |
| `/tasks [app] [all]`   | List active Tasks, optionally including recent history |
| `/task <ref>`          | Read one exact Task                                   |
| `/watch [ref]`         | Watch a Task or show the current watched Task         |
| `/unwatch`             | Stop watching without changing the Task               |
| `/cancel [ref]`        | Cancel the named or currently watched Task            |
| `/help`                | Show the ordinary interface                           |
| `/reload`, `/restart`  | Typed Runtime controls                                |
| `/shell`               | Leave Console for an interactive shell                |
| `/exit`                | Close only this adapter                               |

Command, App, and recently rendered Task references support tab completion.
Completion uses bounded local caches; it never asks a model to interpret a
command.

`/work` is a temporary hidden diagnostic alias for old Host-request views.
Session listing, steering, and session cancellation are not ordinary Console
commands. Diagnostic raw/session output remains behind explicit developer
debug controls and is not shown in help.

## Ordinary conversation

Bare text always enters `Conversation may:primary` as one durable human
message. It has no session target. Transport `ok` receipts stay hidden because
they prove admission, not useful progress.

`/reload` includes one adapter-local request identity. Console waits for the
correlated `runtime.reload.finished` fact, renders its success or failure, and
then records that rendered command result in Conversation. Other Console
processes ignore the fact unless they issued that exact request; they receive
the eventual shared Conversation message normally.

The normal prompt is:

```text
you>
```

While watching a Task:

```text
you[task 8f12ac90]>
```

Bare text in the second prompt is still a May Conversation turn. Console adds
the exact `{ appId, taskId }` under `context.focusedTask`; May interprets the
feedback and the owning App decides how it changes the Task.

## Reads and rendering

Console sends typed socket reads:

```json
{ "type": "apps.list" }
{ "type": "tasks.list", "appId": "evaluation", "limit": 10 }
{ "type": "task.get", "ref": "8f12ac90" }
```

Explicitly requested views are appended to Conversation after presentation,
with canonical `taskRefs` metadata. This lets a later Console or Telegram turn
refer naturally to what the human saw. Automatic watch refreshes are transient.

Normal rendering hides unrelated sessions, successful tool calls, heartbeats,
queue movement, and delivery bookkeeping.

## Watch

Console subscribes to one exact canonical Task identity. A semantic Task event
produces `app.task.updated(appId, taskId)` on the socket; the wake contains no
Task body. Console then re-reads the exact resource.

Only one read may be in flight. Further wakes set one dirty bit, resulting in
at most one additional read. There is no polling timer. Completion or
cancellation shows the terminal result and automatically clears the watch.

Reconnect preserves the in-process watch preference, resubscribes, and reads
current truth. A missed wake is harmless.

## Cancellation

`/cancel <ref>` or focused `/cancel` invokes typed Task cancellation. It never
means “kill this session.” The daemon persists cancellation, fences stale
attempt results, removes recovery readiness, interrupts a linked local session,
and returns the retained Task cancellation view.

## Conversation synchronization

Console listens for `conversation.updated`, reads the bounded Conversation, and
renders unseen stable message IDs. Messages from Telegram use a source label
such as `you[telegram]>`. A Console process suppresses only messages it already
rendered; another Console process may still display the same shared message.
Passive synchronization requests messages only; it does not rebuild the hidden
legacy request-work view.

The event journal retains prior command views, but the Conversation read
returns only the newest view for each Console or Telegram surface. This keeps
the latest human-visible context while preventing old list pages from becoming
startup replay or May prompt history.

## Failure behavior

- disconnected input is queued only until the initial Conversation snapshot;
- reconnect uses bounded backoff;
- ambiguous or invalid Task refs fail locally with no mutation;
- a slow socket client is disconnected before it can block the daemon; and
- closing Console changes no Task, Conversation, or session.
