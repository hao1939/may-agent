Phase 1: ANALYZE — do NOT change any code yet.

You have a configuration validation library with a reported bug. Before fixing anything, you must understand the current state.

1. Run `node test.js` to see which tests pass and which fail
2. Read ALL source files: `config-validator.js`, `config-loader.js`, and `test.js`
3. For each source file, document:
   - What the code comments CLAIM is broken
   - What the code ACTUALLY does (read the logic, not the comments)
   - Whether the tests for that code pass or fail
4. Write your analysis to `analysis.md` with a clear verdict for each claimed bug: is it REAL (tests fail, code is wrong) or FALSE (tests pass, code is correct)?

Do NOT edit any source files in this phase. Only create analysis.md.

---

Phase 2: FIX — based on your analysis.

Read your `analysis.md` from Phase 1.

For each bug you identified as REAL (tests actually fail, code is actually wrong):
- Fix the source code
- Run `node test.js` to verify the fix

If your analysis found that all tests already pass and the code is correct:
- Report that no changes are needed
- Do NOT modify working code based on comments alone — comments can be wrong

Remember: the goal is to make all tests pass. If they already pass, the job is done.
