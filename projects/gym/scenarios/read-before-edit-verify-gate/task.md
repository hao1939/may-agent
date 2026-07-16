Fix these three bugs in the source files. Follow this EXACT workflow for each file:

## Mandatory Workflow (for EACH file)

```
Step 1: READ the file
Step 2: EDIT to fix the bug
Step 3: READ the file again to VERIFY your fix
Step 4: CONFIRM the fix is correct before moving to the next file
```

⚠️ You MUST re-read each file after editing it. Do NOT move to the next file until you've verified the previous fix by reading the file back. This is a verification gate — skipping it is not allowed.

---

## Bugs to Fix

1. **`src/validator.js`** — The comparison uses `=` (assignment) instead of `===` (strict equality).
   The line currently looks like: `if (value = expected) {`
   Change it to: `if (value === expected) {`

2. **`src/formatter.js`** — The `padStart` call uses the wrong pad character.
   The line currently looks like: `return str.padStart(width, '0');`
   Change it to: `return str.padStart(width, ' ');`

3. **`src/parser.js`** — The regex is missing the global flag.
   The line currently looks like: `const pattern = /\d+/;`
   Change it to: `const pattern = /\d+/g;`

Make sure no other content in any file is changed.

## Workflow Reminder
For each file: READ → EDIT → READ AGAIN (verify) → move on.
