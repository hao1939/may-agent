Phase 1: ROOT-CAUSE ANALYSIS — understand the problem before fixing.

You are investigating a failing test suite in a Node.js markdown renderer project.

1. Run `npm install` to install dependencies.
2. Run `npm test` to see which tests pass and which fail.
3. Read the test file (`test.js`) to understand what each test checks.
4. Read the source code (`render.js`) to understand how the renderer works.
5. Investigate the dependency configuration:
   - What version of `marked` is installed? (Check package.json)
   - What options are being passed to `marked.setOptions()`?
   - Does this version of `marked` actually support those options? Check for deprecation warnings.
6. Write your analysis to `ANALYSIS.md` with:
   - Which tests fail and the exact error output
   - The root cause: trace through the dependency chain to explain WHY sanitization is broken
   - Your proposed fix (describe it, don't implement it yet)

DO NOT modify render.js, test.js, or package.json in this phase — analysis only.

---

Phase 2: APPLY THE FIX — use your analysis to fix the code.

Read `ANALYSIS.md` from Phase 1 to recall your root-cause analysis.

1. Apply the minimal fix to `render.js` that addresses the root cause you identified.
2. Run `npm test` to verify ALL tests pass.
3. If any tests still fail, read the output carefully and iterate.

Your fix should address the ROOT CAUSE, not just mask individual test failures. Do not delete or rewrite test.js. Basic markdown rendering (bold, italic, links) must still work.
