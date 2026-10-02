# May Console

**Supports:** [Human Control Surfaces](human-control-surfaces.md). Provides terminal access to the shared discussion and controls without another runtime.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Accepted.
**Implementation status:** Shared commands, Conversation reads, focused App,
one Task watch and Task cards are implemented. Direct responsible-Task admission
sets the watch, and an exact correlated Conversation result suppresses its
equivalent supporting terminal card. TTY Esc publishes durable Turn Stop with
the observed turn identity and revision; completion menus consume Esc first.
Source verification does not establish the installed terminal version.
Shared semantics belong to
[Human Control Surfaces](human-control-surfaces.md).

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

Everyday help presents conversation and Task controls first:

| Command                  | Meaning                                               |
| ------------------------ | ----------------------------------------------------- |
| `/apps [app]`            | List Apps or select one App                           |
| `/topics`, `/topics more` | List Conversation Topics page by page                |
| `/topic [ref\|clear]`   | Show, follow, or leave one Topic                      |
| `/tasks [all] [history]` | List Tasks owned by the selected App, optionally all Apps/history |
| `/tasks more`            | Continue the current Task page                        |
| `/todo [all]`            | Show Tasks that explicitly need human action         |
| `/todo more`             | Continue the current human-action page                |
| `/task <ref>`            | Read one exact Task                                   |
| `/watch [ref]`           | Watch a Task or show the current watched Task         |
| `/unwatch`               | Stop watching without changing the Task               |
| `/cancel [ref]`          | Cancel the named or currently watched Task            |
| `/help`                  | Show the ordinary interface                           |

Local client and Host administration commands have a separate help group:

| Command | Meaning |
| --- | --- |
| `/exit` (`/quit` alias) | Close only this adapter |
| `/shell` | Leave Console for an interactive shell; exiting that shell exits the client |
| `/reload` | Reload Host definitions across Apps |
| `/restart` | Restart the Host, affecting all Apps |

Command, App, Topic references, and recently rendered Task references
support tab completion. Completion uses bounded local caches; it never asks a
model to interpret a command.

Host request history, session listing, and session cancellation are
not ordinary Console commands. Diagnostic raw/session output remains behind
explicit developer debug controls and is not shown in help.
`/todo` means Tasks needing human action; it is not a list of all open Requests.

## Keyboard control

Esc stops the active conversational turn when the conversation input has focus.
An open menu or dialog consumes Esc first. While idle, Esc preserves the draft
and Conversation. It never exits Console or cancels a background Task. Display
`Esc: stop this turn` while work is active.

