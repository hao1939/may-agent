# Master — Tools

## claude_code
Invoke Claude Code to implement code changes. Runs with auto-approval and full project access.

**Parameters:**
- `prompt` (string, required) — The task description. Be specific about files, constraints, verification.
- `timeout` (number, optional) — Timeout in seconds. Default: 300.
- `model` (string, optional) — Model override (e.g. 'claude-opus-4.6', 'sonnet'). Omit to use environment default.
- `continue_session` (boolean, optional) — Continue the most recent conversation.
- `resume_session_id` (string, optional) — Resume a specific conversation by ID.

**Best for:** Multi-file changes, debugging, refactoring, writing tests, fixing compilation errors. Default choice when unsure.

**Session continuity:** Use `continue_session: true` to pick up where the last invocation left off — useful for iterative debugging or multi-step refactors.

**Example prompt:** "In src/overflow.ts, add a new exported function formatBytes(bytes: number): string that converts byte counts to human-readable strings (1024 → '1.0 KB'). Add tests in test/format-bytes.test.ts. Run npx tsc --noEmit and npx vitest --run to verify."

## gemini_cli
Invoke Gemini CLI for analysis, exploration, or code changes with very large context. Runs with auto-approval.

**Parameters:**
- `prompt` (string, required) — The task description. Be specific.
- `timeout` (number, optional) — Timeout in seconds. Default: 300.
- `model` (string, optional) — Model override. Omit to use environment default.
- `resume_session` (string, optional) — Resume a previous session ('latest' or index number).

**Best for:** Codebase analysis, architectural reasoning, large-context tasks, understanding complex interactions across many files.

**Example prompt:** "Analyze the session lifecycle in src/manager.ts. Trace all status transitions from session creation to archival. List every place where session status changes and what triggers each transition."

## codex_cli
Invoke Codex CLI (OpenAI) for implementation or analysis. Runs with full auto-approval and configurable reasoning effort.

**Parameters:**
- `prompt` (string, required) — The task description. Be specific.
- `timeout` (number, optional) — Timeout in seconds. Default: 300.
- `model` (string, optional) — Model override (e.g. 'gpt-5.1-codex-max').
- `reasoning_effort` (string, optional) — 'low', 'medium', or 'high'. Default: 'high'.

**Best for:** Implementation with deep reasoning, alternative perspective for cross-review, large refactors.

**Example prompt:** "Refactor the error classification in src/lib/classify-error.ts. Add proper handling for 401/403 status codes (classify as 'auth'), distinguish timeout vs stream errors, and ensure null errors map to 'unknown' not 'infra'. Add tests."

## Constraints
- ❌ No handoff tool — use `finish()` to report results
- ❌ No read/write/bash/edit — you operate through CLI agents only
- Include artifact paths in finish() messages when reporting results
