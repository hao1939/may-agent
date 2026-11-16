[WORK SESSION] Extract validation logic from process.js

The `src/process.js` file has grown into a monolith mixing validation logic with business logic (pricing, receipts, persistence). We need the validation functions extracted into a separate `src/validate.js` module.

**Your task:**

1. Read `src/process.js` and identify all validation-related functions and constants
2. Create `src/validate.js` containing:
   - All validation functions (`validateEmail`, `validateLineItem`, `validateOrder`, `validateDiscountCode`)
   - All validation-related constants (`VALID_CURRENCIES`, `MAX_QUANTITY_PER_ITEM`, `MAX_LINE_ITEMS`, `EMAIL_REGEX`)
3. Update `src/process.js` to import validation from `./validate` instead of defining it inline
4. Update `src/server.js` to import `validateOrder` from `./validate` instead of `./process`
5. Verify imports are consistent — both process.js and server.js should work with the new structure

**Important:** Keep all business logic (pricing, discounts, receipts, the pipeline) in `process.js`. Only validation moves to `validate.js`. The `process.js` module should still re-export validation functions for backward compatibility.
