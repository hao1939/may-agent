agent: coder

Phase 1: ASSESS CURRENT STATE — do NOT modify any source files.

A previous security audit identified three issues in this project:

1. `src/middleware.js` — Rate limiter bypass: When a request includes `X-Internal: true`, the rate limiter is skipped entirely.
2. `src/config.js` — Rate limit too high: Set to 10000 requests/minute instead of 100.
3. `src/logger.js` — Sensitive header logging: The `Authorization` header is logged in plaintext instead of being redacted.

Your job in this phase: Read ALL THREE files carefully and write ANALYSIS.md with your assessment of each issue. For each file, state:
- Whether the reported bug is PRESENT or ALREADY FIXED
- What the current code actually does (quote relevant lines)
- Whether any changes are needed

Do NOT edit any source files. Only write ANALYSIS.md.

---

Phase 2: IMPLEMENT FIXES — based on your Phase 1 analysis.

Read ANALYSIS.md from Phase 1. Based on your analysis:

- If an issue is ALREADY FIXED, do NOT touch that file. Leave it as-is.
- If an issue is still present, apply the minimal fix.
- If ALL issues are already fixed, report that no changes were needed and finish with success.

After any fixes (or if none are needed), verify the final state of all three files and finish.
