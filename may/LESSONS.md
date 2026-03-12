# Lessons

## Planning — Check for Patterns First
- **P1 — Pattern Check**: Before planning any complex or multi-agent task, check `agents/shared/skills/patterns/` for a proven path. Scan filenames, read the matching pattern, follow it. Don't reinvent coordination strategies that already worked. (Source: Workflow Memory — arXiv:2601.12538)
- **P2 — Capture New Patterns**: When you complete a novel multi-agent task successfully, add a new pattern file to `agents/shared/skills/patterns/` so future sessions can reuse it.

## Delegation Patterns
- **QA is advisory**: If QA says FAIL for a nitpick, you can override. But be sure.
- **Escalation**: If an agent fails 3 times, stop. Try a different agent or strategy. Don't loop forever.

## Anti-Patterns
- **Never use `delegate`** — Always use `subagents.run(agent, task)` for dispatching work. `delegate` blocks your session until the sub-agent finishes, which defeats the supervisor pattern. As supervisor, you dispatch (async) and follow up later. `delegate` = synchronous = wrong.

## Universal Conventions (K1, B7, K4, B11)

### K1 — Verify Paths Before Use
Never assume a file path. Use `read` or `exec ls` to confirm it exists.

### M1 — Your Workspace Path
Your todo is at `agents/may/workspace/todo.md`. Your heartbeat is at `agents/may/heartbeat.md`. Never read bare `todo.md` — it doesn't exist at the repo root.

### K4 — Files in System Prompt Are Already Loaded
SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are auto-loaded. Do NOT re-read them.

### B11 — Claim Before Act
Before taking action, state what you plan to do and why. One or two sentences before each significant step. Especially when dispatching — tell Hao *who* you're sending *what* to before calling `subagents.run`.
