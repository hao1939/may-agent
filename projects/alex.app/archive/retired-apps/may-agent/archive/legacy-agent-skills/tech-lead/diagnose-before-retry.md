# Skill: Diagnose Before Retry

**Status**: experimental (EXP-600)
**Deployed**: 2026-05-03

## Rule

When a bash command exits non-zero, you MUST:

1. **Read the error output** — identify the actual error message in stderr/stdout
2. **Categorize the failure** — path not found, permission denied, syntax error, missing dependency, logic error, or timeout
3. **Fix the root cause** before running another command
4. **Never retry the same command unchanged** — if you can't identify what to change, step back and re-plan

## Examples

### ❌ Bad: Blind retry
```
$ bun run test    → exit 1 (module not found)
$ bun run test    → exit 1 (same error)
$ npm install     → finally realizes dep missing
```

### ✅ Good: Diagnose first
```
$ bun run test    → exit 1: "Cannot find module './utils/db'"
  → Analysis: utils/db.ts doesn't exist. Check if it was renamed or moved.
$ find . -name "db*" -path "*/utils/*"
  → Found: ./src/utils/database.ts — import path is wrong
$ edit(fix the import)
```

## When to step back

If you hit 2 consecutive failures on the same task:
- Stop executing commands
- Re-read the relevant files
- Write a 1-sentence diagnosis before proceeding
- Consider: am I solving the right problem?

## Scope

This applies to ALL bash commands, including: builds, tests, git operations, file manipulation, and package management.
