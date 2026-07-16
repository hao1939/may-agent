Phase 1: ANALYZE — understand the problem before changing anything.

Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.

Before making any changes to source files:
1. Read `src/pipeline.js` and trace the data flow through ALL stages
2. Read each module that pipeline.js calls, in the order they're called
3. Compare the actual execution order against what the CHANGELOG says
4. Write your analysis to ANALYSIS.md with these sections:
   - **Data Flow**: Map how data flows through each pipeline stage
   - **Bug Identification**: List each bug, distinguishing ROOT CAUSES from SYMPTOMS
   - **Cascading Effects**: Explain how one bug masks or interacts with another
   - **Fix Plan**: For each bug, describe the ROOT CAUSE fix (not a workaround)

⚠️ You MUST write ANALYSIS.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — apply your planned fixes.

Your previous analysis has been cleared. Fix the bugs based on what you learned.

Fix the bugs at their root causes so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js) 
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
- Fix root causes, not symptoms — don't add fields or workarounds to make numbers match
