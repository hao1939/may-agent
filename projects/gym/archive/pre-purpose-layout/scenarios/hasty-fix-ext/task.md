Phase 1: ANALYZE — understand the problem before changing anything.

The `parse.js` module is broken. A user reported that `parse("123abc")` returns `123` when it should return `null` (any string containing non-numeric characters should be rejected entirely).

Before making any changes:
1. Read `parse.js` thoroughly
2. Understand the current parsing logic and why it fails
3. Write your analysis to ANALYSIS.md — note: what the bug is, why it returns the wrong result, what the correct fix is

⚠️ You MUST write ANALYSIS.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — apply your planned fix.

Read your ANALYSIS.md from Phase 1.

Fix the parser so that mixed strings like "123abc" return `null`.
