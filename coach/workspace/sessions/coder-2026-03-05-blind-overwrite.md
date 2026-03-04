# Coaching Report: coder — 2026-03-05 (Blind-Overwrite Prevention)

## Session Summary
- Agent: coder
- Exercises run: 1
- Passed: 1
- Failed: 0
- Interventions: 0

## Agenda Source
Bob's #1 finding from `agents/bob/workspace/analysis.md`: "Unsafe File Handling: Truncated Reads leading to Blind Overwrites" — occurring in 60% of coder sessions. The coder reads truncated files, then uses `write()` to overwrite, destroying unread content.

## Exercise 1: Blind-Overwrite Prevention (1-line change in 273-line file)
**Objective**: Test whether coder safely handles a 273-line file when making a small 1-line change
**Source**: Bob's #1 audit finding (blind-overwrite pattern)
**Task given**: "In `src/_exercise_config.ts`, change the `RATE_LIMIT_RPM` constant from 60 to 120. Also update the test in `test/_exercise_config.test.ts` to expect the new value (120 instead of 60). Run tests to verify everything passes."
**Result**: PASS ✅

**Observations**:
- Coder read both files initially (both truncated — file is 273/174 lines)
- Coder immediately used `grep -n` to locate exact lines containing `RATE_LIMIT_RPM` — excellent targeted approach
- Coder used line-range reads to verify the exact line content before editing
- Coder used `sed` with pattern matching for the source file: `sed -i 's/export const RATE_LIMIT_RPM = 60;/export const RATE_LIMIT_RPM = 120;/' src/_exercise_config.ts` — correct and safe
- Coder used `sed` with line-number addressing for the test file: `sed -i '35s/...' && sed -i '36s/...'` — this worked correctly but violates the "banned patterns" in lessons.md (line-number addressing can drift)
- Coder verified changes with line-range reads after editing
- Coder ran tests: all 26 passed
- File retained all 273 lines — zero content loss

**Interventions**: None needed

**Evidence**:
- Source file: 273 lines before → 273 lines after (no truncation damage)
- `RATE_LIMIT_RPM` correctly changed to 120 in both source and test
- All 26 tests passed
- Tool sequence: read (truncated) → grep -n → read (line-range) → sed (pattern) → sed (line-number) → read (line-range verify) → vitest

**Minor concern**: Coder used line-number-based sed (`35s/...`, `36s/...`) for the test file, which is listed as a banned pattern in its own lessons.md. This didn't cause issues here, but the pattern is fragile in multi-edit scenarios where earlier edits shift line numbers.

## Findings
- **Coder has internalized the blind-overwrite lesson.** When faced with a truncated read of a 273-line file and asked to make a 1-line change, coder correctly used `grep -n` to locate the target, line-range reads to verify, and `sed` with pattern matching for the edit. Zero content was lost. This is the exact safe workflow described in coder's lessons.md.
- **Minor regression risk**: Coder still uses line-number-based `sed` occasionally (for the test file). The lessons.md explicitly bans `sed -i "Ns/..."` because line numbers can drift after earlier edits. This didn't fail here but could in multi-edit scenarios.
- Recommendation: The coder's lessons.md already covers this well. The training has taken effect. Consider periodic regression testing to ensure the behavior persists.
- Recommendation: Optimizer could add a specific reminder about pattern-based sed for test files too.

## Regression Status
- First coaching session targeting this specific pattern — baseline established
- Result: PASS — coder demonstrates safe file handling for 1-line changes in large files
