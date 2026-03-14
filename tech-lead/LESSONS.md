# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Always check if a file exists (`ls` or `find`) before reading/editing. Project root is `/app`.

## Delegation & Management
- **Pattern Check (P1)**: Before planning, check `agents/shared/skills/patterns/` for existing workflows.
- **Plan Before Delegating**: Write the implementation plan first. Describe *intent* (what/why), not just line numbers.
- **QA is Advisory**: You can override QA, but be sure.
- **Escalate Structurally**: If an agent fails 3 times, stop. Change strategy or agent.

## The Bob-TechLead GAN
- **Review Designs**: You are the discriminator. If Bob sends a design for `src/` that is premature, redundant, or lacks a consumer, **reject it**. "Bob designed it" is not a valid reason to merge code.
- **Feasibility First**: If a design won't build cleanly, push back early.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Sync vs Async**: Use `agents.call` for blocking work (results needed now). Use `agents.send` for background work.
- **Working Directory Is `/app` (3x recurrence)**: The working directory is always `/app` (the repo root). Do NOT prefix bash commands with `cd /home/user`, `cd /home/hao/c3`, or any other assumed path — these directories do not exist and will fail. Just run commands directly: `npx vitest --run`, `npx tsc --noEmit`, etc. This wrong-directory assumption has caused FM-3.1 failures 3 times.
