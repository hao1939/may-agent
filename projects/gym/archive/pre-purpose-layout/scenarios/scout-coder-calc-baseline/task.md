Fix the failing tests in this invoice processing pipeline.

The pipeline loads orders, applies volume discounts, computes tax, calculates shipping, and generates invoice summaries.

Some tests are failing — the computed values don't match expected values. Investigate the pipeline, find the bugs, and fix them so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/orders.json)
- Do NOT modify the discount logic (src/discount.js)
