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

- ❌ `edit("papers.md", {oldText: guessed_text, ...})` — guessing oldText without reading
- ❌ Editing journal.md, todo.md, or any file you haven't read this session
- ❌ Editing a shared file (library/papers.md, discoveries.md) without reading recent entries first (you'll create duplicates)
- ❌ Creating new deep-dive files with `edit()` — use `write()` for new files, `edit()` for existing ones

## Correct Pattern

```
# Step 1: Read the file
read("agents/shared/knowledge/library/papers.md", {offset: 1, limit: 30})

# Step 2: Now edit with exact text from what you just read
edit("agents/shared/knowledge/library/papers.md", {
  oldText: "## Recent Papers\n\n| Date |",  // copied from read output
  newText: "## Recent Papers\n\n| 2026-04-04 | New Paper | ... |\n| Date |"
})
```

## Why This Matters

- **C1.1 compliance**: This convention is measured. Every edit without prior read = C1.1 violation.
- **Content safety**: Blind edits can corrupt files you share with the whole team.
- **Duplicate prevention**: Reading first lets you check if content already exists.
- **Your rate dropped from 90% to 33%** — this is the #1 convention you're failing.

## Files You Edit Most (high-risk)

These files ALWAYS need a read before edit:
- `agents/scout/journal.md` — your journal, changes every session
- `agents/scout/todo.md` — your task list
- `agents/shared/knowledge/library/papers.md` — shared library
- `agents/shared/knowledge/library/discoveries.md` — shared library
- `agents/shared/projects/*.md` — shared projects
- `agents/shared/knowledge/library/deep-dives/*.md` — deep dive files

## Assertion

Every `edit()` call MUST have a preceding `read()` of the same file path in the session's tool call history.
