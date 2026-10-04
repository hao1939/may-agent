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

- ❌ **`bash("tail -5 file.md")` then `edit(file.md)`** — `bash("tail")` does NOT count as a read. The checker ONLY recognizes `read()` calls. This is your #1 violation pattern.
- ❌ `edit("file.md", {oldText: guessed_text, ...})` — guessing oldText without reading
- ❌ Editing your journal.md, workspace files, or any file you haven't `read()` this session
- ❌ `write(file)` then `edit(file)` without an intervening `read(file)` — even after write, you need read before edit
- ❌ Rapid-fire edits to the same file — read once, plan all changes, make them in as few edits as possible

## Correct Pattern: Journal Append (YOUR MOST COMMON OPERATION)

```
# Step 1: Get line count
bash("wc -l agents/qa/workspace/journal.md")  // → e.g., 5115

# Step 2: READ the last lines (REQUIRED — this is the C1.1 read)
read("agents/qa/workspace/journal.md", { offset: 5111, limit: 5 })

# Step 3: Edit using exact text from step 2
edit("agents/qa/workspace/journal.md", {
  oldText: <paste last lines from step 2>,
  newText: <those lines + your new entry>
})
```

**NEVER substitute `bash("tail -5 ...")` for step 2. It will cause a C1.1 violation every time.**

## Correct Pattern: General File Edit

```
# Step 1: Read the file
read("agents/qa/workspace/unreviewed-findings.md")

# Step 2: Now edit with exact text from what you just read
edit("agents/qa/workspace/unreviewed-findings.md", {
  oldText: "...",  // copied from read output
  newText: "... updated ..."
})
```

## Why This Matters

- **C1.1 compliance**: This convention is measured. Every edit without prior read = C1.1 violation.
- **Content safety**: Blind edits can corrupt shared files.
- **Your current rate is ~78%** — your worst convention, mostly from journal.md appends using `tail` instead of `read()`.

## Files You Edit Most (high-risk)

These files ALWAYS need a `read()` before edit:
- `agents/qa/workspace/journal.md` — 55% of your violations come from this file
- `agents/qa/workspace/unreviewed-findings.md` — 20% of your violations
- `agents/qa/SOUL.md` — occasional violations
- Any file you `write()` and then want to `edit()` — read in between

## Assertion

Every `edit()` call MUST have a preceding `read()` of the same file path in the session's tool call history.
