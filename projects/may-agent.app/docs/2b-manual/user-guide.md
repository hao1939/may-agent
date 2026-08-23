# How to Use may-agent

## Starting an Instance

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
| `MAY_DAEMON_QUIET=1` | Suppresses the daemon-mode `info` log forwarder. By default, when neither `--console` nor `--chat` is enabled, the daemon forwards `bus.emit({type:"info"})` events through `log()` so operator-facing messages (reload summaries, telegram diagnostics, startup checks) are visible. Set this to `1` to opt out. |

When `--console` or its `--chat` alias is enabled, `attachConsoleUI` handles `info`
events (along with session text, tool calls, etc.) and the daemon-mode
forwarder is not attached — avoiding duplicate prints.

For one-off commands, prefer direct `bun src/app/may.ts ...` invocation.

## Human Requests

Console, Web, Telegram, and control-socket text all admit one durable request
linked to one May App (`appId: may`) Task. Each reconciliation attempt is a
bounded job session; the task, not the session, owns eventual handling and
restart recovery.

```
may> implement a retry mechanism for failed API calls
      ↓
  one May request/task -> first-attempt answer or child App task

may> now add tests for it
      ↓
  a new May App request with bounded conversation context
```

Conversation context can relate the requests, but it never substitutes for a
durable dependency. Long-running work must be represented by the current task,
a child task, or an exact dependency before the current attempt ends.

May may answer directly or send typed input to the responsible App. The target
App then owns its own Task. For example, Runtime deployment work belongs to the
Host Operations App (`appId: may-agent`), not to the May Conversation Task and
not to the bounded agent run named `may`.

### May Console controls

| Command               | Action                                                    |
| --------------------- | --------------------------------------------------------- |
| `/apps [app]`         | List Apps and active Task counts                          |
| `/tasks [app] [all]`  | List the first page of active Tasks, optionally with recent terminal Tasks |
| `/tasks more`         | Continue the exact prior Task list when another page exists |
| `/task <ref>`         | Read one exact Task                                       |
| `/watch [ref]`        | Watch or show one Task                                    |
| `/unwatch`            | Leave the watch without changing the Task                 |
| `/cancel [ref]`       | Cancel the named or currently watched Task                |
| `/reload`, `/restart` | Reload definitions or restart the Runtime                 |
| `/shell`, `/exit`     | Leave Console for a shell, or close only Console          |

Bare text always goes through May. While watching, Console attaches the exact
Task identity so the text becomes natural Task feedback through May; it never
steers an execution session directly.

## Agents

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
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`, handlers, or workflows
4. Restart or invoke the `reload` control

See [Agent Convention](agent-convention.md) for full directory layout.

## Agent Cooperation

Agents cooperate through these canonical actions on the `agents` tool:

| Action     | Type    | Description                                   |
| ---------- | ------- | --------------------------------------------- |
| `call`     | Sync    | Block until child agent completes, get result |
| `fork`     | Async   | Start agent in background, returns sessionId  |
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

## Session Kinds

| Kind   | Created by                                                                 | Lifecycle                                                   |
| ------ | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `chat` | Explicit direct-agent chat                                                 | Persistent execution context; never May App work authority. |
| `job`  | `agents.fork` and other background/detached dispatch                       | Bounded background work with restart recovery policy.       |
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
  may.db                      # Query/projection store
```

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
