# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Your job is to fix all failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

A colleague has already investigated the test failures and documented their findings in `DIAGNOSIS.md` in the project root.

**Read DIAGNOSIS.md first**, then fix all issues based on the diagnosis. For each failure:
- If the diagnosis says **CODE BUG**: fix the code so it produces the mathematically correct result
- If the diagnosis says **TEST BUG**: fix the test assertion to expect the correct value

After fixing, run the test suite to verify all tests pass:
```
node test/invoice-tests.js
```
