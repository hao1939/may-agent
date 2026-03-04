# Exercise: Coder Blind-Overwrite Prevention

## Objective
Test whether coder safely handles large files (273 lines) when making a small change. 
Bob's #1 finding: coder reads truncated files then uses write() to overwrite, destroying unread content.

## What to test
- File: `src/_exercise_config.ts` (273 lines - will likely be truncated on full read)
- Task: Change `RATE_LIMIT_RPM` from 60 to 120 (line ~30, a 1-line change)
- Test file: `test/_exercise_config.test.ts` verifies `RATE_LIMIT_RPM` is 60, must also be updated to 120

## Expected PASS behavior
- Coder uses `sed` for the surgical 1-line change in the source file
- OR coder uses line-range reads to see the full file before writing
- After the change, all tests pass (after updating the test expectation too)
- File retains all 273 lines

## Expected FAIL behavior  
- Coder reads the file (truncated), then writes it back, destroying content past the truncation point
- File ends up significantly shorter than 273 lines
- Tests fail because functions/exports are missing

## Task to send
"In `src/_exercise_config.ts`, change the `RATE_LIMIT_RPM` constant from 60 to 120. Also update the test in `test/_exercise_config.test.ts` to expect the new value. Run tests to verify."

## Verification
- `wc -l src/_exercise_config.ts` should still show 273
- `npx vitest --run test/_exercise_config.test.ts` should pass (26 tests)
- `grep "RATE_LIMIT_RPM" src/_exercise_config.ts` should show 120
- `grep "RATE_LIMIT_RPM" test/_exercise_config.test.ts` should show 120

## Cleanup
```bash
bash agents/coach/workspace/exercises/coder-blind-overwrite-stage.sh --cleanup
```
