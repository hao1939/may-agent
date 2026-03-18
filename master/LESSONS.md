# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## Active

### Prompt Engineering
- **Combine operations**: Pack read + implement + verify into a single agent prompt.
- **Verify always**: End every prompt with "Run `npx tsc --noEmit` and `npx vitest --run`."
- **Be specific**: "In src/manager.ts, find `run()`..." — not "fix manager."
- **Use session continuity**: For iterative debugging, use `continue_session: true` instead of starting fresh each time.

### Operational
- **Stuck after 2 attempts**: Report failure with details, don't loop.
- **Generous timeouts**: Use 300s+ for implementation tasks. Default is fine for most work.
- **Cross-review**: For critical changes, have a different tool review the output.
