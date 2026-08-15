# How to Use may-agent

## Starting an Instance

```bash
# Run these commands from /app/projects/may-agent.

# Local full stack: chat + cron + console + socket + web UI
./start.sh

# Direct interactive chat with May
bun src/app/may.ts --chat --console --socket

# Direct interactive chat with a different agent
bun src/app/may.ts --agent bob --chat --console --socket

# Full production mode (chat + cron + telegram)
bun src/app/may.ts --chat --console --socket --cron --telegram

# Cron-only daemon (no interactive chat)
bun src/app/may.ts --cron --socket

# One-off task (runs and exits)
bun src/app/may.ts --task "run the daily review"
bun src/app/may.ts --agent bob --task "check your periodic tasks"
```

### Flags

| Flag | Description |
|------|-------------|
| `--chat` | Enable interactive chat session (persistent) |
| `--console` | Enable terminal UI (readline prompt) |
| `--socket` | Enable Unix socket for external control |
| `--cron` | Enable cron jobs (heartbeats, JS handlers, scheduled tasks) |
| `--telegram` | Enable Telegram bot for notifications |
| `--web` | Enable web UI |
| `--status` | Print system dashboard and exit (agent quality, process health, trends) |
| `--status --notify` | Print dashboard and also send it to Telegram |
| `--send <agent> --message "msg"` | Send a message through the running daemon and exit |

At least one of `--chat`, `--cron`, `--task`, `--oneshot`, `--status`,
`--send --message`, `--emit`, `--web`, `--socket`, or `--telegram` is required.

### Environment Variables

| Variable | Effect |
|----------|--------|
| `MODEL_BASE_URL` | Shared model API URL used by Pi, Codex, and Claude. |
| `MODEL_API_KEY` | Credential for the shared model API. Defaults to `not-needed` for an unauthenticated local endpoint. |
| `MAY_DAEMON_QUIET=1` | Suppresses the daemon-mode `info` log forwarder. By default, when neither `--console` nor `--chat` is enabled, the daemon forwards `bus.emit({type:"info"})` events through `log()` so operator-facing messages (reload summaries, telegram diagnostics, startup checks) are visible. Set this to `1` to opt out. |

When `--console` or `--chat` IS enabled, `attachConsoleUI` handles `info`
events (along with session text, tool calls, etc.) and the daemon-mode
forwarder is not attached — avoiding duplicate prints.

### Local Startup

```bash
./start.sh
```

`start.sh` loads `.env`, starts the virtual display/browser helpers, then runs
`bun src/app/may.ts --chat --cron --console --socket --web "$@"`.

For one-off commands, prefer direct `bun src/app/may.ts ...` invocation.

## Chat Session

When `--chat` is enabled, may-agent creates a **persistent chat session** (`ChatSession`).
The session survives across messages. The append-only transcript keeps full
history; long active contexts may use the runtime's compact resume snapshot.

```
you> implement a retry mechanism for failed API calls
      ↓
  ChatSession sends to interface agent's persistent session
  Agent processes, delegates to sub-agents, returns to idle
  
you> now add tests for it
      ↓
  Same session — agent has full context from previous request
```

### Built-in Commands

| Command | Action |
|---------|--------|
| `status` | List all active sessions |
| `cancel` | Cancel current task (session stays alive) |
| `cancel all` | Cancel all running sessions |
| `/new` | Close current session, start fresh on next message |
| `reload` | Scan for new agent.json files and register them |
| `close` | Permanently destroy session + shutdown |
| `restart` | Graceful restart (exit code 100) |
| `Ctrl+C` | Cancel task if running, shutdown if idle |

### @agent Prefix

```
you> @dev fix the failing test in test/retry.test.ts
```

Routes through the interface agent's persistent chat session as an explicit
delegation request. May is instructed to fork the named agent, stay responsive,
peek at the result, and report back.

| | Normal input | `@agent` prefix |
|---|---|---|
| Routes through | Interface agent's persistent session | Interface agent's persistent session |
| Interface agent sees result? | Yes | Yes |
| Session kind | `chat` | `chat` plus May-managed fork |
| Use case | General coordination | Explicit delegation to a named agent |

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

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Must match directory name |
| `description` | Yes | Role summary (visible to other agents) |
| `domain` | Yes | Domain of expertise |
| `model` | Yes | Canonical model ID, such as `claude-opus-5` or `gpt-5.6-sol`. |
| `tools` | Yes | Tool presets (see below) |
| `memoryLimit` | No | Retained compatibility field; omit in new configs because it does not affect current prompt assembly |
| `compaction` | No | Enable automatic context compaction for long sessions |
| `delegateDeny` | No | Block delegation to specific agents |

agent.json is **purely operational** — model, tools, limits, delegation rules.
Always-loaded prompt content lives in `shared/common-sense.md` and the
agent's `AGENTS.md`. Domain docs, tool recipes, lessons, skills, and knowledge
indexes are read on demand.

### Tool Presets

| Preset | Description |
|--------|-------------|
| `coding` | Read, write, edit, and shell tools scoped to the project root |
| `read-only` | Read files only |
| `agents` | Agent cooperation (`call`, `fork`, `context`, `list`, `peek`, `cancel`, `sessions`) |
| `message` | Async human/agent inbox messages |
| `workflow` | Multi-step workflow recipes |
| `background-exec` | Spawn background processes |
| `cron` | Schedule and manage cron jobs |
| `scrape` | Web scraping |
| `query_db` / `query-db` | Read-only DB query tool |
| `system-status` / `system_status` | Runtime status summary |
| `checkpoint` | Persist explicit session checkpoints |
| `cli-delegation` | Start durable native coding-worker tasks through `run_cli_agent` |
| `finish` | Finish the current task with a structured result |

