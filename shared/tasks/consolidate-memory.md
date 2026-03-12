# Task: Consolidate Memory

## Purpose
Transform your episodic memory (recent experiences in `workspace/journal.md`) into semantic knowledge (long-term facts in `knowledge/*.md`). This prevents memory overload and ensures lessons are learned permanently.

This is the **"Manage"** step of the Write-Manage-Read loop (see `agents/shared/philosophy.md` Principle #11).

## Trigger
- Weekly cron job (`consolidate-memory` in `cron.json`).
- Manually, when `workspace/journal.md` exceeds ~500 lines.

## Pre-Check
1. Read `workspace/journal.md`.
2. If the file is empty, missing, or contains only a header with no entries — **stop here**. Report "Nothing to consolidate" and exit. Do not create empty archives or touch knowledge files.

## Steps

### 1. Analyze Context
- Read `workspace/journal.md` (your recent history).
- Read `knowledge/INDEX.md` (your current knowledge map).
- Skim specific knowledge files that seem relevant to recent work.

### 2. Extract Knowledge
Identify three categories in the journal:

1. **Facts**: Immutable truths about the project, environment, or user preferences.
   - *Example:* "The project uses Node v22", "User prefers tables for data".
2. **Patterns**: Recurring success/failure modes worth remembering.
   - *Example:* "Always verify file existence before edit", "Tests fail if DB is not mocked".
3. **Dead Ends**: What failed and shouldn't be repeated.
   - *Example:* "Do not use `fs.exists` (deprecated), use `fs.stat` instead".

If nothing qualifies as durable knowledge (e.g., journal only contains routine "did X, did Y" logs with no insight), skip to Step 4 — archive and reset, but don't force knowledge updates.

### 3. Update Knowledge Files
- **Edit**: If a fact belongs in an existing file (e.g., `knowledge/project-structure.md`), add it there.
- **Create**: If a cluster of facts represents a new topic, create a new file.
- **Index**: If you created a new file, add it to `knowledge/INDEX.md`.

**Constraint**: Do NOT dump raw logs. Summarize into clear directives or facts. Use the "Simplest Thing That Works" principle. One concise bullet > one verbose paragraph.

### 4. Archive and Reset
- **Archive**: Append the *entire content* of `workspace/journal.md` to `workspace/archive/journal-YYYY-MM.md`. Create the directory/file if needed. Use the current year-month.
- **Reset**: Overwrite `workspace/journal.md` with a minimal header:
  ```
  # Journal
  ```

### 5. Report
Briefly state:
- What knowledge was added/updated (files and key points).
- OR: "No durable knowledge extracted — journal was routine."
- Confirm journal was archived to `workspace/archive/journal-YYYY-MM.md` and reset.
