# Pre-Finish Reconciliation

Before calling finish(), always do a quick self-check:

## Pattern
1. List any issues you found during this session (missing files, errors, failed tests, unresolved problems)
2. If you found issues that you did NOT fix → use `finish(status: "blocked")` or `finish(status: "partial")`
3. Only use `finish(status: "success")` if ALL issues were resolved

## Examples

### Missing prerequisite found
During session: "The file config.json does not exist. This is a prerequisite for the build."
Self-check: Found issue: config.json missing. Did I fix it? No.
→ `finish(status: "blocked", blockers: [{reason: "config.json does not exist — prerequisite for build"}])`

### Found and fixed an issue
During session: "The test was failing because of a typo in line 42. Fixed the typo. All tests pass now."
Self-check: Found issue: test failure from typo. Did I fix it? Yes — typo fixed, tests pass.
→ `finish(status: "success", summary: "Fixed typo on line 42, all tests pass")`

### Investigation revealing problems
During session: "Analyzed the codebase. Found 3 issues: missing error handling in api.ts, unused imports in utils.ts, no test coverage for auth module."
Self-check: Found issues: 3 code problems. Did I fix them? No — I only investigated.
→ `finish(status: "partial", summary: "Identified 3 issues in codebase", next_steps: "Fix error handling, clean imports, add auth tests")`

### Missing dependency
During session: "Tried to run the build but got 'module not found: express'. The package.json doesn't include express as a dependency."
Self-check: Found issue: express dependency missing. Did I fix it? No.
→ `finish(status: "blocked", blockers: [{reason: "express not in package.json — required dependency missing"}])`
