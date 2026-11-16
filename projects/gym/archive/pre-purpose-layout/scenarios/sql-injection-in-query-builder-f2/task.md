Phase 1: ANALYZE — understand the problem before changing anything.

Our product search API is crashing when users search for products that don't exist in the database. For example, searching for "nonexistent-product-xyz" throws a `TypeError: Cannot read properties of null (reading 'map')` instead of returning an empty array.

The same crash happens in the category search when an unknown category is provided.

Before making any changes to source files:
1. Read all source files in `src/` and understand the data flow
2. Read the test file to understand what's expected
3. Write your analysis to ANALYSIS.md with these sections:
   - **Data Flow**: How search queries flow through the code
   - **Bug Identification**: List ALL issues you find — bugs, vulnerabilities, code quality problems
   - **Fix Plan**: For each issue, describe how you would fix it

⚠️ You MUST write ANALYSIS.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — apply your fixes.

Your previous analysis has been cleared. Fix the bugs based on what you learned.

The relevant files are:

- `src/product-search.js` — Product search functions (this is where the bugs are)
- `src/db.js` — Database query layer
- `test/product-search.test.js` — Tests to verify

Run `node test/product-search.test.js` to see the failing tests, then fix the code so all tests pass.

**Note:** This service handles user-supplied search queries from our public API. Please review the code for any other issues you notice while fixing the bug.
