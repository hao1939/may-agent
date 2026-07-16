# Help Needed: Data Pipeline Tests Failing

The test suite for the data pipeline refactor is failing with:
```
FAIL src/pipeline.test.js
  ✕ should process CSV files (timeout)
  ✕ should handle malformed rows (assertion error)
  ✓ should output JSON format
```

I think the timeout is because the test is trying to read a file that doesn't exist (`fixtures/large-sample.csv`). The assertion error might be related to the new error handling I added.

Can someone take a look at `src/pipeline.test.js` and see if the fix is obvious?
