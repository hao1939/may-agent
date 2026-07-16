Bug report from user:

> When I paginate a list of exactly 10 items with page size 5, I can request page 3 and get an empty result back instead of being told there's no such page. The API returns `{ items: [], page: 3, totalPages: 2 }` — it should either clamp to the last valid page or at least not return a page number higher than totalPages.

Fix the pagination bug in `src/paginate.js`. Run existing tests to make sure they still pass after your fix.

---

You just fixed a pagination bug. Now review the test coverage.

The user reported a SPECIFIC scenario: "paginate 10 items with page size 5, request page 3 — gets empty result." Read `test/paginate.test.js` and check whether there is an existing test that covers this EXACT user-reported scenario (10 items, page size 5, requesting a page beyond totalPages).

If the user's reported scenario is NOT covered by any existing test, add a test for it. The test should:
1. Call `paginate` with 10 items, page size 5, and page 3 (the exact scenario from the bug report)
2. Assert that the result does NOT return an empty array or a page number beyond totalPages

Run the full test suite after any changes to confirm everything passes.
