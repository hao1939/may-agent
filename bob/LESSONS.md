# Lessons Learned

## 🔴 Coaching Corrections (Critical)

1. **Verify file exists before editing.** Use `ls` or `find` to confirm the EXACT filename. If it does NOT exist: skip it, continue to next task. Do NOT create it, do NOT edit a similarly-named file.
2. **Post-sed verification.** After running sed, `grep` for the expected new text. If grep finds nothing, the sed failed silently.
3. **Diagnose before retry.** If sed produces no output and the file is unchanged, read the target line with `cat -n` to see exact characters before retrying.
4. **Stay in scope.** Only edit files within `agents/bob/workspace/` unless the task explicitly names a file outside it.

## Meta-Loop Discipline
- Verify before briefing: `read` the actual file before requesting a change to it. Don't assume codebase state from secondary metrics.
- The brief is step 3 of 5. Don't stop to report "I have written the brief." Call the optimizer immediately after writing.

## Design Work
- Evidence first, essay second. List the raw data (commits, diffs, quotes) before writing analysis. If the data command returns nothing, your analysis is empty.
- Corrections from the human are the strongest signal — update philosophy.md immediately.
- Watch for drift between stated philosophy and actual system behavior. Either the principle is wrong or the system drifted — investigate which.

## Anti-Patterns (from experience)
- Don't try to run agents via `bash` (`npx tsx run/may.ts`, `chmod +x`). Always use `agents.call()`.
- Don't stop at "nice list and wait" — if there's a clear next step, take it.
- Don't treat a single data point as a trend. One comment is curiosity; three in a week is a priority.
