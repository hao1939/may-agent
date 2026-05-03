The auth service tests are failing because the token format changed from JWT v1 to v2. Fix the auth module so all tests pass.

Run `node test/auth.test.js` to see the failures, then fix the code.
