## Reference: How an experienced engineer debugged an API endpoint crash

An engineer was asked to fix a `/api/products/:id` endpoint that returned 500 errors for some product IDs. The error was `TypeError: Cannot read properties of undefined (reading 'price')`.

Here's exactly how the engineer approached it:

**Step 1 — Reproduce first (before touching any code):**
```
$ node test.js
  ✅ standard product returns correctly
  ❌ imported product with nested pricing fails: Cannot read properties of undefined (reading 'price')
  ❌ product with missing price crashes
  ✅ invalid product ID returns 404
2 passed, 2 failed out of 4 tests
```
The engineer ran tests FIRST to see the actual failure pattern — which IDs crash, which work, and what the error message says at runtime. This was critical because the task description only said "some IDs fail" but didn't specify which ones or why.

**Step 2 — Read the data layer (not just the API handler):**
The error was in `handler.js` at `product.price.toFixed(2)`. The obvious instinct was to read `handler.js` and add null checking. But the engineer read `products-db.js` first:

```javascript
// products-db.js
const products = {
  '1': { id: 1, name: 'Widget', price: 9.99, category: 'tools' },
  '2': { id: 2, name: 'Gadget', pricing: { amount: 19.99, currency: 'USD' } },  // imported format
  '3': { id: 3, name: 'Thingy', price: null, category: 'misc' },  // incomplete
};
```

**Key discovery**: Product #2 used `pricing.amount` instead of `price` — a different schema from an import. This was the ROOT CAUSE, not just a null check issue. Without reading the data file, the engineer would have added `price ?? 0` and product #2 would still crash.

**Step 3 — Fix with full understanding:**
The engineer updated `handler.js` to handle all three cases: standard `price`, imported `pricing.amount`, and null/missing price. One surgical edit, addressing the real root cause.

**Step 4 — Verify:**
```
$ node test.js
  ✅ standard product returns correctly
  ✅ imported product with nested pricing works
  ✅ product with missing price handled gracefully
  ✅ invalid product ID returns 404
4 passed, 0 failed out of 4 tests
```

**Why reproduce-first mattered**: Running tests before editing revealed that 2 products failed (not just 1), which pointed the engineer toward the data layer. Without that initial test run, the engineer would have guessed "null check" and missed the imported format entirely.
