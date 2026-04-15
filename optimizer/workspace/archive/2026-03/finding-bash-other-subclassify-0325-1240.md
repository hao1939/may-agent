# Finding: bash:other Sub-Classification

**Date**: 2026-03-25T12:40
**Category**: Tool Quality / Cost Efficiency
**Severity**: Medium

## Problem
`bash:other` is 69% of all tool waste (148/216 calls in last 24h). It's a catch-all category in `classifyFailure()` (tool-quality-scan.ts) that lumps together very different failure types, making it hard to create targeted interventions.

## Analysis (last 20 sessions sampled)

From 27 failed bash calls classified as "other":
| Sub-Category | Count | % | Root Cause |
|-------------|-------|---|------------|
| CMD_NOT_FOUND (exit 127) | 15 | 56% | `sqlite3`, `bun`, `npx`, `file` not in PATH |
| FILE_NOT_FOUND (exit 1-2) | 7 | 26% | `ls`/`mv`/`cat` on nonexistent files |
| CD_BAD_PATH (exit 1) | 5 | 19% | `cd /home/user`, `cd /var/tmp/repos/may` |

### CMD_NOT_FOUND breakdown
- `npx` (QA uses heavily): ~10 calls — QA tries `npx vitest` but npx isn't available
- `bun` (bob, optimizer): ~3 calls — trying `bun -e` or `bun test`
- `sqlite3` (tech-lead, optimizer): ~2 calls — trying to query .state/may.db

### Agents
- QA: 70 bash:other (mostly npx not found) — **QA is the #1 offender**
- Optimizer: 36 (mix of cmd-not-found and cd-bad-path)
- Coach: 26 (grep/cd failures)
- Coder: 16 (cd /home/coder)

## Proposed Fix
Improve `classifyFailure()` in `agents/may/handlers/tool-quality-scan.ts` to sub-classify:

```typescript
// Add before the `return "other"` catch-all:
if (rootCause.includes("command not found") || result.includes("command not found")) return "cmd-not-found";
if (rootCause.includes("cd:") && rootCause.includes("No such")) return "cd-bad-path";
if (/cannot (stat|access|open)/.test(rootCause) || /cannot (stat|access|open)/.test(result)) return "file-not-found-bash";
```

This splits 148 "other" into ~4 actionable categories:
1. `bash:cmd-not-found` → Fix: add available commands to agent SOUL.md/common-sense
2. `bash:cd-bad-path` → Fix: already addressed by path-assumption-guard (in 786c884, needs restart)
3. `bash:file-not-found-bash` → Fix: encourage agents to check file existence before operating
4. `bash:other` (remaining) → Smaller bucket, now actionable

## Expected Impact
- Better visibility into what agents are actually doing wrong
- QA's `npx` issue alone is ~47% of bash:other (70/148) — targeted fix could halve waste
- Combined with path-assumption-guard activation, could reduce total waste from 4.8% to ~2.5%

## Status
Patch at: `workspace/patches/tool-quality-subclassify.patch.md`
