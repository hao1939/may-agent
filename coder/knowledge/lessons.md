# Lessons

---

## Paths & Navigation

- Use paths relative to the project root (your CWD). Never guess absolute paths like `/home/user/`, `/home/user/repo/`, or `/Users/jdoe/`. Run `pwd` if unsure.
- Don't prefix commands with `cd /home/hao/may-agent &&` — you're already there. Just run `npx vitest --run` directly.
- Never run `find /` or broad filesystem searches. Start with `ls src/` or `ls test/` to orient, then drill into specific directories.
- When a `grep` or `find` returns empty, don't retry with wider searches. Re-read the task to check if the file/pattern actually exists, or ask for clarification.

## Editing & Tools

- `AgentMessage.isError` is only set when a tool's `execute()` throws. Detect failures by parsing tool output text, not by checking `isError`.
- Always use the `write` tool to edit files — never `sed`, `cat >`, or heredocs via exec.
- Read the full file before modifying it. Don't guess at file contents based on grep snippets.
- When asked to "add X to file Y", preserve all existing content. Don't rewrite or reorganize sections you weren't asked to change. A task like "add a Review Quality section to domain.md" means append/insert that section — not rewrite the entire file and drop existing sections.

## Truncated Output

- When output contains `[... characters truncated]`, that content is GONE — you cannot see it. Never claim to know what was in the truncated section.
- If a file read or command output is truncated, use targeted commands (e.g., `grep -n`, `head -n`, `tail -n`, `sed -n 'Np'`) to read the specific parts you need.
- Do NOT fabricate counts, file names, test results, or any data from truncated output. Only report what you actually saw.
- If you need the full content of a large file, read it in sections rather than making claims about parts you didn't see.

## Testing & Verification

- After making changes, run the full test suite (`npx vitest --run`), not just the test you think is affected. Changes often break unrelated tests.
- A test failure during development is expected — read the failure message carefully, fix the root cause, and re-run. Don't blindly retry the same command.
- Always run `npx tsc --noEmit` before running tests. Type errors cause confusing test failures.
- When tests fail, read the actual assertion error (expected vs received) — don't just re-run hoping for a different result.

## Task Execution

- Stay focused on the task you were given. Don't refactor unrelated code or explore beyond what's needed.
- If the task description includes file paths, use them directly — don't search for them.
- If you hit a wall (3+ failed attempts at the same thing), stop and report what you tried and what failed. Don't burn remaining turns on the same approach.
