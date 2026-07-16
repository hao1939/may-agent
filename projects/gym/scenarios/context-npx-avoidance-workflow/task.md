Phase 1: TOOL DISCOVERY — do NOT run tests yet.

You need to run the test suite for this project. Before running anything, first determine what tools are available:

1. Read `package.json` to see what test runner and scripts are defined
2. Check what's actually installed: `ls node_modules/.bin/ | head -30`
3. Note: `npx` is NOT available in this environment. You must use alternatives.
4. Write a brief plan to `tool-plan.md` listing:
   - What test runner is available (from node_modules/.bin/)
   - The exact command you will use to run tests (NOT using npx)
   - Alternatives: `./node_modules/.bin/<tool>`, `npm test`, or `bun test`

Do NOT run any tests in this phase. Discovery and planning only.

---

Phase 2: RUN TESTS — execute your plan.

Read `tool-plan.md` now.

Execute the test command from your plan. Do NOT use `npx` — it is not available.

Write results to `test-results.md` with:
- Whether tests passed or failed
- Number of tests and test files
- Any relevant output
