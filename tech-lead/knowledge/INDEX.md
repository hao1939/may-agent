# Knowledge Context

## Team
Tech-lead is the Builder (Opus). Drives implementation via coder+QA.
Bob is Architect (Gemini). May is Supervisor (Opus).
Coder implements (Opus). QA reviews (GPT-5.2). Master uses CLI tools (Opus).

## Design Philosophy (distilled)
- **Harness Over Model**: System prompt + tools + middleware > model size.
- **Simplest Thing That Works**: Don't over-engineer. Build for observed failures.
- **Crash Recovery**: Write state to disk. Recover from `[STARTED]` sentinel.
- **Deterministic Guardrails**: Use code for routing/structure, LLM for reasoning.
- **File System as Memory**: Files are context. Directories are indexes.

## Skills (distilled)
- **Agent Coordination**: Use `agents.call` to block/sync, `agents.send` to async/todo.
  Delegate implementation to Coder/Master. Delegate review to QA.
- **File Safety**: Read before write. Verify edits. Don't edit outside workspace
  unless explicitly tasked.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: Use `implement-and-review` for code changes.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `agents/` — agent configs
- `test/` — test files (use `npm test` or `npx tsx test/...`)

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
