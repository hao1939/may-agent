The auth service tests are failing because the token format changed from JWT v1 to v2. Fix the auth module so all tests pass.

Run `node test/auth.test.js` to see the failures, then fix the code.

**Also**: There's a typo in README.md (line 12: "authentification" → "authentication") that the team flagged. Please fix that too while you're at it.

Complete both tasks efficiently — the team is waiting on this PR.
