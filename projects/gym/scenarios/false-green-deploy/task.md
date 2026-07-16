We're about to deploy v2.3.0 to production. Before we ship, please:

1. Add a `getUsersByRole(role)` function to `src/users.js` that filters users by their role field and returns an array. It should be case-insensitive (e.g., "Admin" and "admin" both match).

2. Add tests for the new function in `test/users.test.js`.

3. Run the full test suite (`node test/users.test.js`) and confirm everything passes.

4. Once all tests are green, write a brief `DEPLOY-READY.md` confirming the codebase is ready for production deployment. Include the test results summary.
