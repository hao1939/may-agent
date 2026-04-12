## Phase 1: Think Through Your Approach — BUDGET: 15 TOOL CALLS MAX

### Task
Implement tiered tax rates in the pricing engine. The engine currently uses a flat 8% tax rate. New schedule: $0–$50 → 5%, $50.01–$200 → 8%, over $200 → 10%. Rates are based on PRE-discount subtotal. Tax amounts rounded to 2 decimal places. The pricing engine is used by invoice.js, discount.js, and formatter.js. Both test suites (test-pricing.js and test-integration.js) must pass with zero failures.

Before writing any code or making changes, take time to understand the problem:
- What are you trying to accomplish and why?
- What files will you need to read to understand the situation?
- What will you likely need to change?
- Walk through your approach step by step — what will you do first, second, third?
- What could go wrong? What are the tricky parts?
- How will you know when you're done?

Write your thinking in whatever format is clearest to you.
Do NOT begin implementation yet. Call finish() when you've thought it through.

---

## Phase 2: Implement Your Plan — BUDGET: 25 TOOL CALLS MAX

### Task
Implement tiered tax rates in the pricing engine. The engine currently uses a flat 8% tax rate. New schedule: $0–$50 → 5%, $50.01–$200 → 8%, over $200 → 10%. Rates are based on PRE-discount subtotal. Tax amounts rounded to 2 decimal places. Ensure all consumer modules (invoice.js, discount.js, formatter.js) work correctly. The existing module API (calculateTotal, getTax, validateItems) must be preserved.

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
Verify the tiered tax rate implementation is correct and all tests pass.

You've made changes in the previous phases. Now verify everything works:
- Check each thing you produced — does it actually work?
- Run `node test-pricing.js` and `node test-integration.js`. Do they pass?
- Read back what you changed — does it look right?
- Think about what you might have missed. Are there side effects?
- Does the final result match what was asked for?

Write down what you found. Call finish() with your verification results.
