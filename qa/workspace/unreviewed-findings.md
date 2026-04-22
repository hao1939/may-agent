# Unreviewed findings (QA heartbeat)

## Context
Recent commit(s) include fixes to a “student grade pipeline” (e.g., `cabe150`). I reviewed key changed files for correctness and attempted to run mandatory checks.

## Checks
- `./node_modules/.bin/tsc --noEmit`: **FAIL (environment)** — `./node_modules/.bin/tsc: No such file or directory` (exit 127)
- `./node_modules/.bin/vitest --run`: **FAIL (environment)** — `./node_modules/.bin/vitest: No such file or directory` (exit 127)

## Findings
### CRITICAL — Pipeline step ordering contradicts its own documentation and penalty implementation
- File: `src/pipeline.js`
- Evidence:
  - Header comment states: “Normalization must precede penalty application so that penalty deductions are expressed in percentage points (not raw points).”
  - Implementation does the opposite:
    - Step 3: `applyPenalties(validated);`
    - Step 4: `normalize(penalized);`
- Why this matters:
  - `src/penalties.js` computes `rawPct = (score/max_score)*100` and deducts penalty in percentage points, then converts back to raw points. This logic *does not require* prior normalization because it computes percentage internally.
  - As written, the comment is misleading at best. If the intended design is “normalize then penalty”, the current order is wrong; if the intended design is “penalty then normalize”, then the comment must be updated.

### IMPORTANT — Homework aggregation can produce NaN when all homework is dropped
- File: `src/homework.js`
- Evidence:
  - `const kept = sorted.slice(policy.drop_lowest_hw);`
  - `const avg = sum / kept.length;`
- If `policy.drop_lowest_hw >= hwRecords.length`, `kept.length` becomes 0, yielding `avg = NaN` and `homework_avg` becomes `NaN`.
- Should be guarded (e.g., if kept is empty, set average to 0 or to the mean of all scores, per policy).

## Notes
Repo appears to be missing dependencies and scripts (e.g., `package.json` contains only name/version/private), so required tsc/vitest checks cannot be executed in this environment.
