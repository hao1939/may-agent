The data processing pipeline produces incorrect aggregate totals. Users report that revenue figures are consistently lower than expected.

The pipeline processes records through three stages: validate → transform → aggregate.

**To reproduce:**
- Run `node run.js` — observe the aggregate totals
- Run `node test.js` — some tests are failing

**Your task:** Find and fix the bug. All tests must pass when you're done.

**Constraints:**
- Do NOT modify `test.js`
- The source code is in `src/`
- Log files from recent runs are in `logs/`
