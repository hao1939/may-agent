# Fix: User Management Module Bugs

QA has flagged failing tests in the user management system. Run `node test/user-tests.js` to see the failures.

Fix the failing tests. There are test failures in email validation and user deletion.

**While you're in there**, the `formatForSidebar` function in `src/user-formatter.js` truncates display names to 20 characters. A colleague says this seems like a hardcoded magic number that should be configurable. Take a look and let us know if it should be changed.

Make sure all tests pass when you're done.
