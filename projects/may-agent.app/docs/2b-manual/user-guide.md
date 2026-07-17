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
The session survives across messages — the LLM sees full conversation history, not summaries.

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

| Agent | Model | Role |
|-------|-------|------|
| **may** | opus | Supervisor — delegates, coordinates |
| **bob** | opus | System architect, philosophy, meta-loop |
| **tech-lead** | opus | Designs and supervises implementation |
| **dev** | gpt-5.5 | System reliability, metrics, debugging |
| **qa** | gpt52 | Reviews code |
| **evaluator** | gpt-5.4 | Scores sessions, extracts lessons |
| **optimizer** | opus | Implements system improvements |
| **coach** | opus | Trains agents via fork/verify cycle |
| **master** | opus | Uses CLI agents for complex tasks |
| **arc** | opus | Architecture synthesis |
| **judge** | opus | Convention compliance evaluation |
| **scout** | opus | Research and discovery |
| **amy** | opus | XHS exploration |

The runtime discovers agents from `agents/<name>/agent.json` and project-local
agent roots. Treat this table as the current normal fleet, not a hardcoded
protocol list.

### agent.json Format

```json
{
  "name": "dev",
  "description": "Investigates runtime failures and improves observability",
  "domain": "system reliability, metrics, debugging",
  "model": "opus",
  "tools": ["coding", "query_db", "finish"],
  "memoryLimit": 20,
  "compaction": true
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Must match directory name |
| `description` | Yes | Role summary (visible to other agents) |
| `domain` | Yes | Domain of expertise |
| `model` | Yes | Model key: `opus`, `gpt52`, `gpt-5.4`, `gemini-3.1-pro`, etc. |
| `tools` | Yes | Tool presets (see below) |
| `memoryLimit` | No | Number of recent memory entries in prompt (default: 20) |
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
Use `sessions`, event traces, and the owner inbox.

`call` is the primary cooperation primitive — synchronous, simple, debuggable.
For async communication, use the `message` tool (emits `message.created`).

## Session Kinds

| Kind | Created by | Lifecycle |
|------|-----------|-----------|
| `chat` | ChatSession | Persistent — stays idle between messages. User owns. |
| `job` | Cron, heartbeat, send, task mode | Ephemeral — auto-resumed on restart if stale. |
| `call` | `agents.call` | Ephemeral — parent re-dispatches on its own resume. |

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
|----------|------------|
| Manually rerun a cron job | Emit `trigger.<entry-name>` as an operator shortcut, for example `trigger.metrics-snapshot` |
| React when a session ends | Subscribe a handler to `session.end` and read the result from `event.data` |
| React when a metric breaches | Subscribe a handler to `metric.breach`; the handler should route to the metric owner/workflow |
| Send work to another agent asynchronously | Use `sdk.message(...)` or the `message` tool; this emits `message.created` |
| Route a blocker outside current ownership | Use `sdk.escalate(...)`; for humans use `owner: "human:<role>"` |
| Finish an escalation | Emit `escalation.resolved` or `escalation.dismissed` with a closure link; wake the source owner, which still judges whether the project/task is unblocked |
| Need human input before unblocking | Keep the source work blocked and emit a linked child escalation owned by `human:<role>` with an exact requested action and resume context |

`trigger.*` events are control shortcuts. They are useful for operators and
tests, but they are not domain lifecycle events. Lifecycle docs and handlers
should use canonical event names such as `session.end`, `metric.breach`,
`escalation.created`, and `escalation.resolved`.

Dot-named domain events use the canonical envelope: top-level `type`, `source`,
and `owner`, plus domain context inside `data`. Flat dot-named socket frames are
rejected before persistence. Handler subscriptions receive the original event
envelope unchanged; domain fields are under `event.data`.

## Timer And Event Handlers

Timer-triggered handlers are enabled with `--cron`. The filename is historical:
each agent can have a `cron.json` defining trigger entries.

- **Workflow-backed handlers**: Run a workflow directly (`handler: { "workflow": "...", "agent": "...", "task": "..." }`)
- **JS handlers**: Run deterministic in-process functions (`handler: "evaluate-sessions"`)

Handlers live in `agents/<name>/handlers/` and are auto-discovered.

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
      session.jsonl            # Conversation history
      output/                 # Task deliverables
  evaluations/
    <sessionId>.json          # Session evaluation scores
  may.db                      # events, sessions, workflow_runs, metrics, alerts
```

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
