# Skill: Read Before Edit

**Purpose**: Before every `edit()` call, you MUST `read()` the target file first. This prevents blind edits that corrupt content, duplicate entries, or break file structure.

## The Rule

**Every `edit()` call MUST be preceded by a `read()` of the same file in the same session.**

No exceptions. Even if you "just wrote" the file. Even if you "know" what's in it. Read first.

## Trigger

Before calling `edit(path, ...)` — ask yourself: "Did I `read(path)` in this session?"
- If YES → proceed with edit
- If NO → `read(path)` first, THEN edit

## Protocol

1. **READ the target file** — `read("path/to/file.md")` (use offset/limit for large files)
2. **LOCATE your edit point** — find the exact text you need to match for `oldText`
3. **EDIT with exact match** — use the text you just read as `oldText`
4. **VERIFY** — read-back or grep to confirm (per verify-after-edit skill)

## Anti-Patterns (NEVER DO)

- ❌ `edit("PRIORITY-TRACKER.md", {oldText: guessed_text, ...})` — guessing oldText without reading
- ❌ Editing hypotheses, synthesis docs, or INDEX.md without reading them first this session
- ❌ Editing your journal.md, workspace files, or any file you haven't read this session
- ❌ Rapid-fire edits to the same file (e.g., 6 edits to PRIORITY-TRACKER.md) — read once, plan all changes, make them in as few edits as possible

## Correct Pattern

```
# Step 1: Read the file
read("agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md")

# Step 2: Now edit with exact text from what you just read
edit("agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md", {
  oldText: "| H-055 | ...",  // copied from read output
  newText: "| H-055 | ... updated ..."
})
```

## Why This Matters

- **C1.1 compliance**: This convention is measured. Every edit without prior read = C1.1 violation.
- **Content safety**: Blind edits can corrupt shared files.
- **Duplicate prevention**: Reading first lets you check if content already exists.
- **Your current rate is ~67%** — you frequently edit PRIORITY-TRACKER.md, hypotheses, and synthesis docs without reading first.

## Files You Edit Most (high-risk)

These files ALWAYS need a read before edit:
- `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md` — most violated file
- `agents/shared/knowledge/hypotheses/H-*.md` — hypothesis files
- `agents/shared/knowledge/synthesis/WKWA-*.md` — synthesis documents
- `agents/shared/knowledge/INDEX.md` — shared knowledge index
- `agents/bob/workspace/journal.md` — your journal

## Assertion

Every `edit()` call MUST have a preceding `read()` of the same file path in the session's tool call history.
