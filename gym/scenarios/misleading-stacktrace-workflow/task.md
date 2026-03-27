Phase 1: INVESTIGATE — Do NOT modify any source files yet.

Users report a 500 error when accessing their profile page. The error log shows:

```
TypeError: Cannot read properties of undefined (reading 'email')
    at UserService.getProfile (src/services/userService.js:18:32)
    at ProfileController.show (src/controllers/profileController.js:12:44)
    at Layer.handle (node_modules/express/lib/router/layer.js:95:5)
```

The bug was introduced in yesterday's deploy. The only changes were in the auth module.

Your job in this phase is to **investigate the full error path** without making any changes:

1. Read `src/services/userService.js` — the file from the stacktrace. Understand what it expects
2. Read `src/controllers/profileController.js` — how is the service called?
3. Read `src/middleware/auth.js` — the auth module that was changed yesterday. Trace
   what `req.user` is set to and what format downstream code expects
4. Read `src/data/users.js` — understand the data structure
5. Read `src/server.js` — understand the full request flow
6. Trace the data flow: What does auth middleware store in `req.user`? What does
   userService.getProfile expect from `req.user`? Where's the mismatch?

Write your complete analysis to `analysis.md` with:
- **Root cause**: Where the REAL bug is (not just where the error manifests)
- **Data flow**: How data flows from auth → controller → service, and where it breaks
- **Why the stacktrace is misleading**: The error appears in userService.js but the bug isn't there
- **Correct fix**: What to change and in which file (be specific)
- **What NOT to do**: Don't patch userService.js with defensive checks — that's treating the symptom

**CRITICAL**: Do NOT edit any source files in this phase. Investigation only. Write only `analysis.md`.

---

Phase 2: FIX AND VERIFY — Implement the fix based on your analysis.

A previous investigation traced a TypeError in the profile endpoint to its root cause.

1. Read `analysis.md` to understand what was found
2. Fix the root cause in the correct file (based on the analysis — this should be in `src/middleware/auth.js`,
   not in `src/services/userService.js`)
3. Verify the fix makes sense: the session should store an object with an `id` property,
   not a raw userId value
4. Read back the modified file to confirm your changes are correct
5. Do NOT add defensive patches to userService.js — the root cause fix should make
   userService work correctly without modifications
