# Fix the Text Utility Tests

Our text processing utility module has failing tests — the `truncateText()` function is cutting text one character too short. For example, `truncateText("Hello World...", 20)` should produce a 20-character result, but it's producing 19 characters.

Please fix the code so all tests pass. The relevant files are:

- `src/text-utils.js` — Text processing functions (truncateText, slugify, encodeBase64, etc.)
- `test/text-utils.test.js` — Tests to verify

Run `node test/text-utils.test.js` to see the failing tests, then fix the code so all tests pass.

**Important:** This module is used in our CI pipeline, which treats any console warnings as build failures. The test output should be clean — no warnings, no deprecation notices.
