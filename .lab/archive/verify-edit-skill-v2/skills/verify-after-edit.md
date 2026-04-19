# Skill: Verify After Edit

**Purpose**: After every file write or edit, verify the change with TWO steps: (1) read it back, and (2) run a structural validation command. Both steps are mandatory — skipping either one is a convention violation.

## The Two-Step Rule

**Every `write()` or `edit()` MUST be followed by BOTH:**
1. **Read-back**: `read()` the file to confirm content visually
2. **Structural validation**: Run a command that PROVES the file is valid (not just "looks right")

**⚠️ Read-back alone is NOT sufficient.** You can read a file that looks correct but has invisible issues (encoding, trailing commas, missing brackets). Only a parser/compiler can prove validity.

## Mandatory Validation Commands by File Type

### JSON files (config.json, package.json, tsconfig.json, etc.) — ALWAYS validate:
```
bash({ command: "node -e \"JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('VALID JSON')\"" })
```
If this prints "VALID JSON" → file is correct. If it throws → you broke something. Fix it.

### Code files (.ts, .js) — Type-check or syntax-check:
```
bash({ command: "npx tsc --noEmit" })
```
or at minimum:
```
bash({ command: "node -c src/file.js" })
```

### YAML files — Parse check:
```
bash({ command: "node -e \"require('js-yaml').load(require('fs').readFileSync('file.yml','utf8')); console.log('VALID YAML')\"" })
```

## Complete Workflow Examples

### ✅ CORRECT: Edit JSON, read back, validate
```
edit({ path: "config.json", oldText: '"timeout": 3000', newText: '"timeout": 5000' })
→ Edit applied.

read({ path: "config.json" })
→ { "name": "my-app", "timeout": 5000, "retries": 3, "debug": false }
→ Content looks correct.

bash({ command: "node -e \"JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('VALID JSON')\"" })
→ "VALID JSON"
→ Confirmed: file is structurally valid and values are correct.
```

### ❌ WRONG: Edit JSON, read back, skip validation
```
edit({ path: "config.json", oldText: '"timeout": 3000', newText: '"timeout": 5000' })
→ Edit applied.

read({ path: "config.json" })
→ { "name": "my-app", "timeout": 5000, "retries": 3, "debug": false }
→ "Looks good. Moving on."
```
**This is a convention violation.** The read-back may LOOK correct but the file could have a trailing comma, BOM character, or encoding issue that only `JSON.parse` would catch. You MUST run the validation command.

### ❌ WRONG: Edit and move on without any verification
```
edit({ path: "config.json", oldText: '"timeout": 3000', newText: '"timeout": 5000' })
→ Edit applied. Moving on to the next task.
```
**This is a serious convention violation.** You have zero evidence the edit succeeded.

### ✅ CORRECT: Write code, read back, type-check
```
edit({ path: "src/handler.ts", oldText: 'const x = 5', newText: 'const x = 10' })
→ Edit applied.

read({ path: "src/handler.ts", offset: 10, limit: 5 })
→ [verify the changed lines are correct]

bash({ command: "npx tsc --noEmit" })
→ No errors. Confirmed: edit is type-safe.
```

## Why Both Steps Are Required

1. **Read-back catches content errors**: Wrong values, lost fields, mangled text
2. **Validation catches structural errors**: Invalid JSON, broken syntax, type errors
3. **Together they provide complete evidence**: You can prove BOTH that the content is right AND the file is valid
4. **FM-3.3 prevention**: The #1 production failure is claiming success without structural proof. The validation command IS that proof.

## Quick Reference

| After editing... | Read back with | Validate with |
|-----------------|----------------|---------------|
| `.json` file | `read("file.json")` | `bash("node -e \"JSON.parse(...)\"")` |
| `.ts` file | `read("file.ts")` | `bash("npx tsc --noEmit")` |
| `.js` file | `read("file.js")` | `bash("node -c file.js")` |
| Any config | `read("config")` | Run the app's validator or parser |

## When to Skip

- Only if you just ran tests that PASS and those tests exercise the edited file
- Never skip for config/data files that other systems will parse
- When in doubt, validate — it takes 2 seconds and prevents silent failures
