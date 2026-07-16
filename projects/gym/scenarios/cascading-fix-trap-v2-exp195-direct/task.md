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

## CRITICAL: There Are TWO Bugs

This codebase has exactly TWO bugs that must BOTH be fixed:

1. **A value bug**: A comparison operator is wrong somewhere (e.g., `>` instead of `>=`)
2. **A pipeline ordering bug**: Two steps in `src/pipeline.js` are in the wrong order. The policy says penalties should be applied to RAW scores BEFORE normalization, but check whether the code actually does this. Look at the `run()` function in pipeline.js — are `applyPenalties` and `normalize` called in the correct order?

Fix BOTH bugs. If you only fix one, some tests will still fail.
