# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Use `ls` or `find` to confirm file existence. Project root is `/app`.

## Prompt Engineering
- **Combine Operations**: Pack read + implement + verify into a single agent prompt.
- **Verify Always**: End every prompt with "Run `npx tsc --noEmit` and `npx vitest --run`."
- **Specifics Matter**: "In src/manager.ts, find `run()`..." — not "fix manager."

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.
- **Generous Timeouts**: Use 180s+ for implementation tasks.
