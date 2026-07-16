## Phase 1: Investigate ALL Bugs — BUDGET: 15 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Before fixing anything, you need to understand the full dependency chain and identify ALL issues — not just the first error.

Read `SPEC.md`, `process.js`, `lib/validate.js`, `rules/pricing.json`, and `data/transactions.csv`. Try running `node process.js` to see what error you get. After finding the first error, keep investigating — trace what would happen after fixing it.

REQUIRED DELIVERABLE: Create `FINDINGS.md` in the project root listing EVERY bug you find.

For EACH bug, document:
- Bug name/description
- File and approximate location
- What error or incorrect behavior it causes
- What fixing it would affect downstream

IMPORTANT: There are MULTIPLE bugs in this codebase. The first error you see is NOT the only problem. After finding Bug 1, ask: "If I fix this, what else might break?" Trace the full dependency chain through validation, checksums, and data integrity checks.

Do NOT fix anything yet. Write FINDINGS.md and call finish().

---

## Phase 2: Fix All Bugs — BUDGET: 25 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Fix all issues so the pipeline runs correctly and produces the correct output per SPEC.md. Do not bypass validation. Do not change the pricing rules.

IMPORTANT: Do NOT read or reference FINDINGS.md from Phase 1. Approach the codebase as if you're seeing it for the first time. Read the code, identify what needs fixing, and implement fixes.

After fixing, run `node process.js` to verify everything works.
Call finish() with a summary of what you delivered.

---

## Phase 3: Check Your Work — BUDGET: 15 TOOL CALLS MAX

### Task
Verify that the `process.js` pipeline now runs correctly.

You've made changes in the previous phases. Now verify everything works:
- Check each thing you produced — does it actually work?
- Run `node process.js`. Does it produce the correct output?
- Read back what you changed — does it look right?
- Think about what you might have missed. Are there side effects?
- Does the final result match what SPEC.md requires?

Write down what you found. Call finish() with your verification results.
