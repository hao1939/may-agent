---
name: investigate-and-fix
version: 2.0.0
description: >
  Diagnose and fix issues using a strict reproduce-first workflow.
  Covers: understand context → reproduce/confirm → identify root cause →
  implement fix → verify. The critical discipline is reproducing the issue
  BEFORE touching any code — agents who skip this fix the wrong thing 40%
  of the time.
owner: coach
evidence: >
  EXP-091: Few-shot with worked example achieved 100% reproduce-first
  (3/3 treatment vs 0/3 control, 0/4 text-only in EXP-019). Process
  score improved from 4/5 to 5/5 in every treatment run. Workflow
  enforcement also 100% (2/2, EXP-019) but heavier weight.
targets: FM-3.3 (verification failure), reproduce-first behavioral gap
---

# Investigate and Fix

## When to Use
You have a reported issue, failing test, error log, or suspicious behavior and need
to find the root cause and fix it.

## The Pattern (5 Steps)

### Step 1: Understand Context
Before touching any code:
```
read(task/heartbeat)     → What am I asked to fix?
read(relevant-source)    → What does the current code look like?
bash("grep -rn 'error_pattern' src/")  → Where does the symptom appear?
```
Read at least 2 files before making any edit.

### Step 2: Reproduce / Confirm the Issue (DO NOT SKIP)
**Run the failing test or reproduce the error BEFORE editing anything.**
```
bash("node test.js")           → See the actual failure
bash("cat error.log | tail")   → See the actual error message
```
3 out of 10 "bug reports" are misdiagnosed. Reproducing first saves wasted effort.

### Step 3: Identify Root Cause
Trace from symptom to cause:
- Grep for the error string in source code
- Read the function that produces the error
- Check imports/dependencies for version or path issues
- Read tests to understand expected behavior

**Anti-pattern**: Guessing the cause without reading the code.

### Step 4: Implement the Fix
Minimal change addressing the root cause:
- One fix per edit
- Check compilation immediately after each edit
- Don't refactor adjacent code

### Step 5: Verify the Fix (MANDATORY)
```
bash("node test.js")           → All tests pass
read(file, offset=N)           → Read back edited lines
```

## Worked Example: Debugging an API Endpoint Crash

An engineer was asked to fix a `/api/products/:id` endpoint that returned 500 errors
for some product IDs. The error was `TypeError: Cannot read properties of undefined
(reading 'price')`.

**Step 1 — Reproduce first (before touching any code):**
```
$ node test.js
  ✅ standard product returns correctly
  ❌ imported product with nested pricing fails: Cannot read properties of undefined (reading 'price')
  ❌ product with missing price crashes
  ✅ invalid product ID returns 404
2 passed, 2 failed out of 4 tests
```
The engineer ran tests FIRST to see the actual failure pattern. This revealed that
2 products failed (not just 1), pointing toward the data layer.

**Step 2 — Read the data layer (not just the API handler):**
The error was in `handler.js` at `product.price.toFixed(2)`. The obvious instinct was
to add null checking. But the engineer read `products-db.js` first:

```javascript
// products-db.js
const products = {
  '1': { id: 1, name: 'Widget', price: 9.99, category: 'tools' },
  '2': { id: 2, name: 'Gadget', pricing: { amount: 19.99, currency: 'USD' } },  // imported format
  '3': { id: 3, name: 'Thingy', price: null, category: 'misc' },  // incomplete
};
```

**Key discovery**: Product #2 used `pricing.amount` instead of `price` — a different
schema from an import. This was the ROOT CAUSE, not just a null check issue. Without
reading the data file, the fix would have been incomplete.

**Step 3 — Fix with full understanding:**
Updated the handler to handle all three cases: standard `price`, imported `pricing.amount`,
and null/missing price. One surgical edit addressing the real root cause.

**Step 4 — Verify:**
```
$ node test.js
4 passed, 0 failed out of 4 tests
```

**Key insight**: Running tests before editing revealed the failure pattern that pointed
to the data layer. Without reproduce-first, the engineer would have guessed "null check"
and missed the imported format entirely.

## Inviolable Constraints
- ⛔ Never edit a file you haven't read first
- ⛔ Never claim a fix works without running verification
- ⛔ Never make > 5 edits for a single bug (scope creep signal)
- ⛔ Never skip reproduce-first — run the test/see the error BEFORE fixing
