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

## MAST Failure Codes
When diagnosing failures, use standardized MAST codes from `agents/shared/knowledge/mast-taxonomy.md`.
- **FM codes** (Failure Mode): *what* went wrong (e.g., FM-1.3 Looping, FM-5.1 Dependency Violation).
- **FC codes** (Failure Cause): *why* it went wrong (e.g., FC-5.1 Error Blindness, FC-1.2 Bad Decomposition).
Use these codes in your analysis reports to drive structural fixes.

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `agents/shared/best-practices.md` — best practices
- `agents/shared/skills/` — full skill guides
