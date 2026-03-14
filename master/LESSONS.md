# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Use `ls` or `find` to confirm file existence. Project root is `/app`.

## 🔴 Tool Availability (Exit 127 / Command Not Found)
- **ONE call maximum**: Try one tool call. If it returns "command not found" or exit 127, **STOP**. Do not make any more tool calls — not the same tool, not the other tool. They share the same environment.
- **Respond with text only**: After a failed availability check, explain the limitation in plain text. Do not try workarounds, alternative commands, or installations.
- **Historical pattern**: Both `claude_code` and `gemini_cli` require external CLI binaries (`claude`, `gemini`) that may not be installed. When one is missing, the other always is too. Testing both wastes turns.

## Prompt Engineering
- **Combine Operations**: Pack read + implement + verify into a single agent prompt.
- **Verify Always**: End every prompt with "Run `npx tsc --noEmit` and `npx vitest --run`."
- **Specifics Matter**: "In src/manager.ts, find `run()`..." — not "fix manager."

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.
- **Generous Timeouts**: Use 180s+ for implementation tasks.
