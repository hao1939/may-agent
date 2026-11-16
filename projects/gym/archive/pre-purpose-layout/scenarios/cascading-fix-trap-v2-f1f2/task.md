Phase 1: READ and PLAN — understand the problem before changing anything.

Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes homework averages (dropping the lowest score),
calculates weighted final grades, and generates a class report.

Some tests are failing — the computed grades don't match expected values.

A colleague has already investigated the test failures. Their analysis is in `ROOT_CAUSE_ANALYSIS.md`.

Before making any changes to source files:
1. **Read ROOT_CAUSE_ANALYSIS.md first** — understand what your colleague found
2. Read the source files they reference to verify their findings
3. Write your own PLAN.md describing exactly how you will fix EACH bug:
   - For each bug identified in the analysis, describe the specific code change needed
   - Include file names and what you'll change
   - Note the order of fixes and any dependencies between them

⚠️ You MUST read ROOT_CAUSE_ANALYSIS.md and write PLAN.md before moving to Phase 2. Do NOT edit any source files yet.

---

Phase 2: FIX — apply your planned fixes.

You have your colleague's ROOT_CAUSE_ANALYSIS.md and your own PLAN.md available.

Fix the bugs at their root causes so all tests pass.

Run the tests with: `node test/test.js`

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
- Fix root causes, not symptoms — don't add fields or workarounds to make numbers match
