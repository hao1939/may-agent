# Lessons

---

## ⛔ #1 Failure Pattern: Blind Overwrite After Truncated Read

**This applies to code fixes, not just verdicts. If you use `write()` after a truncated read, you destroy content you haven't seen.**

- When fixing a bug found during review, do NOT `write()` the entire file if your earlier `read` was truncated.
- Use `sed` with pattern matching for surgical fixes: `sed -i "s/old_pattern/new_pattern/" file`
- Or use `read(path, startLine=N, endLine=M)` to see the full file in sections BEFORE using `write()`.
- A truncated read is never sufficient basis for `write()` — whether you're fixing code or verifying it.
- **The safe fix workflow:** find the bug → use `sed` to fix just that line → re-run tests to confirm.

---

## Review Quality

- Run the actual checks (`npx tsc --noEmit`, `npx vitest --run`) — don't assume they pass based on what the coder reported. Even if the task prompt says "all tests pass", run them yourself. Your value is independent verification.
- Read the actual source files with the `read` tool, not `cat` via exec. The `read` tool provides better error messages and path hints.
- Use relative paths from the project root. Never reference `/home/user/` or other guessed paths.
- When reviewing inside a workflow, the coder's summary is a CLAIM, not a fact. Verify every claim by reading the files and running the checks yourself. If you just echo the coder's summary, you have added zero value to the pipeline.

## Severity Calibration

- Don't flag style preferences or minor naming issues as IMPORTANT. Reserve IMPORTANT for actual bugs, missing error handling, or design problems that affect correctness.
- Don't flag issues that the coder already self-corrected during implementation. Only flag issues present in the final state of the code.
- If tests pass and types check, the bar for CRITICAL should be high — the issue must be a real bug that tests don't cover.

## Reporting

- Be specific: cite exact file names, function names, and the problematic code. "There might be an issue with error handling" is not actionable.
- When reporting FAIL, clearly state what needs to change for it to become PASS.
- If you find issues and have write access, fix them directly rather than just reporting them.

## Available Tools

- You have: `read`, `write`, `exec`. No `Edit` tool. No `MultiEdit` tool.
- For surgical code fixes, use `exec` with `sed -i "s/old/new/" file`.
- For full-file updates, use `write` — but only after a complete read.

## Common Mistakes

- Reporting false positives wastes coder's time on unnecessary fixes. When in doubt, verify the issue exists by reading the code and running tests.
- Don't re-run the entire test suite multiple times if it passed the first time. One pass is sufficient.
- Don't explore unrelated parts of the codebase — focus on the files that were changed.
