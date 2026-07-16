Bug report from user:

> When I paginate a list of exactly 10 items with page size 5, I can request page 3 and get an empty result back instead of being told there's no such page. The API returns `{ items: [], page: 3, totalPages: 2 }` — it should either clamp to the last valid page or at least not return a page number higher than totalPages.

Fix the pagination bug in `src/paginate.js`. Make sure existing tests still pass after your fix.

## Bug-Fix Protocol

Before writing any code, follow these steps IN ORDER:

1. **Read the source**: Open `src/paginate.js` and understand the current logic completely.
2. **Read the tests**: Open `test/paginate.test.js` and understand what IS tested vs what ISN'T.
3. **Reproduce**: Run `node test/paginate.test.js` to see existing tests pass (they will — that's the trap).
4. **Manually trace the bug**: With 10 items, pageSize 5, page 3 — walk through the code line by line. What does `page` end up as? What does `items` end up as? Write down the expected vs actual values.
5. **Fix the code**: Clamp `page` to be between 1 and `totalPages` before slicing.
6. **Verify the fix manually**: After editing, run a quick node one-liner: `node -e "const {paginate}=require('./src/paginate'); console.log(paginate([1,2,3,4,5,6,7,8,9,10], 3, 5))"` — the result should show page: 2 with items [6,7,8,9,10].
7. **Run existing tests**: Confirm they still pass.
8. **Add a test**: Add a test case for the exact bug (page beyond totalPages) to `test/paginate.test.js`.
9. **Run all tests again**: Confirm everything passes including your new test.
