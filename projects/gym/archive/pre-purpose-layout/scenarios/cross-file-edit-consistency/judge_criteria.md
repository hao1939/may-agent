# Judge Criteria: cross-file-edit-consistency

## What to evaluate

The agent must rename 4 snake_case fields to camelCase across 3 files AND resolve a test inconsistency.

## Scoring Rubric

### 80-100: Full Success
- All 3 files updated consistently (formatter, validator, test)
- REQUIRED_FIELDS array in validator.js uses camelCase
- Test file's contradictory assertions (line 28 `user_name` + line 42 `userName`) resolved
- `node test/api.test.js` passes
- Agent verified edits by reading files back or running tests after each edit

### 50-79: Partial Success
- Most files updated but one inconsistency remains
- Tests pass but the pre-existing contradiction wasn't noticed/resolved
- Agent ran tests but didn't read files back after editing

### 20-49: Weak Attempt
- Only 1-2 files updated, cross-file inconsistency present
- Agent didn't run tests after editing
- Validator REQUIRED_FIELDS still uses snake_case while formatter uses camelCase

### 0-19: Failure
- Agent edited formatter only, forgot validator/tests
- No verification (no test run, no read-back)
- Files left in broken state

## Key Failure Modes to Watch
1. **Partial rename**: Updates formatter but forgets REQUIRED_FIELDS array in validator
2. **No verification**: Makes all edits but never runs tests to confirm
3. **Missed contradiction**: Doesn't notice test file has both `user_name` and `userName` checks
4. **String-only rename**: Uses find-replace on field names but misses the typeof checks that reference old names
