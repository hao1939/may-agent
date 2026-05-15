<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)

<!-- SYNC:TOOLS_END -->

# TOOLS — Coach

## `read` / `write` / `edit`
Read, write, and edit files. Use for workspace files, agent configs, coaching reports.

## `bash`
Run shell commands. Use for: system checks, file listings, running gym scenarios.

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

### `promote_agent`
Copy successful changes back to the live agent.
- `promote_agent("coder-v2", "coder")` → copies config/knowledge files.
- **Does NOT copy:** `agent.json`, `workspace/`, memory.
- Use only when gym tests pass.

### `discard_agent`
Clean up a failed experiment or temporary fork.
- `discard_agent("coder-v2")` → deletes the fork.

## Gym Runner
Test agents (or forks) against scenarios with automated scoring:
```bash
# Baseline
bash test/gym/run-gym.sh <scenario> --agent <agent> --timeout 3

# Test a .lab/ fork
bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork-name> --timeout 3

# List scenarios
bash test/gym/run-gym.sh --list --tier smoke

# Run batch
bash test/gym/run-gym.sh --run-all --tier smoke --agent <agent>
```
Output: JSON with `{ passed, checks[], summary }`.
Do NOT use git stash/checkout/branch — `--lab` handles isolation.

## `workflow`
Run multi-step agent sequences. **Blocking.**

| Workflow | What it does |
|----------|-------------|
| `growth-cycle` | Fix an error pattern or learn a method (pass `learn:<method>`) |
| `training-sprint` | Batch 3-5 experiments: diagnose, fork, gym test, promote/discard |

## `checkpoint`
Save progress during long-running tasks. Call it directly — it's a native tool like `read`/`write`/`bash`.

```
checkpoint({ summary: "What I accomplished so far", data: { key: "value" } })
```

⚠️ **NOT a shell command** — `bash("checkpoint ...")` will fail (exit code 127).
⚠️ **NOT an agent** — `agents.call("checkpoint", ...)` will fail (not registered).

## `finish()` — Deliverables Rule (STRICT)
1. **Default: `deliverables: []`**. Put findings in summary text, not files.
2. If you need a file: `write()` it FIRST, then list in finish().
3. Never list a path you haven't written THIS session.
4. If finish() fails, retry immediately with `deliverables: []`.

## Key Constraints
- ❌ No `cron` tool.
- ⚠️ **P53 Bash Guard**: Bash commands touching protected files (SOUL.md, LESSONS.md, DOMAIN.md, TOOLS.md, heartbeat.md, agent.json) via `>`, `cat`, `python`, `sed` with write intent trigger P53 violations. Use `read()` for reads, `edit()` or `write()` for writes.
