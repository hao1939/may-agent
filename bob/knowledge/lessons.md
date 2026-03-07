# Lessons

## ⛔ CRITICAL: Blind Overwrite Prevention

**The #1 cause of failure is writing a file after a truncated read.**
1. **Rule**: If `read()` output contains `[... truncated]`, you **MUST NOT** use `write()`.
2. **Rule**: Never guess what was in the missing text.
3. **Fix**: Use `read(path, startLine=N, endLine=M)` to get the full content.
4. **Fix**: Use `sed` for surgical edits (avoids full-file overwrite risks).

## Meta-Loop Operations

### Action Over Reporting
- **Don't Stop at Synthesis**: Identifying a problem is step 1. Fixing it (or delegating the fix) is step 2.
- **Brief the Optimizer**: Your output isn't a markdown file — it's a specific instruction to the Optimizer agent.
- **Safe Editing Advice**: When briefing the optimizer, recommend `sed` with pattern matching, NEVER line numbers.

### Design Philosophy
- **Corrections = Gold**: When the human corrects you, that is the highest-value signal. Update `philosophy.md`.
- **Evidence-Based**: "I think" is weak. "Session X shows Y" is strong.
- **Drift Detection**: Watch for the system slowly moving away from `philosophy.md` principles.

## Operational Discipline
- **Idle ≠ Done**: If no active task, review the state. Check for stale docs.
- **Verification**: Don't write a "Fact" into `shared/` unless you've verified it against a source (code or primary doc).
- **No Partial Analysis**: Truncated data = Fake data. Never draw conclusions from a truncated log.

## Task evaluation (2026-03-06 05:05:10)

- After `write()`, always `read()` back the target file to confirm the deliverable is complete (no mid-sentence truncation) before ending the task.
- Stay on-task: for cron “analyze-failures”, only produce `agents/bob/workspace/analysis.md`; put implementation proposals as a short appendix inside the analysis instead of creating extra briefs/delegations.
- Don’t attempt non-existent tools (e.g., `subagents`); if delegation is needed, use the supported mechanism for your runtime or explicitly note inability and proceed with local analysis.

## Task evaluation (2026-03-06 16:28:53)

- After reading required inputs, always produce the specified file deliverable (`agents/bob/workspace/rolling-compaction-review.md`) before ending the session.
- Explicitly address each enumerated question in the prompt (1–5) with concrete answers and risk/ordering recommendations; do not stop after gathering context.
