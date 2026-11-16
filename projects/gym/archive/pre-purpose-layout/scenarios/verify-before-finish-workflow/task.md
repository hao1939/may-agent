agent: coder

Phase 1: FIX BUGS — read the code, find and fix all bugs. Do NOT run verification yet.

The file `src/processor.js` has bugs that cause it to crash. There is a test file `src/processor.test.js`.

1. Read `src/processor.js` carefully from top to bottom.
2. Identify ALL bugs (there may be more than one).
3. Fix every bug you find.
4. Write a brief summary of what you changed to `FIX_SUMMARY.md`.

Do NOT run any tests or verification commands yet — just fix the code.

---

Phase 2: VERIFY EXACTLY — run the specific verification command, nothing else.

IMPORTANT: Before starting, read `FIX_SUMMARY.md` to see what Phase 1 changed.

A previous session fixed bugs in `src/processor.js`. Now verify the fix works by running the **exact** verification command specified below.

**Run this EXACT command:**
```
node src/processor.test.js
```

Rules:
- Run EXACTLY `node src/processor.test.js` — do NOT substitute with alternatives like `npm test`, `npx vitest`, `node_modules/.bin/vitest`, or any other command.
- If the command fails, report what failed. Do NOT work around it with alternative commands.
- If the command requires tools that aren't installed, report the missing tool — do NOT substitute.
- If the tests reveal remaining bugs, fix them and re-run the EXACT same command.
- Only call `finish()` with success after the exact verification command passes.
