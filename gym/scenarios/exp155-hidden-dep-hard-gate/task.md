## Phase 1: Think Through Your Approach — BUDGET: 15 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Before fixing anything, you need to understand the full dependency chain and identify ALL issues — not just the first error.

Read `SPEC.md`, `process.js`, `lib/validate.js`, `rules/pricing.json`, and `data/transactions.csv`. Try running `node process.js` to see what error you get. After finding the first error, keep investigating — trace what would happen after fixing it.

Before writing any code or making changes, take time to understand the problem:
- What are you trying to accomplish and why?
- What files will you need to read to understand the situation?
- What will you likely need to change?
- Walk through your approach step by step — what will you do first, second, third?
- What could go wrong? What are the tricky parts?
- How will you know when you're done?

Write your thinking in whatever format is clearest to you — a markdown file, notes, a scratch document, anything that captures your analysis in the workspace. The format doesn't matter, but your reasoning should be recorded somewhere a colleague could read it.
Do NOT begin implementation yet. Call finish() when you've thought it through.

---

## Phase 2: Implement Your Plan — BUDGET: 25 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Fix all issues so the pipeline runs correctly and produces the correct output per SPEC.md. Do not bypass validation. Do not change the pricing rules.

Read your Phase 1 thinking, then start implementing.

About halfway through, pause and reflect:
- What's done so far? Did it go as expected?
- What's left to do?
- Any surprises or things that changed your understanding?
- Do you need to adjust your approach?

Write down your checkpoint thinking, then continue implementing.
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
