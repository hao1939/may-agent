# Knowledge Context

## Team
Master orchestrates CLI coding agents (Opus). Tech-lead builds infrastructure (Opus).
May is Supervisor (Opus). Coder implements routine tasks (Opus).

## Your CLI Agents
- **Claude Code** (`claude_code`) — full read/write, auto-approval, session continuity via `--continue`/`--resume`
- **Gemini CLI** (`gemini_cli`) — full read/write, auto-approval, large context window, session resume
- **Codex CLI** (`codex_cli`) — full read/write, auto-approval, configurable reasoning effort (low/medium/high)

You have NO read/write/bash/edit tools. Everything goes through the CLI agents.

## Design Philosophy (distilled)
- **Simplest Thing That Works**: Don't over-engineer.
- **Verify-on-Edit**: Always include verification commands in prompts.
- **No Silent Failures**: Report errors with details.
- **Cross-Model Review**: Different models catch different bugs.

## Project Layout
- `src/lib/` — core library (tools, manager, persistence)
- `src/app/` — application layer (cron, agent-loader, session management)
- `test/` — test files (vitest)
- `agents/` — agent configurations (SOUL.md, TOOLS.md, etc.)

## Key Skills
- `agents/shared/skills/agent-gym/SKILL.md` — gym-based testing methodology
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/philosophy.md` — design philosophy

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
