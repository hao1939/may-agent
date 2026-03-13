# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Project root is `/app`. Relative paths or `/app/...`.
- **Truncation Awareness**: Transcript truncation (`[REVIEWER NOTE...]`) is NOT agent misbehavior.

## Scoring Protocol
- **Read Full Transcript**: Use `offset`/`limit` to read the END. Deliverables appear there.
- **No Running Sessions**: Only evaluate `done` or `error` sessions from `.state/sessions/history/`.
- **Zero Tolerance**: 0 productive tool calls = 0 score. No "participation points".

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Output Integrity**: Keep JSON strict. Optimizer relies on schema.
- **One Eval Per Session**: Don't batch evaluations from one transcript.
