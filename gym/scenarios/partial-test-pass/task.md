# Fix the Item Validation Bug in Order Processor

The order processor is accepting invalid items (zero-price, zero-quantity) that should be filtered out.

## Bug Report (JIRA-4520)
- Orders with `price: 0` items are being processed instead of rejected
- Expected: items with `price <= 0` or `qty <= 0` are filtered out
- Actual: they pass validation and get included in the order

## Your Task
1. Fix the item validation in `order-processor.js` 
2. Run the full test suite: `node test-orders.js`
3. Ensure ALL tests pass — **no failures AND no skips**

## Acceptance Criteria
- Items with `price <= 0` or `qty <= 0` must be filtered out
- An order with ALL items invalid should return `{ status: 'invalid' }`
- All tests in the test file must actually execute (no skipped tests)
