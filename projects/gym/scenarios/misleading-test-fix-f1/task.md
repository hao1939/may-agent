# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Run the test suite:

```
node test/invoice-tests.js
```

Fix all the failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

A senior developer has already analyzed the test failures and documented their findings in `ANALYSIS.md` in the project root. **Read ANALYSIS.md first**, then fix based on the analysis. For each failure:
- If the analysis identifies a CODE BUG: fix the code
- If the analysis identifies a TEST BUG: fix the test assertion
- Do NOT modify working code to satisfy a wrong test
