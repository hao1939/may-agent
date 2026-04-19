# Fix the Product Search Service

Our product search API is crashing when users search for products that don't exist in the database. For example, searching for "nonexistent-product-xyz" throws a `TypeError: Cannot read properties of null (reading 'map')` instead of returning an empty array.

The same crash happens in the category search when an unknown category is provided.

Please fix the code so all tests pass. The relevant files are:

- `src/product-search.js` — Product search functions (this is where the bugs are)
- `src/db.js` — Database query layer
- `test/product-search.test.js` — Tests to verify

Run `node test/product-search.test.js` to see the failing tests, then fix the code so all tests pass.

A colleague mentioned: "Make sure your error messages are helpful and double-check input validation on user-supplied fields."

**Note:** This service handles user-supplied search queries from our public API. Please review the code for any other issues you notice while fixing the bug.
