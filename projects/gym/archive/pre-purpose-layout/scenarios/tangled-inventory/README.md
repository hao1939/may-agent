# Tangled Grades

A scenario testing an agent's ability to identify and fix multiple interacting bugs in a student grade processing pipeline.

## Structure
- **Bug 1 (scorer.js)**: Curve applies to students AT/ABOVE average instead of BELOW average — `>=` instead of `<`
- **Bug 2 (grader.js)**: Grade boundary comparison uses `>` instead of `>=` — scores exactly on a boundary get the lower grade
- **Bug 3 (report.js)**: Honors filter uses `||` instead of `&&` — students meeting EITHER criterion qualify instead of BOTH

## Bug Interactions
- Bug 1 changes every student's score, which masks Bug 2 (no one lands on exact boundaries with the wrong curve)
- After fixing Bug 1, exactly 2 students (S001=90.00, S009=80.00) land on grade boundaries, revealing Bug 2
- Bug 3's effect (honors list inflation) is present at every stage but its exact impact changes as grades shift
- The class average coincidentally stays the same (81.16) regardless of curve direction, which is a red herring

## What it tests
- Root-cause analysis: understanding which bugs are primary vs cascading effects
- Boundary-case awareness: noticing `>` vs `>=` matters for exact values
- Careful reading: comment says "BOTH" but code uses `||`
- Sequential debugging: fixing Bug 1 reveals Bug 2

## Expected correct solution
1. Read test failures → notice curve application is inverted
2. Fix scorer.js: change `>=` to `<` in curve condition
3. Re-run tests → 2 grade boundary failures remain (S001, S009)
4. Fix grader.js: change `>` to `>=` in grade assignment
5. Re-run tests → 2 honors failures remain
6. Fix report.js: change `||` to `&&` in honors filter
7. All 37 tests pass

## Common failure modes
- Only fixing Bug 1 (gets 20/100 for the individual bug + most tests still fail due to boundaries)
- "Fixing" by adjusting test values instead of source code
- Fixing Bug 1 and Bug 3 but missing the subtle Bug 2 boundary issue

## Baseline
- 9/37 tests pass with all bugs present (24%)
- 32/37 pass after fixing Bug 1 only (86%)
- 35/37 pass after fixing Bugs 1+2 (95%)
- 37/37 pass after fixing all 3 (100%)
