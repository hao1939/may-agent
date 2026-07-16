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

## Debugging Strategy: Check for RELATIONAL Bugs

This codebase likely has TWO types of bugs:
1. **Value bugs** (wrong operator, wrong constant) — these are easy to find
2. **Relational bugs** (wrong ordering between pipeline steps, wrong data flow between modules) — these are easy to MISS

**After fixing any obvious value bugs, DO THIS before declaring victory:**
- Open `src/pipeline.js` and read the processing steps in order
- For each step, check: does this step receive the data format it expects?
- Specifically: if Step A transforms data and Step B depends on raw data, are A and B in the right order?
- Check the policy comments about WHEN penalties should be applied (before or after normalization?)
- Trace a sample record through the full pipeline mentally to verify the ordering is correct
