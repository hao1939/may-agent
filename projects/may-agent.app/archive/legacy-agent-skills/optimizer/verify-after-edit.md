# Skill: Verify After Edit

**Purpose**: After every file write or edit, verify the change actually took effect. Files can have subtle issues (encoding problems, silent write failures, lost content) that only surface when you read the result back.

## The Rule

**Every `write()` or `edit()` MUST be followed by a verification step before moving on.**

## How to Verify

### For any file:
1. **Read-back minimum**: Always `read()` the file after writing — confirm the edit landed
2. **Structural check**: Use `grep` to confirm specific patterns exist in the result

### For JSON/config files:
1. **Read it back**: `read("config.json")` — visually confirm the content
2. **Validate it**: Parse it to confirm it's valid

### For markdown/text files:
1. **Read it back**: Confirm section headers, content, and structure are correct
2. **Grep for key content**: `grep "expected phrase" file.md` — binary proof

## Examples

### ❌ BAD: Write and move on
```
edit({ path: "workspace/todo.md", oldText: ..., newText: ... })
→ "Edit successful. Moving on to the next task."
```
This is dangerous — the edit might have failed silently or lost content.

### ✅ GOOD: Write, then verify structurally
```
edit({ path: "workspace/todo.md", oldText: ..., newText: ... })
→ Edit applied.

grep "expected content" workspace/todo.md
→ Match found. Confirmed: edit landed correctly.
```

## Why This Matters

- **Silent failures**: `edit()` can fail if oldText doesn't match exactly
- **Content loss**: When editing large files, you might accidentally drop sections
- **FM-3.3 prevention**: The #1 production failure mode is claiming work is done without structural evidence. Read-back + grep IS that evidence.
- **C1.3 compliance**: This convention is measured — skipping verification = failing C1.3.

## When to Skip

- Do not skip read-back after `write()` or `edit()` if you plan to call `finish(success)`.
- Running tests does NOT count as verification for C1.3. Tests verify behavior, not that the file was written correctly. You still need to `read()` the file.
- Never skip for files that are your primary deliverable


## ⚠️ Task-Type Restriction

Do NOT use this skill's worked examples as templates on **discovery, exploration, or creative-inference tasks** (e.g., knowledge integration, open-ended research, novel pattern discovery). KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open exploration these tasks require. Use this skill only for the specific task type it was designed for.
