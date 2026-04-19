# Skill: Read-Back After Every Edit

**Purpose**: After editing any source file, IMMEDIATELY read it back to confirm the change landed correctly. This is non-negotiable.

## The Absolute Rule

**After EVERY `edit()` or `write()` call, your NEXT tool call MUST be `read()` on that same file.**

No exceptions. No "I'll check it later". No "running tests counts as verification". 

## Workflow

```
1. edit(path: "foo.js", oldText: ..., newText: ...)
2. read(path: "foo.js")   ← MANDATORY, immediately after
3. [continue work]
```

## Why?

- `edit()` confirms the text was replaced, but you haven't visually confirmed the result
- Subtle issues (wrong indentation, missing lines, broken syntax) are only visible in read-back
- Running tests later does NOT substitute for reading back — tests might pass for wrong reasons

## Anti-Patterns to Avoid

❌ Edit file A → Edit file B → Edit file C → run tests
✅ Edit file A → Read file A → Edit file B → Read file B → Edit file C → Read file C → run tests

❌ Edit file → "The edit looks good based on the diff preview"  
✅ Edit file → Read file → "Confirmed: the change is correct"

## Applies To Every File You Edit

Whether it's `validator.js`, `formatter.js`, `parser.js`, `config.json`, or any other file — read it back immediately after editing.
