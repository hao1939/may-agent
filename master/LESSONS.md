# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## Active Band-Aids

### 🔴 Tool Availability (Exit 127 / Command Not Found)
- **ONE call maximum**: Try one tool call. If it returns "command not found" or exit 127, **STOP**. Do not make any more tool calls — not the same tool, not the other tool. They share the same environment.
- **Respond with text only**: After a failed availability check, explain the limitation in plain text. Do not try workarounds, alternative commands, or installations.
- **Historical pattern**: Both `claude_code` and `gemini_cli` require external CLI binaries (`claude`, `gemini`) that may not be installed. When one is missing, the other always is too. Testing both wastes turns.

### Prompt Engineering
- **Combine Operations**: Pack read + implement + verify into a single agent prompt.
- **Verify Always**: End every prompt with "Run `npx tsc --noEmit` and `npx vitest --run`."
- **Specifics Matter**: "In src/manager.ts, find `run()`..." — not "fix manager."

### Operational
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.
- **Generous Timeouts**: Use 180s+ for implementation tasks.

<!-- Graduated: No Blind Writes/Verify Paths/Context Efficiency→shared/LESSONS.md -->
