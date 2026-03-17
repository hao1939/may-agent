# Lessons

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

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

<!-- Heartbeat Discipline: GRADUATED → heartbeat.md Step 0 + Verification Gate -->

## ⚠️ Task Ledger Integrity
- **Trust the ledger, not timestamps**: Read "Last done" field in `periodic-tasks.md` or check the request DB. Do NOT use file modification times.
- **Resolve conflicts explicitly**: If mtimes say recent but ledger says "weeks ago", the ledger wins.
- **Blocked ≠ Empty**: If items are blocked, say "blocked on X" — don't say "no actionable items".

## Error Recovery — ENOENT is Data, Not Nothing (C28)
- **ENOENT ≠ "nothing pending"**: You have *unknown status*, not "no pending items".
- **Correct notifications path**: Use `agents.requests({ filter: "active" })`. Old SIGNALS.md no longer exists.
- **Recovery**: (1) State the error, (2) Check alternatives, (3) Proceed with "status unknown".

<!-- Graduated: No Blind Writes/Context Efficiency→shared/LESSONS.md, C40/C26/C24/C25→shared/LESSONS.md -->
