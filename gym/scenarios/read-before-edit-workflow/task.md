agent: coder

Phase 1: EDIT — Fix the three bugs listed below.

Fix these three bugs in the source files:

1. **`src/validator.js`** — Line ~8: The comparison uses `=` (assignment) instead of `===` (strict equality).
   The line currently looks like: `if (value = expected) {`
   Change it to: `if (value === expected) {`

2. **`src/formatter.js`** — Line ~12: The `padStart` call uses the wrong pad character.
   The line currently looks like: `return str.padStart(width, '0');`
   Change it to: `return str.padStart(width, ' ');`

3. **`src/parser.js`** — Line ~15: The regex is missing the global flag.
   The line currently looks like: `const pattern = /\d+/;`
   Change it to: `const pattern = /\d+/g;`

Make sure no other content in any file is changed. Do NOT verify the edits — just make them and stop.

---

Phase 2: VERIFY — Read back all edited files and confirm the fixes are correct.

A previous session edited three source files. Read each one back from disk and verify the fixes landed correctly:

1. Read `src/validator.js` — confirm line ~8 uses `===` (strict equality), not `=` (assignment)
2. Read `src/formatter.js` — confirm the `padStart` call uses `' '` (space), not `'0'` (zero)
3. Read `src/parser.js` — confirm the regex is `/\d+/g` (with global flag), not `/\d+/` (without)

For each file, also verify that no other content was accidentally changed. If any edit is wrong or missing, fix it now.
