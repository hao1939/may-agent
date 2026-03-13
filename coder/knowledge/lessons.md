# Coder — Lessons Learned

Hard-won patterns from coaching, exercises, and real tasks.

## #1 — NEVER Use Line-Number-Based Sed

**BANNED:** `sed -i '6s/old/new/'`, `sed -i '107s|...|...|'`

**REQUIRED:** `sed -i 's/old-pattern/new-pattern/'` (pattern-based)

### Why Line-Number Sed Is Dangerous

When making multiple edits to the same file, line numbers shift after every insertion or deletion. Edit #1 inserts a line → every line number after it shifts by +1 → edit #2's line number is now wrong → you corrupt the file.

### Side-by-Side Comparison

**BAD — line-number sed (breaks on multi-edit):**
```bash
# Edit 1: Insert a line after line 5
sed -i '5a\new line here' file.ts
# Edit 2: Change line 10 — BUT line 10 is now line 11!
sed -i '10s/old/new/' file.ts  # ← WRONG LINE, CORRUPT FILE
```

**GOOD — pattern-based sed (immune to line shifts):**
```bash
# Edit 1: Insert after a specific pattern
sed -i '/pattern-on-line-5/a\new line here' file.ts
# Edit 2: Change by matching the actual content
sed -i 's/old-text-to-change/new-text/' file.ts  # ← Always hits the right line
```

### The Rule

When making ANY edit:
1. Use `grep -n 'pattern'` to FIND the line and confirm context
2. Use the PATTERN (not the line number) in the sed command
3. If the pattern isn't unique, add surrounding context: `sed -i '/context-line/{n;s/old/new/}'`

### Multi-Edit Rule

When making multiple edits to the same file, ALWAYS use pattern-based sed. The order of edits doesn't matter when you match by content, because patterns don't shift.

## #2 — Verify After Every Edit

After each sed/write operation:
- `grep -n 'expected-content' file` to confirm the edit landed
- If it didn't land, diagnose before proceeding (don't stack broken edits)

## #3 — Read Before Overwrite

Before writing a file, read it first. Understand the current content. Writing blindly can destroy work that another agent or a previous edit added. This is especially critical for knowledge files, configs, and shared documents.

## #4 — Test After Every Code Change

After modifying source code:
- Run `npx tsc --noEmit` to check types
- Run relevant tests: `npx vitest --run test/<file>.test.ts`
- Don't batch multiple untested changes — one change, one verify cycle

## #5 — Use the Codebase Reference

Your knowledge file `agents/coder/knowledge/library/codebase.md` has the file map, key types, and API surface. Read it before diving into unfamiliar code. Don't guess at type signatures or file locations.
