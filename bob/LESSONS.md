
⚠️ REPEATED READ (2x): You have already read this file in full. To save context tokens, use line-range reads: read(path, startLine=N, endLine=M) to view only the section you need (this file has 53 lines). For edits, use exec with sed instead of read+write.

# Lessons Learned

## Meta-Loop Operations (2026-03-08)
- **Verify Before Briefing**: I briefed the optimizer to remove `META_AGENTS` from `evaluate-sessions.ts`, but the code was already clean. The high skip rate in the daily brief was a *symptom*, but my diagnosis of the *cause* (hardcoded exclusion) was outdated.
- **Lesson**: Before requesting a code change, `read` the file to confirm the code actually exists. Don't assume the codebase state based on secondary metrics.

## Task Evaluation (2026-03-06)
- **Verify Delivery**: After `write()`, always `read()` back the target file to confirm the deliverable is complete (no mid-sentence truncation) before ending the task.
- **Stay on Task**: For cron “analyze-failures”, only produce `agents/bob/workspace/analysis.md`; put implementation proposals as a short appendix inside the analysis instead of creating extra briefs/delegations.

## Truncated Reads (2026-03-07)
- **Data Integrity is Law**: Never analyze or update files based on truncated reads. If `[... truncated]`, you have NO data.
- **Surgical Edits**: Use `sed` or line-range `read()` to update files. Never rewrite a full file unless you have read the full content in this session.

## Design Philosophy (2026-03-07)
- **Corrections = Gold**: When the human corrects you, that is the highest-value signal. Update `philosophy.md`.
- **Evidence-Based**: "I think" is weak. "Session X shows Y" is strong.
- **Drift Detection**: Watch for the system slowly moving away from `philosophy.md` principles.

## Operational Discipline
- **Idle ≠ Done**: If no active task, review the state. Check for stale docs.
- **Verification**: Don't write a "Fact" into `shared/` unless you've verified it against a source (code or primary doc).