Use the existing `conversation.turn.stop.requested` event with the observed
App, Conversation, turn ID and revision. Stop persists before execution is
interrupted; late controls cannot affect a newer turn. Render whether the
request was accepted or the target already ended. The
[shared control contract](human-control-surfaces.md#current-turn-control)
owns persistence, stale-control and external-effect semantics.

The terminal keypress handler implements Esc through the shared Stop event;
there is no separate `/stop` command in its current command surface.
Ordinary messages currently queue during an active turn. Stopping and then
sending a correction is the first redirection path; a seamless steering/resume
feature is optional, and no `/steer` command is required.

## Ordinary conversation

Bare text always enters `Conversation may:primary` as one durable human
message. It has no session target. Transport `ok` receipts stay hidden because
they prove admission, not useful progress.

When the socket is connected, Console publishes the message immediately. The
initial Conversation snapshot is only for presentation and never gates input;
the daemon supplies authoritative durable context to May's message handler.
When disconnected, Console may retain a small bounded in-process outbox and
labels it honestly as offline. That outbox is reconnect convenience, not
durable admission.

Console separates conversation turns with one blank line. A multiline turn
keeps every continuation line aligned under the text after `you>` or `may>`;
the speaker remains visually distinct without repeating it on every line.
Long prose wraps to the current terminal width with the same continuation
indentation.

`/reload` includes one adapter-local request identity. Console waits for the
correlated `runtime.reload.finished` fact, renders its success or failure, and
then records that rendered command result in Conversation. Other Console
processes ignore the fact unless they issued that exact request; they receive
the eventual shared Conversation message normally.

The selected App defaults to `may`; `/apps <app>` switches it for this Console
process immediately. The App read validates and describes that selection
asynchronously; it does not block later commands or human turns. If validation
fails, Console restores the prior App. If another switch happens first, the old
validation result is stale and cannot change the newer selection. The normal
prompt is:

```text
you[may]>
```

Following a Topic adds its short reference to the prompt, for example
`you[may · 0df0c0ed]>`. Later bare text carries the exact Topic ID. Topic
selection is local context, not work; Task progress remains under `/task` and
`/watch`.

When the selected App has open human actions, the prompt includes their
authoritative count, such as `you[evaluation · 2 todo]>`.

While watching a Task:

```text
you[evaluation:8f12ac90]>
```

Bare text in the second prompt is still a May Conversation turn. Console adds
the selected App as `context.focusedApp` and the exact `{ appId, taskId }` under
`context.focusedTask`. This supplies exact conversational context, not an
automatic feedback command. May decides whether to answer about the Task,
clarify, send relevant feedback to its owning App, or treat the message as a
different topic. The Host supplies May one bounded current observation of that
exact Task; Console does not poll or copy its transient watch history into
Conversation.

## Reads and rendering

Console sends typed socket reads:

```json
{ "type": "apps.list" }
{ "type": "tasks.list", "appId": "evaluation", "limit": 10 }
{ "type": "tasks.list", "appId": "evaluation", "humanActionOnly": true, "limit": 50 }
{ "type": "task.get", "ref": "8f12ac90" }
```

Explicitly requested views are appended to Conversation after presentation,
with canonical `taskRefs` metadata. This lets a later Console or Telegram turn
refer naturally to what the human saw. Automatic watch refreshes are transient.

`/todo` is the same Task read filtered to explicit open human-owned Conditions;
`/todo more` follows its opaque cursor. Console subscribes to identity-only
semantic wakes for the selected App, coalesces bursts, rereads the bounded
view, and may best-effort announce a new or changed requested action once in
the current process. It never polls or asks May to build the list. While a Task
is watched, its ordinary card carries `Action needed`.

Normal rendering hides unrelated sessions, successful tool calls, heartbeats,
executor lifecycle stages, queue movement, and delivery bookkeeping. A passive
executor progress event wakes the human surface only when it carries a useful
human-readable message.

When a conversational follow-up is durably admitted, Runtime adds one
tool-authored Task activity to the shared Conversation. Console renders it as
an indented `[task]` block, shows the exact Task reference, and automatically
watches that Task.
This is separate from `may>` speech: May explains the decision; `[task]` proves
what was accepted. The accepted responsible Task is the only automatic watch
target; Task assignment therefore does not first switch the Console into a May
wrapper context. Watch refreshes stay transient and are coalesced by canonical
Task revision, so internal event volume does not become terminal noise.

`/tasks` uses small, separated blocks. The first line identifies the Task, App,
state, and last-change age; indented lines show its concrete goal and what the
human needs to do. `/todo` follows the same hierarchy. `/task <ref>` puts the
useful answers first in consistently indented sections: `Goal`, `State`,
`Current`, `Expected result`, and `You`. When no open human-owned Condition
exists on the Task or an exact dependency leaf, `You` explicitly says `Nothing
needed right now.` For a wait, `Current` still names the next actor, resume
event, and recovery review. Task ID and diagnostic session appear last. Console
derives this from the shared Task view and does not invent a second status
model.

Starting or refreshing `/watch` renders a compact Task update rather than the
full `/task` view. The latest useful progress or result comes first as the
content the human is trying to understand. Task identity, state, age, related
work, and `You` form a small indented footer beneath it. Repeated acceptance
criteria, internal IDs, and diagnostic session details remain available
through `/task <ref>` without competing with the update.

A direct May answer is appended to Conversation even when it creates no new
Task or dependency. A durable follow-up result is correlated through its exact
follow-up request to the existing Conversation and Topic; model-written Topic
labels cannot make an otherwise valid result disappear. The resulting `may>`
turn is the answer. A watch update is supporting execution evidence, not a
substitute for that turn. The shared Conversation projection gives an explicit
May response one canonical message identity; its inbox result is not projected
again as a second reply.

## Watch

Console subscribes to one exact canonical Task identity. A semantic Task event
produces `app.task.updated(appId, taskId)` on the socket; the wake contains no
Task body. Console then re-reads the exact resource.

When Runtime records that May's request was attached to an exact owner Task,
the durable Conversation message carries `metadata.followTask`. Console follows
that Task automatically after reading the message; it does not infer ownership
from prose, Task order, or session activity. A newer assignment or explicit
`/watch` replaces the local watch. Selecting another App or `/unwatch` ends it
without changing the Task.
The follow notice and exact Task card retain the requesting parent Task link, so
switching presentation focus never obscures which human commitment the owner
Task serves.

Only one read may be in flight. Further wakes set one dirty bit, resulting in
at most one additional read. There is no polling timer. Completion or
cancellation shows the terminal result and automatically clears the watch.

Console remembers a bounded set of semantic Task revisions shown on this live
surface. Repeated wakes for an unchanged revision render nothing. Returning
with `/watch <ref>` shows one compact catch-up snapshot only when the Task has
changed; it does not replay intermediate updates. An explicit `/task <ref>` is
an intentional read and may repeat current information.

The shared Task view reports only observations belonging to the active attempt.
When an open Task begins new work, a result from its prior attempt remains
history and is not rendered as the current watch update.

Reconnect preserves the in-process watch preference, resubscribes, and reads
current truth. A missed wake is harmless.

## Cancellation

`/cancel <ref>` or focused `/cancel` invokes typed Task cancellation. It never
means “kill this session.” The daemon persists cancellation, fences stale
attempt results, removes recovery readiness, interrupts a linked local session,
and returns the retained Task cancellation view.
Bare `/cancel` requires a watched Task. Show its exact reference and summary in
the acknowledgment; `/unwatch` only ends notifications. Closing the Console
client does not stop a conversational turn or a Task.

## Conversation synchronization

Console listens for `conversation.updated`, reads the bounded Conversation, and
renders unseen stable message IDs. Messages from Telegram use a source label
such as `you[telegram]>`. A Console process suppresses only messages it already
rendered; another Console process may still display the same shared message.
Passive synchronization reads messages only; it does not query Host request
history. A newly read `followTask` hint may separately start one exact Task read;
that follow operation is not part of the Conversation projection.

Console processes unseen messages in Conversation order. If one bounded read
contains several new assignment hints, only the newest is followed. Every
pending automatic read is fenced by the exact App and Task identity: a newer
assignment, explicit `/watch`, `/unwatch`, or App switch makes an older reply a
no-op. Repeated assignment of the currently watched Task changes nothing.

Durable messages render only from this Conversation read. The raw message event
is not a second presentation path, so an assignment or answer cannot appear
twice. A transient notification is intentionally different: because it never
enters Conversation, Console may render its raw event directly.

The event journal retains prior command views, but the Conversation read
returns only the newest view for each Console or Telegram surface. This keeps
the latest human-visible context while preventing old list pages from becoming
startup replay or May prompt history.

## Failure behavior

- a connected human turn is published without waiting for the initial
  Conversation snapshot or May's prior work;
- an offline human turn is retained only in a bounded Console-local outbox and
  sent after reconnect; process exit may lose that unsent turn;
- local App selection and reconnect-safe reads do not wait in the command
  queue; only controls that require a live daemon connection do;
- reconnect uses bounded backoff;
- ambiguous or invalid Task refs fail locally with no mutation;
- a slow socket client is disconnected before it can block the daemon; and
- closing Console changes no Task, Conversation, or session.
