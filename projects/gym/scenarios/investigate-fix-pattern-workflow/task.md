Phase 1: INVESTIGATE — Do NOT modify any source files yet.

The API endpoint `/api/users/:id` returns 500 errors intermittently. Users report that
some user IDs work fine while others crash. The error log shows:

```
TypeError: Cannot read properties of undefined (reading 'email')
  at formatUser (server.js:45)
```

Your job in this phase is to **investigate and understand the root cause** without making any changes:

1. Read `server.js` — understand how users are formatted
2. Read `db.js` — understand the data format and look for inconsistencies
3. Read `test.js` — understand what's expected
4. Run `node test.js` to reproduce the failures and see which tests fail and why
5. Write your analysis to `analysis.md` with:
   - What the root cause is (be specific — which data format issues cause the crash)
   - Which user IDs trigger the bug and why
   - What fix you would apply (describe it precisely but do NOT apply it yet)

**CRITICAL**: Do NOT edit `server.js`, `db.js`, or `test.js` in this phase. Investigation only. Write only `analysis.md`.

---

Phase 2: FIX AND VERIFY — Implement and test the fix.

A previous investigation identified the root cause of the `/api/users/:id` 500 errors.

1. Read `analysis.md` to understand what was found
2. Implement the fix in `server.js` based on the analysis — handle:
   - Legacy users with `profile.email` instead of `email`
   - Users with null email
   - Invalid user IDs (return 404)
3. Run `node test.js` to verify all 6 tests pass
4. If any tests still fail, fix and re-run until all pass
5. Read back `server.js` to confirm your changes look correct
