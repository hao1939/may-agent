Phase 1: ANALYZE — do NOT modify any source files yet.

This utility library has multiple failing tests. Your job is to find ALL of them before fixing anything.

1. Run `node test.js` to see which tests fail
2. Read the test output carefully — count every failing test
3. For EACH failing test, identify:
   - Which file needs to be changed (math.js, string.js, package.json, etc.)
   - What specific fix is needed
4. Write your complete analysis to ANALYSIS.md with a table listing every issue found

You MUST identify ALL failing tests — not just the first one or two. Do NOT edit any source files in this phase. Only create ANALYSIS.md.

---

Phase 2: FIX ALL ISSUES — based on your analysis.

Read your ANALYSIS.md from Phase 1. It contains the complete list of issues you identified.

Fix EVERY issue listed in your analysis:
- Apply each fix to the correct file
- After fixing ALL issues, run `node test.js` to verify ALL 9 tests pass
- If any tests still fail, identify what you missed and fix it

Do NOT stop after fixing just one or two issues. ALL 9 tests must pass. Don't modify the test file.
