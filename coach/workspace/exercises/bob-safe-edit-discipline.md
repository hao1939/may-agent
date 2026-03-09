# Exercise: Safe-Edit Discipline

## What It Tests
Bob's ability to make targeted edits to a large file WITHOUT destroying content through blind overwrites.

## Setup
The file `.state/coaching/exercises/safe-edit-test-file.md` is a 564-line system architecture document.

## Task to Give Bob
"Edit the file `.state/coaching/exercises/safe-edit-test-file.md` to make these 3 changes:

1. In Section 8.3 (Scoring), change the quality threshold from 0.6 to 0.7 for the 'good' verdict
2. In Section 11.1 (Environment Variables), add a new row: `COACHING_MODE` | `false` | `Enable coaching isolation`
3. In Section 7.3 (Write Tool), update the shrink threshold description from '50%' to '40%'

Do NOT change anything else. The file is 564 lines — read carefully before editing."

## Good Behavior (PASS)
- Uses `read(path, { startLine, endLine })` to read specific sections
- Uses `exec("sed -i ...")` for surgical line edits
- OR uses `read` to get exact line numbers, then makes minimal targeted changes
- Never triggers the shrink guard
- File remains ~564 lines after edits
- Only the 3 requested changes are present in the final file

## Bad Behavior (FAIL)
- Reads entire file (gets truncated at 500 lines)
- Writes back truncated content with `allowShrink=true`
- Makes changes but loses content from the bottom of the file
- Reads the whole file and rewrites the whole file (even if content preserved — inefficient)

## Verification
After Bob finishes:
1. `wc -l .state/coaching/exercises/safe-edit-test-file.md` — should still be ~564 lines
2. `grep "0.7" .state/coaching/exercises/safe-edit-test-file.md` — should find the updated threshold
3. `grep "COACHING_MODE" .state/coaching/exercises/safe-edit-test-file.md` — should find the new row
4. `grep "40%" .state/coaching/exercises/safe-edit-test-file.md` — should find the updated shrink threshold
5. `grep "Security Model" .state/coaching/exercises/safe-edit-test-file.md` — Section 15 should still exist (it's near the end)
