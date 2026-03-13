# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Project root is `/app`. Relative paths or `/app/...`.
- **Identity**: Files at `agents/may/`.

## Operational Discipline
- **Action Over Reporting**: Dispatch approved todos immediately. Don't list backlog.
- **Brevity**: Heartbeats ≤ 200 tokens. Actions + Failures only.
- **Proactive Reporting**: Report results to Hao immediately upon task completion.

## Cooperation
- **Call vs Send**: Use `agents.call` for blocking work (results needed now). Use `agents.send` for background work.
- **Fallback**: If coder callDeny, use `workflow.run("implement-and-review", task)`.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
