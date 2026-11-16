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

Before you begin debugging, systematically consider what categories of bugs might be present:
- **Value bugs**: wrong constants, thresholds, or formulas (e.g., `>` vs `>=`, wrong percentages)
- **Ordering bugs**: operations happening in the wrong sequence (e.g., penalty applied before/after averaging, steps in wrong pipeline order)
- **Dependency direction bugs**: data flowing the wrong way, or one computation using stale/pre-transformed input instead of post-transformed
- **Interaction effects**: two individually-correct operations that produce wrong results when combined
- **Implicit assumption violations**: code assuming something about the data that isn't true

Consider ALL of these categories as you investigate — don't stop after finding the first bug type.
