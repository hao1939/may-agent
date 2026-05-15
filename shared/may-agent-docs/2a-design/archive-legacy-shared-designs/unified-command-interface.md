# Unified Command Interface

**Status**: Superseded by the control-client/control-socket event surface.
Do not implement this draft directly. Current direction: socket-local
`subscribe`/`status`, all other adapter actions normalized into daemon events
through `packages/control`. See `../2a-design/infra-surface.md`.
**Date**: 2026-05-09

## Problem

The system has 5 entry points (CLI flags, socket, web API, telegram, console) that each implement their own command parsing, dispatch logic, and capabilities. This creates friction:

- Some actions are only available through certain interfaces (`--run-workflow` is CLI-only, `/cancel` is telegram-only)
- Debugging requires knowing which interface and its specific syntax
- New commands must be wired into each interface separately
- The fork dispatch fix (may.ts:639) showed how routing inconsistencies cause real bugs

## Key Insight: Two Execution Contexts

Commands fall into two categories based on *where they execute*:

### 1. Control-plane commands (against a running instance)

These talk to an already-running may-agent process with loaded agents, active sessions, cron, bus, etc. All "remote" interfaces (web, socket, telegram, console) operate in this mode.

| Command | Description |
|---|---|
| `fork` | Start an agent session |
| `cancel` | Cancel a session |
| `cancel_all` | Cancel all sessions |
| `steer` | Send follow-up to a running session |
| `status` | List active sessions |
| `reload` | Reload agent configs |
| `shutdown` | Graceful shutdown |
| `restart` | Restart process |
| `message` | Inter-agent message |
| `emit` | Emit arbitrary bus event |
| `diag` | Lightweight diagnostics |

### 2. Standalone execution (IS the instance)

These bootstrap a new manager, load agents, run one thing, exit. There is no "running instance" to talk to.

| Mode | Description |
|---|---|
| `run <agent> <task>` | Run a single agent session to completion (current `--oneshot`/`--task`) |
| `workflow <name>` | Execute a workflow directly (current `--run-workflow`) |

## Design

### `src/app/commands.ts` — Command Registry

A registry that maps command names to bus events, with validation and help text:

```typescript
interface CommandDef {
  name: string;
  description: string;
  params: Record<string, { type: string; required?: boolean; description: string }>;
  // Some commands return data directly (status, diag); others emit bus events
  execute: (params: Record<string, unknown>, ctx: CommandContext) => CommandResult;
}

interface CommandContext {
  bus: EventBus;
  manager: SubagentManager;
  source: string;  // "socket" | "web" | "telegram" | "console" | "cli"
}

type CommandResult =
  | { ok: true; event?: AgentEvent; data?: unknown }  // event to emit, or data to return
  | { ok: false; error: string };

export function executeCommand(name: string, params: Record<string, unknown>, ctx: CommandContext): CommandResult;
export function parseCliCommand(argv: string[]): { command: string; params: Record<string, unknown> } | null;
export function listCommands(): CommandDef[];
```

### Interface adapters

Each interface becomes a thin translation layer:

**Socket** (`socket.ts`): Replace `normalizeSocketFrame` body with `executeCommand()`. Socket-only commands (`subscribe`) stay local.

**Web** (`web.ts`): Add `POST /api/cmd` endpoint: `{ command, params }` → `executeCommand()` → JSON response.

**Telegram** (`telegram.ts`): `/fork scout check repo` → `parseCliCommand()` → `executeCommand()`.

**Console** (chat mode): Route typed commands through registry before falling through to chatSession.

### CLI: `may-agent cmd` (control-plane) vs `may-agent run` (standalone)

```bash
# ── Control-plane (talks to running instance via socket) ──────────

# Fork an agent
may-agent cmd fork --agent=scout --task="check repo health"

# Status
may-agent cmd status

# Diagnostics
may-agent cmd diag

# Emit event
may-agent cmd emit --event=heartbeat --agent=scout

# Cancel all
may-agent cmd cancel-all

# ── Standalone (IS the instance, no socket needed) ────────────────

# Run agent to completion (replaces --oneshot --task)
may-agent run scout "check repo health"

# Run workflow (replaces --run-workflow)
may-agent workflow scout-heartbeat

# Run workflow dry-run
may-agent workflow scout-heartbeat --dry-run
```

`cmd` connects to the running instance socket at `.state/instances/<instance>/may.sock`, sends the command as JSON, prints the response, exits. Exactly like `socat` but with ergonomic arg parsing.

`run` and `workflow` start a fresh process — they don't need a running instance because they *are* the instance.

### `diag` command

Instant diagnostics across all interfaces:

```json
{
  "uptime": "2h 15m",
  "agents": 14,
  "activeSessions": 3,
  "cronEntries": 12,
  "lastHeartbeats": { "scout": "5m ago", "amy": "1h ago" },
  "socketClients": 2,
  "memoryMB": 182,
  "pid": 12345,
  "instance": "default"
}

```

Pulled from `manager.status()` + `process.memoryUsage()` + process info. No DB queries, instant.

## Backward Compatibility

Existing CLI flags (`--task`, `--oneshot`, `--emit`, `--status`, `--message`, `--run-workflow`) continue to work as aliases. They can be deprecated over time.

Existing socket frame format unchanged — `{"type":"fork","agent":"scout","task":"..."}` still works because the registry handles the same shape.

## Historical Files To Modify

These notes are kept as history, not as a current task list.

1. **New: `src/app/commands.ts`** — Command registry
2. **Old socket module** — Use registry instead of manual normalization
3. **`src/app/may.ts`** — Add `cmd` subcommand, wire existing flags as aliases
4. **Old web adapter** — Add `POST /api/cmd`
5. **`src/app/transport/telegram.ts`** — Route `/command` through registry

## Implementation Order

1. `commands.ts` with definitions + `executeCommand()`
2. Wire socket.ts (most structured consumer, easiest to validate)
3. `may-agent cmd` CLI subcommand
4. `POST /api/cmd` in web.ts
5. Telegram command routing
6. `diag` command
7. Deprecation aliases for old CLI flags

## Verification

1. `echo '{"type":"fork","agent":"scout","task":"test"}' | socat - UNIX-CONNECT:...` — unchanged
2. `may-agent cmd fork --agent=scout --task="test"` — same result via CLI
3. `may-agent run scout "test"` — standalone execution
4. `curl -X POST localhost:8080/api/cmd -d '{"command":"status"}'` — returns status
5. `bun test` passes
