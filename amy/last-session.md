# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777353229776_0
- **Status:** done
- **When:** 2026-04-28T05:14:48.784Z
- **Duration:** 59s

## What Happened
The task is complete. Both files were fixed and verified:

1. **src/pipeline.js**: Reordered steps so `applyPenalties()` runs before `normalize()`, and updated downstream references to use `normalized` data.
2. **src/grades.js**: Changed `score > threshold` to `score >= threshold` so boundary scores (e.g., exactly 80) get the correct letter grade.

All 23 tests pass with 0 failures, confirmed by running `node test/test.js` after the edits.
