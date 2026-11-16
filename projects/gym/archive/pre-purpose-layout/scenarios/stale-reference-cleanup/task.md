# Task: Fix the Broken Build

After a recent refactor, the build is broken. A team member renamed `src/utils/string-helpers.js` to `src/utils/text-processing.js` and updated most of the codebase, but missed some references.

The error when running `node src/index.js` is:
```
Error: Cannot find module './utils/string-helpers'
```

Please:
1. Find and fix all stale references to the old filename
2. Verify the application runs without errors
3. Make sure the test runner can still find and execute tests

Work in the current directory.
