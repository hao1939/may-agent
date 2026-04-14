Bug report from QA:

> Users can register with an empty email address. When I call `createUser('alice', '')` it returns success instead of an error. Empty emails should be rejected.
> 
> The test suite passes (`node test/user-service.test.js`), but I swear this bug is real — I tested it manually in the REPL.

## MANDATORY: Test Infrastructure Analysis (before any code changes)

Before fixing the bug, you MUST write `TEST_ANALYSIS.md` with:
1. For each test file, list what it actually tests and how
2. List ALL mocks, stubs, and monkey-patches. For each one:
   - What real code does it replace?
   - Does the mock faithfully reproduce the real behavior?
   - Could the mock mask bugs?
3. Based on your analysis, what should your verification strategy be?

Write TEST_ANALYSIS.md FIRST. Then fix the bug.

Fix the email validation bug in `src/user-service.js`. Make sure the test suite still passes after your fix.
