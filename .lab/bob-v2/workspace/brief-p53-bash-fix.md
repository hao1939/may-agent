# Brief: Enforce P53 (Identity Protection) in Bash Tool

## Context
P53 (Identity Protection) states that agents cannot modify their own constraints (`SOUL.md`, `DOMAIN.md`, `TOOLS.md`). The `edit` and `write` tools enforce this, but `bash` is currently an open backdoor.

## Evidence
`grep "checkProtectedPath" src/lib/tools/bash.ts` returns nothing. The tool executes commands blindly.

## Requirement
Modify `src/lib/tools/bash.ts` to block commands that attempt to write to protected files.

### 1. Define Protected Patterns
Any command string containing:
- A write indicator: `>` OR `sed -i` OR `mv ` OR `cp `
- AND a protected file substring: `SOUL.md` OR `DOMAIN.md` OR `TOOLS.md` OR `LESSONS.md`

### 2. Implementation
Inside `execute` (before `ops.exec`):
```typescript
const protectedFiles = ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md"];
const writeIndicators = [">", "sed -i", "mv ", "cp "];

// Simple heuristic to prevent accidental P53 violations
// We don't need a full parser, just a safety catch for LLM-generated commands
const looksLikeWrite = writeIndicators.some(op => command.includes(op));
const targetsProtected = protectedFiles.some(file => command.includes(file));

if (looksLikeWrite && targetsProtected) {
  throw new Error(`P53 Violation: modifying ${protectedFiles.join("/")} via bash is forbidden.`);
}
```

## Action
Apply this patch to `src/lib/tools/bash.ts`.