### Adding a New Agent

1. Create `agents/<name>/agent.json`
2. Create `agents/<name>/AGENTS.md` — identity and mission
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`, handlers, or workflows
4. Restart or type `reload` in chat

See [Agent Convention](agent-convention.md) for full directory layout.

## Agent Cooperation

Agents cooperate through these canonical actions on the `agents` tool:

| Action | Type | Description |
|--------|------|-------------|
| `call` | Sync | Block until child agent completes, get result |
| `fork` | Async | Start agent in background, returns sessionId |
| `context` | Query | Read parent/origin/root/workflow context |
| `list` | Query | List available agents and active sessions |
| `peek` | Query | Read a running session's progress |
| `cancel` | Control | Stop a running session |
| `sessions` | Query | Query persisted execution sessions |

The removed `requests` action is not a work lifecycle or routing primitive.
Use App Inbox status for addressed work, task status for desired outcomes, and
sessions/event traces for execution and causality.

`call` is the primary bounded agent cooperation primitive. An asynchronous
message is notification only; durable cross-App work uses a child App request
and durable desired work uses a task.

## Session Kinds

| Kind | Created by | Lifecycle |
|------|-----------|-----------|
| `chat` | ChatSession | Persistent — stays idle between messages. User owns. |
| `job` | `agents.fork` and other background/detached dispatch | Bounded background work with restart recovery policy. |
| `call` | `agents.call`, workflow `ctx.agents.call`, standalone heartbeat agent step | Bounded synchronous work owned by its caller/workflow. |

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

# Send input through the compatibility socket frame. New adapters emit
# human.input.received and one canonical semantic child intent.
echo '{"type":"input","message":"check status"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Send a canonical async message
echo '{"type":"message.created","source":"human:operator","owner":"agent:dev","data":{"from":"human","to":"dev","content":"fix the test","intent":"notify","priority":"P2"}}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Legacy operator shortcut to start a background agent session
echo '{"type":"fork","agent":"dev","task":"fix the test"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Status
echo '{"type":"status"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Manually fire a trigger entry through the control shortcut.
# Domain lifecycle docs should use canonical event names, not trigger.*.
may-agent --emit trigger.metrics-snapshot '{}'

# Emit to the background container/runtime instance
DAEMON_INSTANCE=background may-agent --emit trigger.metrics-snapshot '{}'

# If the daemon runs inside Docker and the host cannot connect to the Unix
# socket namespace, execute the same control command inside the container.
docker exec may-agent may-agent --emit trigger.metrics-snapshot '{}'

# Send a chat-style delegation through the running daemon
DAEMON_INSTANCE=background may-agent --send scout --message "review your active project"

# From a source checkout
bun src/app/may.ts --emit trigger.metrics-snapshot '{}'
```

See [runtime.md](../2a-design/runtime.md) for socket protocol details.

## Events in Practice

You usually interact with events through features, not through the event schema:

| Scenario | What to do |
| --- | --- |
| Manually rerun a cron job | Emit `trigger.<entry-name>` as an operator shortcut, for example `trigger.metrics-snapshot` |
| Publish a changed domain fact | Emit the semantic fact; its App/task route or observation status must already be declared |
| React when a session ends | Use an internal projection or declared App/task subscription; a session event does not own follow-up work |
| React when a metric breaches | Use a declared App/task subscription or host-internal health route; never generic owner fallback |
| Request a result from another App | Create one typed child App delegation and wait on its correlated result |
| Route a blocker outside current ownership | Return evidence to the owning App/task boundary; it delegates to the accountable App |
| Need human input before continuing | Delegate to the `may` App or persist an exact human Condition on the source task |
| Invoke repeated typed App automation | Discover and invoke the App action; validation and `toInput` admit one correlated App request |

`trigger.*` events are control shortcuts. They are useful for operators and
tests, but they are not domain lifecycle events. Domain facts use semantic
names such as `session.end` and `metric.breach`; App requests and escalations
are represented by inbox/dependency records rather than event-pair lifecycles.

Dot-named domain events use the canonical envelope: top-level `type`, `source`,
optional diagnostic ownership/target metadata, and domain context inside
`data`. Flat dot-named socket frames are rejected before persistence. Declared
consumers receive the original event envelope unchanged; domain fields are
under `event.data`.

## Timer And Event Handlers

The long-running host enables scheduling with `--cron`. Agent Apps declare
input/event schedules and observers in `app.ts`; these routes are owned by the
same atomic App registry generation.

The historical `cron.json` and handler loader is restricted to standalone
global-agent or host-internal system duties:

- **Workflow-backed handlers**: Run a workflow directly (`handler: { "workflow": "...", "agent": "...", "task": "..." }`)
- **JS handlers**: Run deterministic in-process functions (`handler: "evaluate-sessions"`)

Internal handlers may live under the runtime/standalone agent conventions, but
they cannot dispatch Agent App judgment, own domain work, or duplicate an App
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
# Start background instance
docker compose -f container/compose.yml up -d

# Start local foreground instance from /app/projects/may-agent
./start.sh

# Direct status check
bun src/app/may.ts --status
```

Docker uses `INSTANCE=background` to avoid collision with interactive instances.
