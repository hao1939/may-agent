# How to Use may-agent

## Starting an Instance

```bash
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
| `--status` | Print system dashboard and exit (agent quality, process health, trends) |
| `--status --notify` | Print dashboard and also send it to Telegram |
| `--send <agent> --message "msg"` | Send a message through the running daemon and exit |

At least one of `--chat`, `--cron`, `--task`, `--oneshot`, `--status`, `--message`, or `--emit` is required.

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
you> @coder fix the failing test in test/retry.test.ts
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

### Built-in agents

| Agent | Model | Role |
|-------|-------|------|
| **may** | opus | Supervisor — delegates, coordinates |
| **bob** | gemini-3-pro | System architect, philosophy, meta-loop |
| **tech-lead** | opus | Designs and delegates implementation |
| **coder** | opus | Writes code, runs tests |
| **qa** | gpt-5.2 | Reviews code |
| **evaluator** | gpt-5.4 | Scores sessions, extracts lessons |
| **optimizer** | opus | Implements system improvements |
| **coach** | opus | Trains agents via fork/verify cycle |
| **master** | opus | Uses CLI agents for complex tasks |
| **scout** | opus | Research and discovery |
| **amy** | opus | XHS exploration |
| **amy-kimi** | kimi | XHS exploration (Kimi model) |

### agent.json Format

```json
{
  "name": "coder",
  "description": "Writes code, runs tests — does not commit",
  "domain": "may-agent implementation",
  "model": "opus",
  "tools": ["coding", "agents"],
  "maxTurns": 30,
  "memoryLimit": 20,
  "delegateDeny": { "agents": ["coder"], "hint": "Use agents.call instead" }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Must match directory name |
| `description` | Yes | Role summary (visible to other agents) |
| `domain` | Yes | Domain of expertise |
| `model` | Yes | Model key: `opus`, `gpt52`, `gpt-5.4`, `gemini-3.1-pro`, etc. |
| `tools` | Yes | Tool presets (see below) |
| `maxTurns` | No | Max assistant turns before auto-abort |
| `memoryLimit` | No | Number of recent memory entries in prompt (default: 20) |
| `delegateDeny` | No | Block delegation to specific agents |

agent.json is **purely operational** — model, tools, limits, delegation rules.
Always-loaded prompt content lives in `agents/shared/common-sense.md` and the
agent's `AGENTS.md`. Domain docs, tool recipes, lessons, skills, and knowledge
indexes are read on demand.

### Tool Presets

| Preset | Description |
|--------|-------------|
| `coding` | Read + write files, shell execution (aliased from `read-write` + `exec`) |
| `read-write` | Read and write files |
| `read-only` | Read files only |
| `exec` | Shell execution |
| `exec-readonly` | Shell execution, no file writes |
| `exec-master` | Shell execution with higher output limits |
| `claude-code` | Spawn Claude Code subprocess |
| `gemini-cli` | Spawn Gemini CLI subprocess |
| `agents` | Agent cooperation (call/send/list/peek/cancel) |
| `workflow` | Multi-step workflow recipes |
| `background-exec` | Spawn background processes |
| `socket-watch` | Watch agent sessions via socket |
| `cron` | Schedule and manage cron jobs |
| `scrape` | Web scraping |
| ~~`agent-growth`~~ | *(removed — growth is agent-scope, not infra)* |

### Adding a New Agent

1. Create `agents/<name>/agent.json`
2. Create `agents/<name>/AGENTS.md` — identity and mission
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`, `skills/*.md`, handlers, or workflows
4. Restart or type `reload` in chat

See [Agent Convention](agent-convention.md) for full directory layout.

## Agent Cooperation (V2)

Agents cooperate through 7 actions on the `agents` tool:

| Action | Type | Description |
|--------|------|-------------|
| `call` | Sync | Block until child agent completes, get result |
| `fork` | Async | Start agent in background, returns sessionId |
| `context` | Query | Read parent/origin/root/workflow context |
| `list` | Query | List available agents and active sessions |
| `peek` | Query | Read a running session's progress |
| `cancel` | Control | Stop a running session |
| `requests` | Query | Inspect tracked sessions/requests |

`call` is the primary cooperation primitive — synchronous, simple, debuggable.
For async communication, use the `message` tool (emits `message.created`).

## Session Kinds

| Kind | Created by | Lifecycle |
|------|-----------|-----------|
| `chat` | ChatSession | Persistent — stays idle between messages. User owns. |
| `job` | Cron, heartbeat, send, task mode | Ephemeral — auto-resumed on restart if stale. |
| `call` | `agents.call` | Ephemeral — parent re-dispatches on its own resume. |

See [sessions.md](../sessions.md) for details.

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

# Send input
echo '{"type":"input","message":"check status"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Run a specific agent
echo '{"type":"fork","agent":"coder","message":"fix the test"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Status
echo '{"type":"status"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock

# Emit a daemon event through the convention socket path
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

See [runtime.md](../runtime.md) for socket protocol details.

## Cron System

Cron is enabled with `--cron`. Each agent can have a `cron.json` defining jobs:

- **Heartbeat jobs**: Run a heartbeat workflow that starts a fresh agent task session (`handler` entry, `type` remains `"job"` or omitted)
- **JS handlers**: Run in-process functions (`handler: "evaluate-sessions"`)
- **Detached agent tasks**: Spawn an agent task in a separate OS process (`agent` + `message`)
- **Pre-checked heartbeats**: Check if work exists before spawning LLM session

Handlers live in `agents/<name>/handlers/` and are auto-discovered.

See [cron.md](../cron.md) for details.

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
    history/
      <id>/                   # Archived sessions
  evaluations/
    <sessionId>.json          # Session evaluation scores
  workflows/
    <runId>.json              # Workflow execution records
```

## Docker

```bash
# Start background instance
docker compose -f container/compose.yml up -d

# Start local foreground instance
./start.sh

# Direct status check
bun src/app/may.ts --status
```

Docker uses `INSTANCE=background` to avoid collision with interactive instances.
