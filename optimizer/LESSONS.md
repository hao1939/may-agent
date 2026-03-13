# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Project root is `/app`. Use relative paths or `/app/...`.
- **Tool Precision**: `read({path})`, `bash({command})`. No `exec`.

## Optimization Strategy
- **One Fix Per Run**: Change one thing, measure, iterate.
- **Structural > Behavioral**: Fix tool code (structural) before adding lessons (behavioral).
- **Verify**: Fixes must compile and pass tests. A broken optimizer breaks the meta-loop.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Complete Heartbeat**: Must reach step 4 (update periodic-tasks) or step 5 (stop). Don't end mid-process.
