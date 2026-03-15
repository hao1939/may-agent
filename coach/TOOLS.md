# TOOLS — Coach

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, agent configs, coaching reports.

## `bash`
Run shell commands. Use for: system checks, file listings, running tests.

## `agents`
Cooperate with other agents.

| Action | Blocking? | Use |
|--------|-----------|-----|
| `call(agent, task)` | **Yes** | Run agent to completion, get result. |
| `send(agent, message)` | No | Add todo for agent + trigger their heartbeat. Fire-and-forget. |
| `list` | No | See available agents and running sessions. |
| `peek(sessionId)` | No | See recent activity of a running session. |
| `cancel(sessionId)` | No | Kill a running session. |

## Agent Growth Tools (The "Lab")

### `fork_agent`
Create a safe copy of an agent to experiment with.
- `fork_agent("coder", "coder-v2")` → creates `agents/.lab/coder-v2`
- Use before ANY attempt to improve an agent's behavior.
- **Note:** Also copies memory, so the fork remembers what the source knew.

### `verify_agent`
Run a test task on a forked agent and get a result.
- `verify_agent("coder-v2", "tests/fix-type-error.md")` → runs the task
- Returns a score/result. Use to prove your changes worked.

### `promote_agent`
Copy successful changes back to the live agent.
- `promote_agent("coder-v2", "coder")` → copies:
  - `SOUL.md`, `DOMAIN.md`, `TOOLS.md`, `LESSONS.md`
  - `knowledge/*`, `skills/*`
- **Does NOT copy:** `agent.json` (identity/tools), `workspace/`, memory.
- Use only when `verify_agent` passes.

### `discard_agent`
Clean up a failed experiment or temporary fork.
- `discard_agent("coder-v2")` → deletes the fork and its memory.
- Use when the experiment failed or is complete.

## `handoff`
Transfer ownership or request review of an artifact. Writes a P82-compliant entry to SIGNALS.md with automatic read_by tracking, notifies the target agent, and validates the artifact exists.

## `socket_watch`
Monitor Unix domain sockets for live coaching sessions.

| Action | Use |
|--------|-----|
| `connect(socketPath)` | Connect to a running agent's socket |
| `send(watchId, message)` | Send a message through the socket |
| `disconnect(watchId)` | Disconnect from the socket |

## `workflow`
Run multi-step agent sequences. **Blocking.**

| Workflow | What it does |
|----------|-------------|
| `coaching-session` | Structured coaching interaction with an agent |
| `convention-review` | Review agent convention files for correctness |
| `skill-development` | Develop and test new skills |
| `verify-setup` | Verify agent setup and configuration |

## Key Constraints
- ❌ No `cron` tool.
- ⚠️ **P53 Bash Guard**: Bash commands touching protected files (SOUL.md, LESSONS.md, DOMAIN.md, TOOLS.md, heartbeat.md, agent.json) via `>`, `cat`, `python`, `sed` with write intent trigger P53 violations. Recovery: switch to `read()` for reads, `edit()` or `write()` for writes. Don't retry the blocked command — change the tool.
