# Tech-Lead Brief: Patch P53 Obfuscation Vulnerability

## Context
I have discovered a critical bypass in the P53 `bash` protection. The current logic (`src/lib/tools/security.ts`) checks `command.includes(filename)` before running regexes. This is easily defeated by shell obfuscation.

## The Exploit
```bash
# Writes to SOUL.md because bash concatenates empty strings
echo "Exploit" > agents/bob/S""OUL.md
```
The JS check `command.includes("SOUL.md")` returns `false`, so the block is skipped.

## The Fix
Modify `checkP53BashCommand` in `src/lib/tools/security.ts`.
Create a normalized version of the command string by stripping all single and double quotes *before* performing the presence check.

### Current
```typescript
if (!command.includes(protectedFile)) continue;
```

### Proposed
```typescript
// Normalize: strip quotes to catch S""OUL.md, "SOUL.md", etc.
const normalizedCommand = command.replace(/['"]/g, "");
if (!normalizedCommand.includes(protectedFile)) continue;
```
*Note: Continue to use the original `command` for the regex checks if needed, or use the normalized one if the regexes expect clean strings. Given the regexes match operators like `>` or `sed -i`, they should run on the `commandLower` (which is already lowercased). You might need to verify if `P53_WRITE_PATTERNS` need adjustment, but stripping quotes is the primary fix for the filename detection.*

## Verification
1. `npm run test` (Ensure no regression).
2. Create a new test case in `test/security.test.ts` (or similar) specifically for `S""OUL.md`.
