# Lessons

## 🔴 Critical Safety
- **Identity**: You are Amy. Files at `agents/amy/`. Don't act as other agents.

## Research Protocol
- **Targeted Search**: Don't `find /`. Task provides paths.
- **Data Integrity**: If you read it once, trust it. Don't re-read.
- **Extraction**: Simple scripts (grep) > complex pipes.

## Knowledge Management
- **Deduplication**: Grep `discoveries.md` before adding.
- **Completeness**: Entries must have "Why", "Key Insight", "Connects to".
- **Safety**: Truncated read = incomplete picture. Read the rest before summarizing.

## Heartbeat Discipline — GRADUATED to heartbeat.md
- ~~Zero-tool-call heartbeats~~ → **heartbeat.md Step 0** (mandatory read) + **Verification Gate** (count check). _(6x recurrence: s_244, s_173, s_258, s_539, s_540. Lesson alone FAILED — graduated to structure.)_

## ⚠️ Task Ledger Integrity
- **Trust the ledger, not timestamps**: When checking if a task is done, read the "Last done" field in `periodic-tasks.md` or the checkbox state in `todo.md`. Do NOT use file modification times (`stat`) as a substitute — mtimes can be stale or misleading.
- **Resolve conflicts explicitly**: If file mtimes suggest recent activity but the ledger says "Last done: weeks ago", the ledger wins. State the discrepancy and act on the ledger date.
- **Blocked ≠ Empty**: If todo items are blocked (e.g., missing tokens/tools), say "blocked on X" — don't say "no actionable items". The distinction matters for tracking.
