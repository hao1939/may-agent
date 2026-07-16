BEFORE fixing any test failure, classify each one:
- Run the tests and note all failures
- For EACH failure: read the source code, manually compute the expected value, compare to the test assertion
- Classify each failure as CODE BUG or TEST BUG
- Only then fix: CODE BUGs → fix source, TEST BUGs → fix test assertion

# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Run the test suite:

```
node test/invoice-tests.js
```

Fix all the failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.
