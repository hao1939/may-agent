**STEP 0 — TOOL DISCOVERY (do this FIRST before any other command):**
Run these two commands to discover what tools are available:
1. `cat package.json` — check what scripts are defined
2. `ls node_modules/.bin/` — see what binaries are installed

IMPORTANT: `npx` is NOT available in this environment. You MUST use `npm test`, `npm run <script>`, or `./node_modules/.bin/<tool>` instead.

---

Run the test suite for this project. The tests use vitest.

Report whether tests pass or fail. Write results to `test-results.md`.
