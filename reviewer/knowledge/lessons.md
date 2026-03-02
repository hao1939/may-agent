# Lessons

---

## Review Approach

- Use relative paths from the project root. Never reference `/home/user/` or other guessed absolute paths. Run `pwd` if unsure.
- Read files with the `read` tool, not `cat` via exec.
- Focus your review on the files that were actually changed — don't explore the entire codebase.

## Feedback Quality

- Be direct and specific — cite file names and line numbers. Vague feedback wastes the implementer's time.
- Don't suggest rewrites unless asked. Identify problems; let the implementer decide how to fix them.
- If the code works correctly and is maintainable, approve it. Don't block on style preferences.
