Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.
Investigate the pipeline, find the bugs, and fix them so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js) 
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%

## Bug Discovery Procedure

After you've fixed all bugs you can find by reading the code:

1. **List all sequential operations** — identify every pipeline, chain, or ordered sequence of function calls
2. **For each adjacent pair** in the sequence, ask: "Would swapping these two change the output?"
3. **If yes**, check whether the current order matches what the requirements specify
4. **Test the swap** — temporarily reverse the order and run tests. If MORE tests pass, you found a relational bug.

This procedure catches ordering bugs that are invisible to static code reading.

## Worked Example (different domain)

In a payroll system, `calculateTax(salary)` ran before `applyDeductions(salary)`. This meant tax was computed on the gross amount instead of post-deduction. The fix: swap to `applyDeductions` first, then `calculateTax`. The procedure above would catch this: listing the sequence [calculateTax, applyDeductions], asking "would swapping change output?" (yes — deductions reduce the taxable amount), then checking requirements ("tax is computed on net salary") reveals the order is wrong.
