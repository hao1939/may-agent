Phase 1: ANALYZE — understand the problem before changing anything.

Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.
Investigate the pipeline, find the bugs, and fix them so all tests pass.

Before making any changes to source files:
1. Read `src/pipeline.js` and trace the data flow through ALL stages
2. Read each module that pipeline.js calls, in the order they're called
3. Compare the actual execution order against what the CHANGELOG says
4. Write your analysis to ROOT_CAUSE_ANALYSIS.md with these sections:
   - **Data Flow**: Map how data flows through each pipeline stage
   - **Bug Identification**: List each bug, distinguishing ROOT CAUSES from SYMPTOMS
   - **Cascading Effects**: Explain how one bug masks or interacts with another
   - **Fix Plan**: For each bug, describe the ROOT CAUSE fix (not a workaround)

⚠️ You MUST write ROOT_CAUSE_ANALYSIS.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: COMMIT — plan your specific implementation before coding.

Read your ROOT_CAUSE_ANALYSIS.md from Phase 1.

Now write a specific implementation plan to FIX_PLAN.md with these sections:

## Root Cause Reference
Which root cause(s) from ROOT_CAUSE_ANALYSIS.md does this fix address?
Copy the specific bug description(s) from your analysis.

## Architectural Change
What is the structural/architectural change needed? Describe the specific
modification to the system's architecture (not just "fix the bug" — what
changes about the pipeline structure, data flow, or module interactions?).

## Files to Modify
For each file that needs to change, specify:
- **File**: (path)
- **Current behavior**: (what it does now that's wrong)
- **New behavior**: (what it should do after your fix)
- **Specific change**: (what lines/logic to add, remove, or modify)

## Implementation Order
In what order will you make the changes? Why this order?

## Verification
How will you verify the fix addresses the root cause, not just passes tests?

⚠️ You MUST write FIX_PLAN.md before moving to Phase 3. Do NOT edit any source files yet.

---

Phase 3: FIX — implement your committed plan.

Read your FIX_PLAN.md from Phase 2.

Implement the specific changes you committed to in your plan. Follow your
plan — if you discover your plan needs adjustment during implementation,
update FIX_PLAN.md first to document the change, then continue implementing.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
- Implement the fixes from your plan — don't take shortcuts
