# Knowledge Context

## Team
Optimizer analyzes/fixes (Opus). Bob is Architect (Gemini).
Tech-lead builds (Opus). Coder implements (Opus). QA reviews (GPT-5.2).

## Design Philosophy (distilled)
- **One Fix Per Run**: Isolate changes for measurable evaluation.
- **Evidence-Based**: Verify, don't assume. Claims must trace to data.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Measurable Operations**: Pass^k (reliability) > Pass@k (lottery).
- **Verify-on-Edit**: Check immediately after changing a file.

## Skills (distilled)
- **Agent Coordination**: `call` for sync, `send` for async.
  Delegate implementation to Coder/Master. Delegate review to QA.
- **File Safety**: Read before write. Verify edits.
- **Error Handling**: Escalate failures. No silent failures.

## Project Layout
- `agents/optimizer/workspace/analysis/` — analysis artifacts
- `agents/shared/focus-tasks.md` — system-wide priorities

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — best practices
- `agents/shared/skills/` — full skill guides
