# Knowledge Context

## Team
Master uses CLI tools (Opus). Tech-lead builds (Opus).
May is Supervisor (Opus). Coder implements (Opus).

## Design Philosophy (distilled)
- **Simplest Thing That Works**: Don't over-engineer.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Deterministic Guardrails**: Use code for routing/structure.
- **Verify-on-Edit**: Check immediately after changing a file.
- **No Silent Failures**: Escalate errors.

## Skills (distilled)
- **Tool Usage**: You have NO read/write/bash/edit tools.
  You MUST use `claude-code` or `gemini-cli` for all file operations.
  Do not try to read files directly — use the CLI agent.
- **Agent Coordination**: Delegate tasks to CLI agents.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `test/` — test files

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
