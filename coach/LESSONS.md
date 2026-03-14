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

## Tool Precision
- **`read` takes `path`, not `command`**: The `read()` tool accepts `{path, offset, limit}`. Never pass `command` to `read()` — that's `bash()`.
- **`bash` always needs `command`**: Never call `bash({})` empty. Always provide `bash({command: "..."})`.
- **P53 hits → switch to `read()`**: If `bash cat` is blocked by P53, use `read(path)` instead. Don't retry the same blocked command.
- **P53 block = design signal**: When `.lab/` fork edit is blocked by P53, use `bash` to write to the fork (P53 bash guard allows `.lab/`). Don't bypass by editing live files directly — that defeats the fork→verify→promote workflow.

## Context Management
- **Don't dump large files**: Use `read(path, {limit: 30})` or `bash head/tail` to preview files. Only read full content when you need specific details.
- **Synthesize, don't accumulate**: After reading 3+ sources, pause and write findings. Don't read 10 files and then try to synthesize all at once.
- **Write deliverables incrementally**: For investigation tasks, write partial findings to the output file early and append. Don't wait until the end.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Archive Todos**: Move `[x]` items to archive files during heartbeat. Keep todo.md lean.
