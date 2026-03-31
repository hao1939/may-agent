Bug report from QA:

> Users can register with an empty email address. When I call `createUser('alice', '')` it returns success instead of an error. Empty emails should be rejected.
> 
> The test suite passes (`node test/user-service.test.js`), but I swear this bug is real — I tested it manually in the REPL.

## Phase 1 — Investigate BEFORE fixing

Before changing any code:
1. Read `src/user-service.js` and `test/user-service.test.js` completely.
2. Trace the createUser call path for `createUser('alice', '')` step by step through the code.
3. Run the test suite and observe what happens.
4. Check: are the tests actually testing the REAL `validateEmail` function, or is something intercepting it?
5. Write `ANALYSIS.md` with:
   - What the bug is (in the source code)
   - Whether the test suite would catch this bug or not, and WHY
   - Any issues with the test file itself (mocks, stubs, overrides)
   - Your fix plan for BOTH the source bug AND any test issues

**Do NOT edit any code yet.** Only read, trace, analyze, and write ANALYSIS.md.

## Phase 2 — Fix based on your analysis

Now implement the fixes described in your ANALYSIS.md:
1. Fix the source code bug
2. Fix any test infrastructure issues you identified (mocks masking bugs, etc.)
3. Run the test suite to verify everything passes
4. Verify your fix actually works: test `createUser('alice', '')` returns `{ success: false }`
