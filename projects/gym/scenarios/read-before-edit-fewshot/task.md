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

Make sure no other content in any file is changed.
