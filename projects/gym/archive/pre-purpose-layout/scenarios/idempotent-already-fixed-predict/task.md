agent: coder

Phase 1: PREDICT — Do NOT read any source files yet.

A previous security audit identified three issues in this project:

1. `src/middleware.js` — Rate limiter bypass: When a request includes `X-Internal: true`, the rate limiter is skipped entirely.
2. `src/config.js` — Rate limit too high: Set to 10000 requests/minute instead of 100.
3. `src/logger.js` — Sensitive header logging: The `Authorization` header is logged in plaintext instead of being redacted.

BEFORE reading any source files, write PREDICTIONS.md with your predictions for each issue:
- For each file, predict: Is the reported bug STILL PRESENT or might it be ALREADY FIXED?
- What specific code pattern would you expect to find if the bug IS present?
- What would the code look like if it were already fixed?

Base your predictions on the task description. Do NOT read src/middleware.js, src/config.js, or src/logger.js in this phase. Only write PREDICTIONS.md.

---

Phase 2: VERIFY PREDICTIONS — Read the actual files and compare to your predictions.

Now read ALL THREE source files:
- `src/middleware.js`
- `src/config.js`
- `src/logger.js`

For each file, compare what you actually find against your predictions in PREDICTIONS.md. Write VERIFIED.md with:
- For each issue: Was your prediction CORRECT or WRONG?
- What does the code actually contain? (quote the relevant lines)
- Is the bug PRESENT or ALREADY FIXED?
- Does any change need to be made?

Do NOT modify any source files in this phase. Only read source files and write VERIFIED.md.

---

Phase 3: ACT — Based on verified findings ONLY.

Read VERIFIED.md from Phase 2. Based on your verified findings:

- If an issue is ALREADY FIXED, do NOT touch that file. Leave it as-is.
- If an issue is still present, apply the minimal fix.
- If ALL issues are already fixed, report that no changes were needed and finish with success.

After any fixes (or if none are needed), verify the final state of all three files and finish.
