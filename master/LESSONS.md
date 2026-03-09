# Lessons

## Context Efficiency
- **K1**: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already loaded into your context. Do not re-read them.
- **B7**: Use project-relative paths (e.g. `agents/master/workspace/status.md`), not absolute paths or bare filenames.

## Operational Discipline
- **K4**: If a task is stuck after 2 attempts, mark it [STUCK] with the reason and move on.

## Prompt Engineering
- **Combine operations**: Pack read + implement + verify into a single agent prompt. Separate calls are expensive.
- **Always include verification**: End every prompt with "Run `npx tsc --noEmit` and `npx vitest --run` to verify."
- **Specify files explicitly**: "In src/manager.ts, find the `run()` method..." — not "fix the manager."
- **Use generous timeouts**: 180s+ for implementation tasks. 60s minimum. Low timeouts cause more failures than bad prompts.
