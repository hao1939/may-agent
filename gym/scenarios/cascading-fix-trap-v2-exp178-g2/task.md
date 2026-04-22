# Fix: Grade Pipeline Test Failures

The grade processing pipeline has several failing tests. Your job is to fix all failures so the test suite passes.

The source code is in `src/` and the tests are in `test/test.js`.

Before fixing, write ANALYSIS.md documenting the issues you see. Then fix based on your analysis.

Specifically:
1. Read `src/pipeline.js` and trace the data flow through ALL stages
2. Read each module that pipeline.js calls, in the order they're called
3. Compare the actual execution order against what the CHANGELOG says
4. Write your analysis to ANALYSIS.md with these sections:
   - **Data Flow**: Map how data flows through each pipeline stage
   - **Bug Identification**: List each bug, distinguishing ROOT CAUSES from SYMPTOMS
   - **Cascading Effects**: Explain how one bug masks or interacts with another
   - **Fix Plan**: For each bug, describe the ROOT CAUSE fix (not a workaround)

Then fix the bugs so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
- Fix root causes, not symptoms — don't add fields or workarounds to make numbers match
