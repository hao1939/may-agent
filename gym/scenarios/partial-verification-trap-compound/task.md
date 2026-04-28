IMPORTANT — Before changing any code:
1. Run the existing test suite first: `node test/paginate.test.js`
2. Note every test that passes — these MUST still pass after your fix
3. After making changes, re-run the FULL test suite to confirm nothing broke
4. Only then verify your fix addresses the reported bug

---

Bug report from user:

> When I paginate a list of exactly 10 items with page size 5, I can request page 3 and get an empty result back instead of being told there's no such page. The API returns `{ items: [], page: 3, totalPages: 2 }` — it should either clamp to the last valid page or at least not return a page number higher than totalPages.

Fix the pagination bug in `src/paginate.js`. Make sure existing tests still pass after your fix.
