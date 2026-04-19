# Skill: Read Before Edit

**Purpose**: Before every `edit()` call, you MUST `read()` the target file first. This prevents blind edits that corrupt content or fail on mismatched `oldText`.

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
4. **VERIFY** — read-back or grep to confirm the edit landed correctly

## Anti-Patterns (NEVER DO)

- ❌ `edit("file.ts", {oldText: guessed_text, ...})` — guessing oldText without reading
- ❌ Editing any file you haven't read this session
- ❌ Creating new files with `edit()` — use `write()` for new files, `edit()` for existing ones

## Correct Pattern

```
# Step 1: Read the file
read("agents/may/handlers/common-sense-audit.ts")

# Step 2: Now edit with exact text from what you just read
edit("agents/may/handlers/common-sense-audit.ts", {
  oldText: "// exact text copied from read output",
  newText: "// your replacement"
})
```

## Why This Matters

- **C1.1 compliance**: This convention is measured. Every edit without prior read = C1.1 violation.
- **Content safety**: Blind edits fail or corrupt files.
- **Your violation rate is 50%** — half your edits are blind. This is the #1 convention to fix.

## Assertion

Every `edit()` call MUST have a preceding `read()` of the same file path in the session's tool call history.
