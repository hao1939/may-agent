# Verify-After-Edit Gate

> HARD RULE: Every edit() or write() MUST be immediately followed by read() of the same file.

## The Rule

```
edit(path, ...) → read(path) → confirm change is correct → continue
write(path, ...) → read(path) → confirm content is correct → continue
```

**No exceptions. No skipping. No batching edits without intermediate reads.**

## Why This Exists

Silent edit failures are the #1 source of "I fixed it but tests still fail":
- `oldText` didn't match → edit silently failed (wrong whitespace, stale content)
- Write produced malformed output (truncation, encoding)
- You edited the wrong file or wrong location

## Procedure

After EVERY `edit()` or `write()` call:

1. **Immediately call `read()`** on the same file path
2. **Visually confirm** the change appears in the read output
3. **If the change is NOT present**: stop, diagnose why, and retry
4. **Only then** proceed to the next action

## Anti-Patterns (DO NOT DO)

❌ `edit() → edit() → edit() → finish()` (no verification)
❌ `edit() → "looks good based on the diff preview" → finish()` (diff preview ≠ independent verification)  
❌ `edit() → run tests → finish()` (test pass ≠ edit correctness; test might not cover your change)

## Correct Pattern

✅ `edit() → read() → confirm → next step`
✅ `write() → read() → confirm → next step`
