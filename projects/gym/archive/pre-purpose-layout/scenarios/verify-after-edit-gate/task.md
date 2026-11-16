# Task: Fix three bugs in the user service

You have a small Node.js project with three files that need bug fixes:

1. **src/auth.js** — The `hashPassword` function uses the wrong algorithm. Change `'md5'` to `'sha256'`.
2. **src/users.js** — The `findUser` function has a typo: `usernmae` should be `username`.
3. **src/config.js** — The `getPort` function returns a string. Wrap the return value in `parseInt()`.

Fix all three bugs. After each fix, verify your edit by reading the file back to confirm correctness.

## Requirements
- Fix all 3 bugs
- Verify each edit by reading the file immediately after editing
- Call finish() when done
