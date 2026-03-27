# Event Loop & Input Routing

Status: **Implemented**

## Input Flow

### ChatSession (--chat mode)

User input goes through `ChatSession.handleInput()`:

1. **Built-in commands** (`status`, `cancel`, `reload`, `/new`, etc.) — handled directly, no LLM
2. **@agent prefix** (`@coder fix the test`) — ephemeral `kind: "job"` session on target agent
3. **Normal message** — routed to the persistent chat session:
   - If no session yet → `manager.run(agent, message, { kind: "chat", autoClose: "never" })`
   - If session exists → `manager.input(sessionId, message)` (wakes if idle)

`manager.input()` either wakes an idle session (`agent.prompt(message)`) or
steers a running session (`agent.steer(message)`).

### Socket Commands

Socket commands (`src/app/ui/socket.ts`) route through `handleCommand()` in `may.ts`:

| Command | Route |
|---------|-------|
| `input` | → `handleInput(message)` (same as typing in console) |
| `steer` | → `manager.steer(sessionId, message)` (explicit session targeting) |
| `run` | → `manager.run(agent, message, { kind: "job" })` or ChatSession `@agent` |
| `cancel` | → `manager.cancel(sessionId)` |
| `cancel_task` / `cancel_all` | → cancel interface or all sessions |
| `status` | → list active sessions |
| `reload_agents` | → re-scan agent.json configs |
| `close` / `restart` | → shutdown / exit code 100 |

### Cron (--cron mode)

Cron entries fire via `Cron` class timers:
- **JS handler** → run in-process, no LLM session
- **Agent task** → `manager.run(agent, message, { kind: "job" })`
- **Heartbeat** → fire into persistent session via `followUp` (type `"heartbeat"` in cron.json)

## Event Channels

Every `RunnerEvent` carries an optional `channel` tag:

- `"chat"` — direct conversation with the user (May's text responses)
- `"activity"` — background work (sub-agent tool calls, cron activity)

Default is `"activity"`. UI layers filter by channel:
- Console: chat renders normally, activity renders dimmed
- Telegram: only forwards `chat` channel text events from the interface agent
- Socket: clients receive the `channel` field and filter client-side

## Ctrl+C Behavior

- While agent is running → `chatSession.cancelAll()` (cancels all sessions)
- While idle → graceful shutdown
- Module-scope `cancelledOnce` flag prevents double-exit race

## Cron Tool

Agents with the `"cron"` tool preset can CRUD their own `cron.json` entries:

| Action | Description |
|--------|-------------|
| `list` | Show entries + report whether cron is active |
| `add` | Add entry (name, intervalMs, message) |
| `remove` | Remove by name |
| `update` | Modify existing entry |

Writes to `agents/<name>/cron.json` and calls `cron.reload()`.
Cron is off unless `--cron` flag is passed, but the tool's CRUD always works
(agents can define jobs for when cron is enabled later).

## What Changed from V1

| V1 | V2 |
|---|---|
| `steer()` vs `followUp()` routing | `manager.input()` handles both (steer if running, wake if idle) |
| `send()` method (steer+wake combined) | Removed — `input()` replaces it |
| Non-blocking followUp everywhere | ChatSession uses `input()`, cron uses `run()` |
| Notification queue + drain timer | Removed — sync `callAgent` returns directly |
| One persistent session, wake/sleep cycle | ChatSession: one persistent session, same wake/sleep but via `input()` |
