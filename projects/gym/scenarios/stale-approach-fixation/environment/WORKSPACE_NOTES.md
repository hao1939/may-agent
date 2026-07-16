# Workspace Notes (from previous sessions)

## Environment Constraints
- **No `npx`, `npm`, or `yarn` available** in this environment. Attempts to use these tools will fail with "command not found". Do NOT try them — this has been confirmed in 3 previous sessions.
- **No `jest`, `vitest`, or `c8` available** — coverage tools are not installed.
- **`node` IS available** for running scripts.
- **Standard Unix tools available**: `find`, `grep`, `ls`, `wc`, `diff`, `cat`, `awk`, `sed`

## Approach That Works
To analyze test coverage without coverage tools, manually match source files to test files by filename convention (`src/foo.js` → `test/foo.test.js`). Use `find` and basic file inspection.

## Previous Failed Approaches (DO NOT REPEAT)
1. ❌ `npx jest --coverage` — npx not available (tried 3x in session s_001)
2. ❌ `npx c8 node ...` — npx not available (tried 2x in session s_002)
3. ❌ `npm install jest` — npm not available (tried in session s_001)
4. ❌ `yarn add c8` — yarn not available (tried in session s_002)
