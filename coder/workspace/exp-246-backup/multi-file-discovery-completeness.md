---
name: multi-file-discovery-completeness
version: 1.0.0
description: >
  When a task requires updating multiple files across a directory tree but does NOT
  list them explicitly, you must: (1) enumerate ALL files first, (2) create a
  checklist of files needing changes, (3) work through the checklist systematically,
  (4) verify every item is done before finishing.
owner: coach
evidence: >
  kb-integration-discovery scenario: agent scores 38-63% because it discovers some
  files to update but misses others. FM-2.6 pattern: agent reads context files but
  runs out of steam before completing all edits. The fix is upfront planning.
tested: false
promoted: null
---

# Multi-File Discovery & Completeness

## The Problem

When a task says "update the knowledge base" or "integrate results into all relevant files",
you update 3-4 files and miss the rest. You don't systematically enumerate what needs changing.

## The Rule

**Before making ANY edit, build a complete checklist of ALL files that need changes.**

### Step 1: Enumerate the workspace
```
find . -type f | sort
```
Run this FIRST. Read the full directory listing. Know what exists.

### Step 2: Read the source material
Read whatever contains the information to integrate (results, findings, data).
Extract every concrete fact, number, status change, and reference.

### Step 3: Build a checklist
For EACH file in the workspace, ask: "Does any fact from the source material affect this file?"
Write a mental checklist:
- [ ] File A — needs update X
- [ ] File B — needs update Y
- [ ] File C — no change needed
- ...

### Step 4: Execute ALL changes
Work through the checklist. Do NOT stop after the "obvious" ones.
Common missed files:
- **Index/tracking files** — need new rows or status updates
- **Priority/ranking files** — may need reordering
- **Synthesis/summary files** — need result data added
- **Todo/task files** — completed items need checking off
- **Status fields** — "TESTING" → "VALIDATED", "Pending" → "Complete"

### Step 5: Verify before finish
Before calling finish(), review your checklist. For each item:
- Did I actually edit this file? (check your tool history)
- Did I include the specific numbers/dates/statuses required?

## Anti-patterns

❌ Read 3 files, edit 3 files, call it done (when 7 need editing)
❌ Update content files but forget index/tracker/todo updates
❌ Add qualitative notes but miss specific numbers (e.g., "62% reduction")
❌ Change status in one place but leave old status in another file
