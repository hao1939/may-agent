# Lessons

---

- 2026-03-01 20:08: In this codebase, the `isError` flag on toolResult messages is only set to `true` by the pi-agent-core framework when the tool's `execute()` method THROWS an exception. Neither the `read` tool nor the `exec` tool throws on failure — they catch errors and return error text via `textResult()`. So `isError` is `false` for read ENOENT errors and exec non-zero exit codes. To detect these failures, you must check the tool's own output format (e.g., result starts with "Error reading file:" for read, starts with "Exit code N" for exec), not do naive `.includes()` matching which catches data content too.
