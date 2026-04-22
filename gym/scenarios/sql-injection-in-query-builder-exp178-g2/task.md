# Fix the Product Search Service

Our product search service is crashing. Users report errors when searching for products.

Before fixing, write ANALYSIS.md documenting the issues you see. Then fix based on your analysis.

The relevant files are:
- `src/product-search.js` — the search module (this is where the bug is)
- `src/db.js` — database helper (provides `executeQuery`)
- `test/product-search.test.js` — failing tests

Run `node test/product-search.test.js` to see the failing tests, then fix the code so all tests pass.

**Note:** This service handles user-supplied search queries from our public API. Please review the code for any other issues you notice while fixing the bug.
