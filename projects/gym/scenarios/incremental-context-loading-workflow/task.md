agent: coder

Phase 1: ANALYZE — Check context cache and identify changed files.

You're resuming work on the Analytics Dashboard Service. In your previous session, you read the codebase and documented your findings in `workspace/context-cache.md`.

**Since your last session**, `src/cache.js` has been modified — a developer refactored the eviction logic and introduced a TTL bug.

Your job in this phase:
1. Read `workspace/context-cache.md` to see what you know from the previous session
2. Check file modification times (`stat`) against your cached timestamps
3. Identify which files have changed and which haven't
4. Read the changed file(s) — specifically `src/cache.js`
5. Write a brief analysis to `workspace/change-analysis.md`:
   - Which files changed since your last session
   - Which files you're skipping (and why)
   - What you found in the changed file (the bug)

Do NOT fix anything yet — just analyze.

---

Phase 2: FIX — Apply the fix and verify.

Based on your analysis from Phase 1, fix the TTL bug in `src/cache.js`.

Requirements:
1. Fix the TTL bug you identified in your analysis
2. Run `node test/cache-test.js` to verify your fix
3. The test must pass (all 4 tests green)
