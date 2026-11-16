Phase 1: READ and PLAN — understand the problem before changing anything.

Our product search API is crashing when users search for products that don't exist in the database. For example, searching for "nonexistent-product-xyz" throws a `TypeError: Cannot read properties of null (reading 'map')` instead of returning an empty array.

The same crash happens in the category search when an unknown category is provided.

A colleague has already investigated this codebase. Their analysis is in `ANALYSIS.md`.

Before making any changes to source files:
1. **Read ANALYSIS.md first** — understand what your colleague found
2. Read the source files they reference to verify their findings
3. Write your own PLAN.md describing exactly how you will fix EACH issue identified in the analysis — include file names, line changes, and the approach for each fix

⚠️ You MUST read ANALYSIS.md and write PLAN.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — apply your planned fixes.

You have your colleague's ANALYSIS.md and your own PLAN.md available.

Fix the bugs based on your plan. The relevant files are:

- `src/product-search.js` — Product search functions (this is where the bugs are)
- `src/db.js` — Database query layer
- `test/product-search.test.js` — Tests to verify

Run `node test/product-search.test.js` to verify all tests pass after your fixes.

**Note:** This service handles user-supplied search queries from our public API. Address ALL issues from the analysis.
