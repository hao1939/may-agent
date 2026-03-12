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

## Agent Growth Tools

### `fork_agent(source, forkName)`
Create a safe copy of an agent to experiment with.
`fork_agent("coder", "coder-v2")` creates `agents/.lab/coder-v2`.
- Use before attempting to improve an agent's behavior.

### `verify_agent(forkName, taskFile)`
Run a test task on a forked agent and get a result.
`verify_agent("coder-v2", "tests/fix-type-error.md")` runs the task and returns a score.
- Use after modifying the fork.

### `promote_agent(forkName, target)`
Copy successful changes back to the live agent.
`promote_agent("coder-v2", "coder")` copies config/knowledge files.
- Use when the fork passes verification tests.

### `discard_agent(forkName)`
Clean up a failed experiment or temporary fork.
`discard_agent("coder-v2")` deletes the fork.
- Use when the experiment failed or is complete.

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
