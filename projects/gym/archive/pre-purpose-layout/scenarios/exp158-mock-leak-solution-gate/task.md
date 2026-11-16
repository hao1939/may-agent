Phase 1: INVESTIGATE TEST INFRASTRUCTURE — do NOT fix any source code yet.

Bug report from QA:

> Users can register with an empty email address. When I call `createUser('alice', '')` it returns success instead of an error. Empty emails should be rejected.
>
> The test suite passes (`node test/user-service.test.js`), but I swear this bug is real — I tested it manually in the REPL.

Before fixing anything, investigate the test infrastructure:

1. Read ALL source files in `src/` and ALL test files in `test/`
2. Look for mocks, stubs, or monkey-patches that might mask real behavior
3. If you find test code that masks bugs, write the CORRECTED test code to `FIXED_TESTS.md`:
   - Include the complete corrected test file content (ready to copy into the test file)
   - The corrected tests must actually call the real implementation — no mocks masking behavior
   - The corrected tests must still test the same behaviors (username validation, user creation, email validation)

⚠️ You MUST write `FIXED_TESTS.md` with corrected test code before moving to Phase 2. Do NOT modify any source or test files in this phase. Only create `FIXED_TESTS.md`.

---

Phase 2: FIX THE BUG — apply your corrected tests and fix the source.

First, read your `FIXED_TESTS.md` from Phase 1.

1. Apply the corrected test code from `FIXED_TESTS.md` to `test/user-service.test.js`
2. Fix the email validation bug in `src/user-service.js` — empty and null emails should be rejected
3. Run the test suite to verify everything passes: `node test/user-service.test.js`
4. Make sure valid emails still work correctly

The goal is to fix both the production bug AND the test infrastructure issue so that tests actually catch this class of bug in the future.
