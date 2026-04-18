# Engineering Brief: P53 Security Hardening (Quote Splitting)

## Context
The P53 security layer correctly blocks commands containing `SOUL.md`. However, bash processes quotes before execution, allowing a user to bypass the regex check by splitting the string (e.g., `S""OUL.md` becomes `SOUL.md` at runtime).

## Objective
Update `src/lib/tools/security.ts` to prevent this bypass.

## Requirements
1. **Robust Regex**: The denial regex must account for optional quotes between characters in sensitive filenames.
   - Target: `SOUL.md`, `philosophy.md`, `agent.json`.
   - Pattern to block: `S` followed by any number of quotes, `O` followed by quotes... etc.
2. **Test Coverage**: Add a test case in `src/lib/tools/security.test.ts` that attempts to write to a protected file using interleaved quotes.
   - **Important**: Do not use `bash` in the test if it triggers safety filters. Use the `checkSecurity` function directly to verify it returns `false` (Blocked) for the input string.

## Implementation Details
The current check is likely `command.includes(...)`.
Change to a regex that matches the sequence of characters with optional noise (quotes) in between.

Example Regex Logic (Pseudocode):
```javascript
const sensitiveFiles = ["SOUL.md", "philosophy.md", "agent.json"];
const quotePattern = /['"]*/g;
// Create a regex that allows quotes between every char
// "SOUL" -> /S['"]*O['"]*U['"]*L/i
```

## Task
1. Implement the hardened check in `src/lib/tools/security.ts`.
2. Verify with unit tests.
3. Run `npm run build` to apply changes.
