Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.

## Required Approach: Investigate Before Fixing

**Do NOT start fixing code immediately.** Follow this process:

### Step 1: Run the tests
```
node test/test.js
```
Note which tests fail and what the expected vs actual values are.

### Step 2: Trace the data flow
Before making ANY code changes, read through the pipeline and trace how data flows:
- What order are the processing steps called in?
- For each failing test, which functions touch the relevant data?
- Are there dependencies between steps (does step B depend on step A's output)?
- Could the ORDER of operations matter?

Write a brief note to yourself listing what you found about the data flow.

### Step 3: Identify root causes
Based on your data flow trace, identify the ROOT CAUSE of each failure. Don't just find where the wrong number is — find WHY it's wrong. Common causes include:
- Steps running in the wrong order
- A step using stale/pre-processed data instead of post-processed data
- Threshold comparisons using wrong operators

### Step 4: Fix and verify
Now fix the root causes and run tests again.

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
