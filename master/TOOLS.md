# Master — Tools

## claude_code
Invoke claude-code to implement code changes. Claude-code has full read/write access
to the project and runs with auto-approval.

**Parameters:**
- `prompt` (string, required) — The task description. Be specific.
- `timeout` (number, optional) — Timeout in seconds. Default: 120. Increase for complex tasks.

**Best for:** Multi-file changes, debugging, refactoring, writing tests, fixing
compilation errors. Default choice when unsure.

**Example prompt:** "In the may-agent project at /home/hao/may-agent, add a new
exported function formatBytes(bytes: number): string to src/overflow.ts. It should
convert byte counts to human-readable strings (1024 → '1.0 KB'). Add tests in
test/format-bytes.test.ts. Run npx tsc --noEmit and npx vitest --run to verify."

## gemini_cli
Invoke gemini-cli for analysis, exploration, or code changes with very large context.
Gemini-cli has full read/write access to the project and runs with auto-approval.

**Parameters:**
- `prompt` (string, required) — The task description. Be specific.
- `timeout` (number, optional) — Timeout in seconds. Default: 120. Increase for complex tasks.

**Best for:** Codebase analysis, architectural reasoning, large-context tasks,
understanding complex interactions across many files.

**Example prompt:** "Analyze the session lifecycle in /home/hao/may-agent/src/manager.ts.
Trace all status transitions from session creation to archival. List every place
where session status changes and what triggers each transition."
