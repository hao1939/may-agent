# How to Use may-agent

**Supports:** [Human Control Surfaces](../2a-design/human-control-surfaces.md). Explains how people use and steer the shared system.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

## Human Requests

A Request is an accepted ask that May must close the loop on. The conversation
pattern is to understand your intention, recognize or refine the ask, explain
what May will do, and return the outcome. Clear authorized asks need an
acknowledgment, not another approval. A correction can refine the same Request.

```text
You: Compare these implementations.
May: I'll run the benchmarks, then explain the tradeoffs.
     -> independent benchmark Task admitted; this turn finishes
     -> the comparison Request remains open

You: Include memory use too.
     -> refine the same Request and its work

Later: May returns the comparison and explanation.
       -> close the Request, or state what remains unresolved
```

**Current implementation:** Messages and input handling are durable. Separate
Conversation Request records retain accepted asks, scope revisions, exact Task
links and closure across Turns. May judges fulfillment; code checks revision
and authority. Completing input handling does not close an accepted ask. See
[Message Lifecycle](../2a-design/message-lifecycle.md#requests-acceptance-and-closure).

May may group related Turns under a Topic. A Topic remembers what you are
discussing and links the responsible Tasks; it has no status or execution
loop. Discussion and joint problem-solving stay in Conversation for as many
turns as useful. A long discussion is not a reason to move it into a Task.
An independent background assignment has an exact Task owned by the App that
can do it; its findings can support your ongoing discussion.

The [background authorization policy](../2a-design/conversation-execution.md#authorization-for-background-work)
allows already-authorized work to run in the background without another
approval just for that execution choice. Discussing an idea does not authorize
implementing it. New scope or authority outside existing instructions needs
your decision in the same Conversation. A progress update, blocker, or “Task
started” acknowledgment does not by itself resolve an outstanding ask.

May may answer directly or send typed input to the responsible App. That App
owns its Task. An authorized operator deploys through the standalone
[deployment procedure](app-operations-recovery.md#runtime-deployment-target).
Deployment needs installation authority, but no App or Task identity is required.
An agent name alone grants no deployment authority.

### May Console controls

| Command               | Action                                                    |
| --------------------- | --------------------------------------------------------- |
| `/apps [app]`         | List Apps or select the current App                       |
| `/topics`             | List Topics and their linked Task count                    |
| `/topics more`        | Continue to the next older Topic page                      |
| `/topic [ref\|clear]` | Show, follow, or leave one Topic                          |
| `/tasks [all] [history]` | List Tasks owned by the selected App, optionally all Apps or recent terminal Tasks |
| `/tasks more`         | Continue the exact prior Task list when another page exists |
| `/todo [all]`         | Show open human actions on selected or reachable Tasks      |
| `/todo more`          | Continue the exact prior human-action page                  |
| `/task <ref>`         | Read one exact Task                                       |
| `/watch [ref]`        | Watch or show one Task                                    |
| `/unwatch`            | Leave the watch without changing the Task                 |
| `/cancel [ref]`       | Cancel the named or currently watched Task                |
| `Esc`                | Stop the observed active Conversation Turn; leaves background Tasks running |
| `/help`              | Show available controls                                  |

Local client and Host administration controls:

| Command | Action |
| --- | --- |
| `/exit` (`/quit`) | Close only Console |
| `/shell` | Leave Console for a shell; exiting that shell exits the client |
| `/reload` | Reload Host definitions across Apps |
| `/restart` | Restart the Host, affecting all Apps |

`/tasks` shows each Task's plain state, concrete goal, and whether it needs you.
Use `/task <ref>` for the goal, current progress or wait, expected result, exact
human action (or `Nothing needed right now`), and last update time. Technical
IDs and sessions are shown only as secondary details.

`/cancel <ref>` cancels that Task; bare `/cancel` requires a watched Task.
`/unwatch` only ends notifications. Esc stops the current conversational turn
and leaves admitted background Tasks running. It does not withdraw an accepted
Request or undo earlier effects. Send a new message to continue or correct the
discussion; text sent during a running turn currently waits for the next claim.

Console Esc and Telegram/browser Stop buttons use the same exact Turn control.
Esc first dismisses an open completion menu; otherwise it stops the observed
Turn. New text during execution is retained for the next claim. Immediate
current-turn steering remains a separate [implementation gap](../2a-design/human-control-surfaces.md#current-turn-control).
Older installations may not expose these bindings; verify their binary version.

Bare text always goes through May with the selected App as context. While
watching, Console also attaches the exact Task identity as context. May decides
whether the human is asking about it, changing it, or starting another topic;
Console never steers an execution session directly.

Use `/topic <ref>` when you want later turns to continue one subject. The
prompt shows the short Topic reference, and `/topic` gives a compact catch-up
with its related Turns and Tasks. Use `/topic clear` to leave it. Following a
Topic changes context only; use `/task` or `/watch` for live work state.

Use `/todo` for decisions needed by the selected App, `/todo all` for the
cross-App view, and `/todo more` when another page exists. The prompt count and
best-effort off-watch notifications update from Task events without polling.
`/watch <ref>` opens one action for live progress and natural feedback;
satisfying its Condition removes it from `/todo` without a delivery
acknowledgement.
This view lists Task actions, not every open conversational Request.

## Starting and development modes


```bash
# Run these commands from the Runtime repository.

# Build and start the containerized service
bun run recreate

# Attach the May Console to the running container daemon
docker exec -it may-agent may-console

# Or attach from a source checkout that can reach the daemon state directory
node packages/terminal/bin/may-console.cjs

# Development-only, single-process readline console plus daemon socket
bun src/app/may.ts --console --socket

# Use --chat as a compatibility alias for the quiet console view
bun src/app/may.ts --chat --socket

# Local full service interfaces
bun src/app/may.ts --console --socket --cron --telegram --web

# Cron-only daemon (no interactive chat)
bun src/app/may.ts --cron --socket

# One-off task (runs and exits)
bun src/app/may.ts --task "run the daily review"
bun src/app/may.ts --agent bob --task "check your periodic tasks"
```

### Flags

| Flag                             | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| `--chat`                         | Compatibility alias that enables the quiet built-in console view        |
| `--console`                      | Enable the built-in development readline console                        |
| `--socket`                       | Enable Unix socket for external control                                 |
| `--cron`                         | Enable cron jobs (heartbeats, JS handlers, scheduled tasks)             |
| `--telegram`                     | Enable the Telegram Conversation and Task adapter                        |
| `--web`                          | Enable web UI                                                           |
| `--status`                       | Print system dashboard and exit (agent quality, process health, trends) |
| `--status --notify`              | Print dashboard and also send it to Telegram                            |
| `--send <agent> --message "msg"` | Send a message through the running daemon and exit                      |

At least one of `--chat`, `--cron`, `--task`, `--oneshot`, `--status`,
`--send --message`, `--emit`, `--web`, `--socket`, or `--telegram` is required.

### Environment Variables

| Variable             | Effect                                                                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MODEL_BASE_URL`     | Shared model API URL used by Pi, Codex, and Claude.                                                                                                                                                                                                                                                               |
| `MODEL_API_KEY`      | Credential for the shared model API. Defaults to `not-needed` for an unauthenticated local endpoint.                                                                                                                                                                                                              |
| `DEEPSEEK_BASE_URL`  | Optional independent OpenAI Responses endpoint for the experimental `deepseek-v4-flash` model. Both DeepSeek variables are required to expose the option; partial configuration fails explicitly.                                                                                                                  |
| `DEEPSEEK_API_KEY`   | Credential for the experimental DeepSeek route. Keep it in operator-owned environment/credential storage; never commit it. The route has no fallback and its tariff is unknown.                                                                                                                                    |
| `MAY_DAEMON_QUIET=1` | Suppresses the daemon-mode `info` log forwarder. By default, when neither `--console` nor `--chat` is enabled, the daemon forwards `bus.emit({type:"info"})` events through `log()` so operator-facing messages (reload summaries, telegram diagnostics, startup checks) are visible. Set this to `1` to opt out. |

The experimental DeepSeek entry uses a conservative 128k operational context cap. Its model `samplingParams` pin the configured high-effort Responses request even when ordinary agent thinking selection is off; a caller that needs another request shape must explicitly override those sampling parameters. This is compatibility configuration, not evaluator-adoption evidence; see the [DeepSeek evaluator pilot](../evaluation/deepseek-v4-flash-evaluator-pilot-2026-09.md).

When `--console` or its `--chat` alias is enabled, `attachConsoleUI` handles `info`
events (along with session text, tool calls, etc.) and the daemon-mode
forwarder is not attached — avoiding duplicate prints.

For one-off commands, prefer direct `bun src/app/may.ts ...` invocation.

## Agent configuration and standalone execution

These are executor/maintenance controls, not a separate durable App work path.

### Configured agents

The runtime discovers standalone agents from `agents/<name>/agent.json` and
app-local agents from `projects/<id>.app/agents/<name>/agent.json`. Use the
`agents` tool `list` action, the WebUI Agents page, or runtime status to inspect
the current fleet. Documentation does not maintain a hard-coded agent/model
roster because app ownership and model selection change independently.

### agent.json Format

```json
{
  "name": "dev",
  "description": "Investigates runtime failures and improves observability",
  "domain": "system reliability, metrics, debugging",
  "model": "claude-opus-5",
  "tools": ["coding", "query_db", "finish"],
  "compaction": true
}
```

| Field          | Required | Description                                                                                          |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `name`         | Yes      | Must match directory name                                                                            |
| `description`  | Yes      | Role summary (visible to other agents)                                                               |
| `domain`       | Yes      | Domain of expertise                                                                                  |
| `model`        | Yes      | Canonical model ID, such as `claude-opus-5` or `gpt-5.6-sol`.                                        |
| `tools`        | Yes      | Tool presets (see below)                                                                             |
| `memoryLimit`  | No       | Retained compatibility field; omit in new configs because it does not affect current prompt assembly |
| `compaction`   | No       | Enable automatic context compaction for long sessions                                                |
| `delegateDeny` | No       | Block delegation to specific agents                                                                  |

agent.json is **purely operational** — model, tools, limits, delegation rules.
Always-loaded prompt content lives in `shared/common-sense.md` and the
agent's `AGENTS.md`. Domain docs, tool recipes, lessons, skills, and knowledge
indexes are read on demand.

### Tool Presets

| Preset                            | Description                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `coding`                          | Read, write, edit, and shell tools scoped to the project root                                            |
| `read-only`                       | Read files only                                                                                          |
| `agents`                          | Agent cooperation (`call`, `fork`, `context`, `list`, `peek`, `cancel`, `sessions`)                      |
| `message`                         | Async human/agent inbox messages                                                                         |
| `workflow`                        | Multi-step workflow recipes                                                                              |
| `background-exec`                 | Spawn background processes                                                                               |
| `cron`                            | Schedule and manage cron jobs                                                                            |
| `scrape`                          | Web scraping                                                                                             |
| `query_db` / `query-db`           | Read-only DB query tool                                                                                  |
| `system-status` / `system_status` | Runtime status summary                                                                                   |
| `checkpoint`                      | Persist explicit session checkpoints                                                                     |
| `cli-delegation`                  | Start a native coding-worker process with a persistent worker record; not an App/task ownership boundary |
| `finish`                          | Finish the current task with a structured result                                                         |

### Adding a New Agent

1. Create `agents/<name>/agent.json`
2. Create `agents/<name>/AGENTS.md` — identity and mission
3. Optionally add skills, knowledge, tools, or workflows under the agent directory
4. Restart or invoke the `reload` control

See [Agent Convention](agent-convention.md) for full directory layout.

## Agent Cooperation

Agents cooperate through these canonical actions on the `agents` tool:

| Action     | Type    | Description                                   |
| ---------- | ------- | --------------------------------------------- |
| `call`     | Sync    | Block until child agent completes, get result |
| `fork`     | Async   | Start a helper owned by the live caller; returns sessionId |
| `context`  | Query   | Read parent/origin/root/workflow context      |
| `list`     | Query   | List available agents and active sessions     |
| `peek`     | Query   | Read a running session's progress             |
| `cancel`   | Control | Stop a running session                        |
| `sessions` | Query   | Query persisted execution sessions            |

The removed `requests` action is not a work lifecycle or routing primitive.
Use request status for caller correlation, task status for App work, and
sessions/event traces for execution and causality.

`call` is the primary bounded agent cooperation primitive. An asynchronous
message is notification only; durable cross-App work uses a child App request
and durable desired work uses a task.

The [execution consolidation record](../archive/reviews/execution-consolidation-poc-20260914.md)
keeps helpers under their live caller and joins their cleanup. Finishing the
caller stops unfinished forks; work owed afterward needs an accepted Task.
Standalone sessions require explicit resume. A CLI used directly by a human is
not automatically supervised by May. The execution boundary uses a 30-minute default
invocation allowance, preserves the one-shot five-minute default, and returns
the exact one-shot result and error. These source defaults do not identify an installed release.

## Session Kinds

| Kind   | Created by                                                                 | Lifecycle                                                   |
| ------ | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `chat` | Explicit direct-agent chat                                                 | Persistent execution context; never May App work authority. |
| `job`  | Scoped `agents.fork` or a direct managed invocation                       | Bounded execution; no independent recovery or durable Task ownership. |
| `call` | `agents.call`, workflow `ctx.agents.call`, standalone heartbeat agent step | Bounded synchronous work owned by its caller/workflow.      |

See [sessions.md](../2a-design/sessions.md) for details.

## Socket Protocol

Control a running instance via Unix socket:

```bash
# Convention path:
# .state/instances/<DAEMON_INSTANCE>/<DAEMON_AGENT>.sock
#
# Defaults are DAEMON_INSTANCE=$INSTANCE or default, and DAEMON_AGENT=$AGENT or
# may. Docker/background runtime usually uses DAEMON_INSTANCE=background.

# Watch events
socat - UNIX-CONNECT:.state/instances/default/may.sock

# Send May input through the shared semantic event operation.
echo '{"type":"publish","event":{"type":"app.input.requested","target":{"appId":"may"},"data":{"input":{"kind":"message","data":{"message":"check status"}},"channel":"operator"},"idempotencyKey":"operator-check-status-1"}}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Start or bind direct agent chat through the same operation. The Host derives
# source, owner, time, and trace; callers do not author that envelope.
echo '{"type":"publish","event":{"type":"chat.start.requested","data":{"agent":"dev","message":"fix the test","channel":"operator"},"idempotencyKey":"operator-dev-chat-1"}}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Status
echo '{"type":"status"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Manually fire a configured trigger entry through the control shortcut.
# Replace <entry-name> with an entry declared by the running App generation.
may-agent --emit 'trigger.<entry-name>' '{}'

# Emit to the background container/runtime instance
DAEMON_INSTANCE=background may-agent --emit 'trigger.<entry-name>' '{}'

# If the daemon runs inside Docker and the host cannot connect to the Unix
# socket namespace, execute the same control command inside the container.
docker exec may-agent may-agent --emit 'trigger.<entry-name>' '{}'

# Send direct agent chat through the running daemon.
DAEMON_INSTANCE=background may-agent --send scout --message "review your active project"

# From a source checkout
bun src/app/may.ts --emit 'trigger.<entry-name>' '{}'
```

See [runtime.md](../2a-design/runtime.md) for socket protocol details.

## Events in Practice

You usually interact with events through features, not through the event schema:

| Scenario                                  | What to do                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Manually rerun a configured trigger       | Emit `trigger.<entry-name>` as an operator shortcut after verifying that entry exists                             |
| Publish a changed domain fact             | Emit the semantic fact; its App/task route or observation status must already be declared                         |
| React when a session ends                 | Use an internal projection, App input translator, or exact task wake; a session event does not own follow-up work |
| React when a metric breaches              | Use a declared App input translator, exact task wake, or host-internal health route; never generic owner fallback |
| Request a result from another App         | Return one typed child App task dependency and wait on its correlated result                                      |
| Route a blocker outside current ownership | Return evidence and a typed dependency on the accountable App task                                                |
| Need human input before continuing        | Request a `may` task dependency or persist an exact human Condition on the source task                            |
| Invoke repeated typed App automation      | Discover and invoke the App action; validation and `toInput` admit one correlated App request                     |

`trigger.*` events are control shortcuts. They are useful for operators and
tests, but they are not domain lifecycle events. Domain facts use semantic
names such as `session.end` and `metric.breach`; App requests and escalations
are represented by request/task dependency records rather than event-pair
lifecycles.

Dot-named domain events use the canonical envelope: top-level `type`, `source`,
optional diagnostic ownership/target metadata, and domain context inside
`data`. Flat dot-named socket frames are rejected before persistence. Declared
consumers receive the original event envelope unchanged; domain fields are
under `event.data`.

## Timer And Event Handlers

The long-running host enables scheduling with `--cron`. Apps declare
input/event schedules and observers in `app.ts`; these routes are owned by the
same atomic App registry generation.

The historical `cron.json` and handler loader is restricted to standalone
global-agent or host-internal system duties:

- **Workflow-backed handlers**: Run a workflow directly (`handler: { "workflow": "...", "agent": "...", "task": "..." }`)
- **JS handlers**: Run deterministic in-process functions (`handler: "evaluate-sessions"`)

Internal handlers may live under the runtime/standalone agent conventions, but
they cannot dispatch App judgment, own domain work, or duplicate an App
subscription/schedule/task route.

See [cron.md](../2a-design/cron.md) for details.

## State Directory

```
.state/
  instances/<name>/
    <agent>.sock              # Unix socket
    <agent>.pid               # PID file
    identity.json             # Instance metadata
  memory/
    <agent>.jsonl             # Task outcomes per agent
  sessions/
    <id>/
      meta.json               # Session metadata (status, kind, agent, task)
      session.jsonl           # Append-only conversation history
      session-compact.jsonl   # Optional active-context/recovery snapshot
      session.eval.jsonl      # Optional append-only evaluation trail
      output/                 # Task deliverables
  event-bodies/               # Content-addressed large event payloads
  cli-tasks/                  # Native coding-worker requests and results
  may.db                      # Authoritative work/admission state plus read projections
```

See [Storage](../2a-design/storage.md) for the authoritative record table.
The `evaluations` SQLite table is the query projection for session summaries.
Historical `.state/evaluations/` files are not the current authority.

## Docker

```bash
# Build and start the background service
bun run recreate

# Attach the May Console
docker exec -it may-agent may-console

# Direct status check
bun src/app/may.ts --status
```

Docker uses `INSTANCE=background` to avoid collision with interactive instances.
