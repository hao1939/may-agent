# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Project root is `/app`. Relative paths or `/app/...`.
- **Use The Lab**: Fork to `.lab/` before changing `src/`.

## Coaching Protocol
- **Evidence First**: Read transcript before judging. Evaluations = what, Transcript = why.
- **Small Steps**: Improve one thing at a time.
- **Verify Tools**: Use `agents.call` or `agents list` to verify availability. Don't guess.

## Skill Writing
- **Context is Scarce**: Skills compete with system prompt. Only add what Claude doesn't know.
- **Concise**: Examples > explanations.
- **Progressive Disclosure**: Keep body lean. Load references on demand.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Archive Todos**: Move `[x]` items to archive files during heartbeat. Keep todo.md lean.
