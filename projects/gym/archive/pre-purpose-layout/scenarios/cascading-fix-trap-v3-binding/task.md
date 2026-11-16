Phase 1: ANALYZE — understand the problem before changing anything.

Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, marks late submission
penalties, normalizes scores to percentages (accounting for penalties),
computes homework averages (dropping the lowest score), calculates
weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.

Before making any changes to source files:
1. Read `src/pipeline.js` and trace the data flow through ALL stages
2. Read each module that pipeline.js calls, in the order they're called
3. Compare the actual execution order against what the CHANGELOG says
4. Write your analysis to ROOT_CAUSE_ANALYSIS.md with these sections:
   - **Data Flow**: Map how data flows through each pipeline stage
   - **Bug Identification**: List each bug, distinguishing ROOT CAUSES from SYMPTOMS
   - **Cascading Effects**: Explain how one bug masks or interacts with another
   - **Fix Plan**: For each bug, describe the EXACT code change needed (which file, which line, what to change)

⚠️ You MUST write ROOT_CAUSE_ANALYSIS.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — implement EXACTLY the fixes from your analysis.

Read your ROOT_CAUSE_ANALYSIS.md from Phase 1.

⚠️ BINDING CONSTRAINT: You MUST implement EXACTLY the fixes described in your Fix Plan above. Do not deviate from your documented plan. If your plan says to reorder pipeline steps, reorder them. If your plan says to change a comparison operator, change it. Your analysis IS your implementation specification — follow it precisely.

Do NOT:
- Implement a different fix than what you documented
- Find a "simpler" alternative that also makes tests pass
- Skip any fix listed in your plan
- Add fixes not in your plan

After implementing all fixes from your plan, run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
