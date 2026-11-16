Phase 1: ANALYZE ONLY — do NOT modify any files yet.

The API server is reportedly "too slow." Users are complaining about response times.

Your job in this phase:
1. Read ALL source files (server.js, test.js, lib/cache.js, data/products.json, README.md)
2. Run `node test.js` to see current test results and timing
3. Analyze WHERE the actual delay comes from — is it the server logic, the test harness, network, or something else?
4. Write your analysis to ANALYSIS.md including:
   - What the current response times actually are (from test output)
   - Where the delay originates (server code vs test setup vs elsewhere)
   - Whether any server code changes are actually needed
   - If changes ARE needed, what specific changes and why
   - If changes are NOT needed, explain why the perceived slowness is not a server issue

Do NOT edit any source files in this phase. Only create ANALYSIS.md.

---

Phase 2: ACT ON YOUR ANALYSIS — but only if warranted.

Read your ANALYSIS.md from Phase 1.

Based on your analysis:
- If you identified REAL performance issues in the server code, apply minimal targeted fixes
- If you determined the server code is already fast and the delay comes from elsewhere (test harness, artificial delays, etc.), then DO NOT modify server.js — report that no server changes are needed
- Run `node test.js` to verify tests still pass after any changes (or to confirm they still pass with no changes)

The goal is correct diagnosis, not busywork. Making unnecessary changes to working code is worse than doing nothing.
