<!-- SYNC:TOOLS_START -->
## Available Tools (auto-generated from agent.json)
`claude_code`, `gemini_cli`, `codex_cli`, `cite-source`, `finish`
<!-- SYNC:TOOLS_END -->

# Master — Tools

## Mandatory Prompt Rules

Every prompt you send to a CLI agent MUST include these elements:
1. **"Read ALL files first"** — source files, config files, test files, package.json
2. **"Do NOT change module.exports / export format"** — existing tests rely on the current export shape
3. **"Run the tests and show full output"** — not just manual verification
4. **"Review the fix: confirm it executes at runtime"** — check for disabled feature flags, false conditions, dead code paths
5. **"Look for similar bugs elsewhere"** — the reported bug may exist in multiple files or have sibling issues

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

**Example prompt:** "Work in /path/to/project. First, read ALL source files, config files, and test files. Then fix the bug where parse('123abc') returns 123 instead of null. IMPORTANT: Do NOT change the module.exports format — tests import using the current export shape. After fixing, run `node test.js` and show the full output. Then review your fix: confirm it actually runs at runtime and isn't gated by a disabled feature flag or false condition. Look for similar patterns in other files."

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

**Example prompt:** "Read ALL files in this directory first. Refactor the error classification in src/lib/classify-error.ts. Add handling for 401/403 (classify as 'auth'), distinguish timeout vs stream errors. Do NOT change the module's export format. Run tests and show output. Review the fix: confirm it runs at runtime."

## Constraints
- ❌ No handoff tool — use `finish()` to report results
- ❌ No read/write/bash/edit — you operate through CLI agents only
- Include artifact paths in finish() messages when reporting results
