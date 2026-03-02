# Lessons

---

## Review Quality

- Run the actual checks (`npx tsc --noEmit`, `npx vitest --run`) — don't assume they pass based on what the coder reported.
- Read the actual source files with the `read` tool, not `cat` via exec. The `read` tool provides better error messages and path hints.
- Use relative paths from the project root. Never reference `/home/user/` or other guessed paths.

## Severity Calibration

- Don't flag style preferences or minor naming issues as IMPORTANT. Reserve IMPORTANT for actual bugs, missing error handling, or design problems that affect correctness.
- Don't flag issues that the coder already self-corrected during implementation. Only flag issues present in the final state of the code.
- If tests pass and types check, the bar for CRITICAL should be high — the issue must be a real bug that tests don't cover.

## Reporting

- Be specific: cite exact file names, function names, and the problematic code. "There might be an issue with error handling" is not actionable.
- When reporting FAIL, clearly state what needs to change for it to become PASS.
- If you find issues and have write access, fix them directly rather than just reporting them.

## Common Mistakes

- Reporting false positives wastes coder's time on unnecessary fixes. When in doubt, verify the issue exists by reading the code and running tests.
- Don't re-run the entire test suite multiple times if it passed the first time. One pass is sufficient.
- Don't explore unrelated parts of the codebase — focus on the files that were changed.
