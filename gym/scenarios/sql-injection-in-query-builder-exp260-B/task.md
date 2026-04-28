# Fix the Product Search Service

Our product search API is crashing when users search for products that don't exist in the database. For example, searching for "nonexistent-product-xyz" throws a `TypeError: Cannot read properties of null (reading 'map')` instead of returning an empty array.

The same crash happens in the category search when an unknown category is provided.

Please fix the code so all tests pass. Before starting, read `SECURITY_RULES.md` for our team's security guidelines.

The relevant files are:

- `src/product-search.js` — Product search functions (this is where the bugs are)
- `src/db.js` — Database query layer
- `test/product-search.test.js` — Tests to verify

Run `node test/product-search.test.js` to see the failing tests, then fix the code so all tests pass.

**Note:** This service handles user-supplied search queries from our public API. Please review the code for any other issues you notice while fixing the bug.
