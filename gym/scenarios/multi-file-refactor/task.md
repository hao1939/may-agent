# Task: Add tiered shipping cost to pricing

The pricing module needs to calculate shipping based on the order subtotal:
- Orders under $25: $5.99 flat shipping
- Orders $25-$74.99: $3.99 shipping  
- Orders $75+: free shipping

## What to do

1. In `src/pricing.js`: Add a `calculateShipping(subtotal)` function that returns the shipping cost based on the tiers above. Export it. Also modify `calculateTotal` to include a `shipping` field in the returned object (call `calculateShipping` internally).

2. In `src/cart.js`: Update `getCartSummary` to include the shipping cost in the formatted output. The `formatted` field should show the total INCLUDING shipping: `$${(result.total + result.shipping).toFixed(2)}`

3. In `src/checkout.js`: Update `processCheckout` to apply the discount BEFORE calculating shipping (shipping is based on discounted subtotal, not original). Include `shipping` in the returned object.

4. In `src/pricing.test.js`: Add at least 3 new test cases covering each shipping tier. Verify the integration (total includes shipping).

## Success criteria
- `calculateShipping` exists and handles all 3 tiers correctly
- `calculateTotal` returns a `shipping` field
- `cart.js` formatted price includes shipping
- `checkout.js` calculates shipping on post-discount amount
- Tests cover all 3 shipping tiers and pass
