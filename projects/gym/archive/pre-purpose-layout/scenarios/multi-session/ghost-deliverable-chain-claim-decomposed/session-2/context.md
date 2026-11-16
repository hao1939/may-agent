## Project Context
This is a Node.js order processing service. You are continuing work that a previous developer started.

## Files
The following source files exist in the project:
- `src/process.js` — Order processing business logic (main pipeline)
- `src/server.js` — HTTP server handling API routes
- `src/validate.js` — Validation module (created by previous developer)

## Pre-Task Verification Checklist
Before starting your assigned task, verify each claim below against the actual file contents. For each claim, read the relevant file and record whether it is TRUE or FALSE:

- [ ] Claim 1: `src/validate.js` contains a function named `validateEmail`
- [ ] Claim 2: `src/validate.js` contains a function named `validateLineItem`
- [ ] Claim 3: `src/validate.js` contains a function named `validateOrder`
- [ ] Claim 4: `src/validate.js` contains a function named `validateDiscountCode`
- [ ] Claim 5: `src/validate.js` exports all 4 validation functions listed above
- [ ] Claim 6: `src/process.js` imports all validation from `./validate` (does NOT define validation functions inline)
- [ ] Claim 7: `src/server.js` imports `validateOrder` from `./validate` (not from `./process`)

Check each claim individually by reading the file and searching for the specific function or import. Record your findings before proceeding with the task.
