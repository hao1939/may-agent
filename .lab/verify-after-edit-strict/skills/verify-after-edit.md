# Skill: Verify After Edit

**Purpose**: After every file write or edit, verify the change actually took effect. Files can have subtle issues (bad JSON, encoding problems, silent write failures) that only surface when you read the result back.

## The Rule

**Every `write()` or `edit()` MUST be followed by `read()` of the same file before doing anything else.**

This is non-negotiable. No exceptions.

## How to Verify

### For any file:
1. **Read it back**: `read("path/to/file.js")` — visually confirm the content landed correctly
2. **Then continue**: Only after confirming the read-back, proceed to the next edit or tests

## Workflow Pattern

```
read("src/validator.js")           ← understand file first (C1)
edit("src/validator.js", ...)      ← make change
read("src/validator.js")           ← VERIFY change landed (C2.3)

read("src/formatter.js")           ← understand next file
edit("src/formatter.js", ...)      ← make change  
read("src/formatter.js")           ← VERIFY change landed (C2.3)

bash("npm test")                   ← run tests last
```

## Examples

### ❌ BAD: Edit all files, then test
```
edit("src/a.js", ...)
edit("src/b.js", ...)
edit("src/c.js", ...)
bash("npm test")
```
Tests passing does NOT verify each individual file was edited correctly.

### ✅ GOOD: Edit file, read it back, repeat
```
edit("src/a.js", ...)
read("src/a.js")  ← confirm change
edit("src/b.js", ...)
read("src/b.js")  ← confirm change
edit("src/c.js", ...)
read("src/c.js")  ← confirm change
bash("npm test")  ← final validation
```

## Why Running Tests Is NOT Sufficient Verification

- Tests verify behavior, not the literal file content
- Tests can pass for wrong reasons (e.g., test doesn't exercise the changed code path)
- `edit()` can silently not match if oldText is slightly wrong — only reading back reveals this
- FM-3.3 prevention requires structural evidence (read-back), not just test results

## Always Read Back — No Exceptions

Even for trivial edits. Even for code files. Even when you're about to run tests. The read-back takes 1 second and prevents subtle failures.
