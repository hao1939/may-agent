# Skill: Verify After Edit

**Purpose**: After every file write or edit, verify the change actually took effect. Files can have subtle issues (bad JSON, encoding problems, silent write failures) that only surface when you read the result back.

## The Rule

**Every `write()` or `edit()` to a data/config file MUST be followed by a verification step before moving on.**

## How to Verify

### For JSON files (config.json, package.json, tsconfig.json, etc.):
1. **Read it back**: `read("config.json")` — visually confirm the content
2. **Validate it**: `bash({ command: "node -e \"JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('VALID JSON')\"" })` — confirms parseable

### For code files (.ts, .js, .py):
1. **Read it back**: `read("src/parser.ts")` — confirm the edit landed
2. **Type-check or lint**: `bash({ command: "bun run typecheck" })` — confirms no syntax errors

### For any file:
1. **Read-back minimum**: Always `read()` the file after writing
2. **Structural check**: If there's a validation command (tests, linters, parsers), run it

## Examples

### ❌ BAD: Write and move on
```
edit({ path: "config.json", oldText: ..., newText: ... })
→ "Edit successful. Moving on to the next task."
```
This is dangerous — the edit might have introduced a syntax error, lost fields, or silently failed.

### ✅ GOOD: Write, read back, validate
```
edit({ path: "config.json", oldText: ..., newText: ... })
→ Edit applied.

read({ path: "config.json" })
→ { "name": "my-app", "timeout": 5000, "retries": 3, "debug": false }
→ Content looks correct.

bash({ command: "node -e \"JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('VALID JSON')\"" })
→ "VALID JSON"
→ Confirmed: file is valid JSON with correct values.
```

### ✅ GOOD: Write code, read back, type-check
```
edit({ path: "src/handler.ts", oldText: ..., newText: ... })
→ Edit applied.

read({ path: "src/handler.ts", offset: 10, limit: 15 })
→ [verify the changed lines are correct]

bash({ command: "bun run typecheck" })
→ No errors. Confirmed: edit is type-safe.
```

## Why This Matters

- **Silent failures**: `edit()` can fail if oldText doesn't match exactly — but you might not notice if you don't read back
- **Trailing commas/syntax**: JSON files are especially fragile — one extra comma makes the whole file invalid
- **Field preservation**: When editing config files, you might accidentally drop fields. Reading back catches this immediately
- **FM-3.3 prevention**: The #1 production failure mode is claiming a fix worked without structural evidence. Read-back + validation IS that evidence.

## When to Skip

- Do not skip read-back after `write()` or `edit()` if you plan to call `finish(success)`.
- Running tests does NOT count as verification for C1.3. Tests verify behavior, not that the file was written correctly. You still need to `read()` the file.
- Never skip for config/data files that other systems will parse


## ⚠️ Task-Type Restriction

Do NOT use this skill's worked examples as templates on **discovery, exploration, or creative-inference tasks** (e.g., knowledge integration, open-ended research, novel pattern discovery). KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open exploration these tasks require. Use this skill only for the specific task type it was designed for.
