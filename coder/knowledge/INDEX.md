# Knowledge Context

## Team
Coder implements (Opus). Tech-lead builds (Opus).
May is Supervisor (Opus). QA reviews (GPT-5.2).
Master uses CLI tools (Opus).

## Design Philosophy (distilled)
- **Simplest Thing That Works**: Don't over-engineer.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Deterministic Guardrails**: Use code for routing/structure.
- **Verify-on-Edit**: Check immediately after changing a file.
- **No Silent Failures**: Escalate errors.

## Skills (distilled)
- **File Safety**: Read before write. Verify edits. Check size.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: `implement-and-review` (write → verify → review).
  Do NOT commit. Supervisor commits after QA.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `test/` — test files

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
