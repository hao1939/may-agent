# Lessons Learned

## Data Integrity
- If a read is truncated, you have NO data. Never analyze, conclude, or write files based on partial content. Use line-range reads for large files.
- After `write()`, always `read()` back the target file to confirm it's complete — no mid-sentence truncation.

## Meta-Loop Discipline
- Verify before briefing: `read` the actual file before requesting a change to it. Don't assume codebase state from secondary metrics.
- The brief is step 3 of 5. Don't stop to report "I have written the brief." Call the optimizer immediately after writing.

## Design Work
- Evidence first, essay second. List the raw data (commits, diffs, quotes) before writing analysis. If the data command returns nothing, your analysis is empty.
- Corrections from the human are the strongest signal — update philosophy.md immediately.
- Watch for drift between stated philosophy and actual system behavior. Either the principle is wrong or the system drifted — investigate which.

## File Editing
- Use `exec` with `sed` or line-range reads for surgical updates. Never rewrite a full file unless you've read the complete content this session.
- Verify delivery: confirm the file on disk matches what you intended.

## Anti-Patterns (from experience)
- Don't try to run agents via `exec` (`npx tsx run/may.ts`, `chmod +x`). Always use `subagents.delegate()`.
- Don't stop at "nice list and wait" — if there's a clear next step, take it.
- Don't treat a single data point as a trend. One comment is curiosity; three in a week is a priority.
