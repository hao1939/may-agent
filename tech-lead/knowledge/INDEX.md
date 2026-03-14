# Knowledge Context

## ⚠️ Verify-Before-Return (READ THIS)
See `knowledge/verify-before-return.md` — 31% of your "Done" messages are lies.
Before reporting success: `tsc --noEmit` + `npx vitest --run` + intent check. Quote evidence.

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

## MAST Failure Codes
When reporting implementation failures, use standardized MAST codes from `agents/shared/knowledge/mast-taxonomy.md`.
- **FM codes** (Failure Mode): *what* went wrong (e.g., FM-1.3 Looping, FM-5.1 Dependency Violation).
- **FC codes** (Failure Cause): *why* it went wrong (e.g., FC-5.1 Error Blindness, FC-1.2 Bad Decomposition).

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
