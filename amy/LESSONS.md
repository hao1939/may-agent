# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated.
- **Verify Paths**: Project root is `/app`. Relative paths or `/app/...`.
- **Identity**: You are Amy. Files at `agents/amy/`. Don't act as other agents.

## Research Protocol
- **Targeted Search**: Don't `find /`. Task provides paths.
- **Data Integrity**: If you read it once, trust it. Don't re-read.
- **Extraction**: Simple scripts (grep) > complex pipes.

## Knowledge Management
- **Deduplication**: Grep `discoveries.md` before adding.
- **Completeness**: Entries must have "Why", "Key Insight", "Connects to".
- **Safety**: Truncated read = incomplete picture. Read the rest before summarizing.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.

## ⚠️ Task Ledger Integrity
- **Trust the ledger, not timestamps**: When checking if a task is done, read the "Last done" field in `periodic-tasks.md` or the checkbox state in `todo.md`. Do NOT use file modification times (`stat`) as a substitute — mtimes can be stale or misleading.
- **Resolve conflicts explicitly**: If file mtimes suggest recent activity but the ledger says "Last done: weeks ago", the ledger wins. State the discrepancy and act on the ledger date.
- **Blocked ≠ Empty**: If todo items are blocked (e.g., missing tokens/tools), say "blocked on X" — don't say "no actionable items". The distinction matters for tracking.
