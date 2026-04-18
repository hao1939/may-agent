# Audit: src/lib/tools/ Dead Code & Unused Exports

**Date**: 2026-04-13  
**Lens**: C (Dead Weight)  
**Scope**: `src/lib/tools/` — 24 files, ~6,665 lines  
**Trigger**: Lens C rotation, tools directory not audited since Apr 10 dead code sprint

## Summary

The tools directory is mostly healthy — 20/24 files have active consumers. Found **1 dead code chain** (2 files, ~200 lines) and **4 convenience singletons** that are never used. Also documented unused-but-wired tool presets.

## Finding 1: Dead Chain — security.ts + skill-linter.ts ⚠️

**Files**: `src/lib/tools/security.ts` (140 lines) + `src/lib/tools/skill-linter.ts` (82 lines)  
**Total**: ~222 lines  
**Status**: DEAD — no external consumers, not in barrel index

`security.ts` exports 5 functions:
- `checkSkillSafety()` — scans skill code for dangerous patterns
- `getCodeThreats()` — diagnostic version of above
- `normalizeForP53()` — path obfuscation stripping for bash restriction bypass prevention
- `checkDescriptionSafety()` — re-export from skill-linter.ts
- `getDescriptionThreats()` — re-export from skill-linter.ts

`skill-linter.ts` exports 2 functions:
- `checkDescriptionSafety()` — prompt injection detection in skill descriptions
- `getDescriptionThreats()` — diagnostic version of above

**Evidence of deadness**:
- NOT in `src/lib/tools/index.ts` barrel
- NOT imported by any file outside tools/
- NOT imported by any file INSIDE tools/ either
- skill-linter.ts only consumed by security.ts (which is dead)
- Functions are defined and exported but literally never called
- Tests exist (`test/tools/security-gap-fix.test.ts`, `test/tools/skill-linter.test.ts`) testing dead code

**Context**: These were "Restored after accidental deletion in commit 7f7e3cd" per the file comment. They were restored but never wired back into the call chain. The skill/growth system that would have used them is also not actively used (agent-growth preset has 0 agents).

**Recommendation**: Delete both files and their tests. If skill safety scanning is needed later, it can be re-implemented when agent-growth is actually deployed.

## Finding 2: Dead Tool — health.ts (createHealthCheckTool) ⚠️

**File**: `src/lib/tools/health.ts` (77 lines)  
**Status**: DEAD — in barrel index but never instantiated

`createHealthCheckTool()` creates an AgentTool that checks file existence and stale sessions. It's:
- Exported from `src/lib/tools/index.ts` (barrel)
- Exported from `src/lib/index.ts` (package API)
- NOT used by any agent (no "health" tool preset in agent-loader.ts)
- NOT used by web.ts (which has its own `handleSystemHealth()` that queries the DB directly)

**Recommendation**: Delete. The web UI health endpoint serves this purpose better. If an agent needs health data, `system-status` tool preset already exists and is used by 2 agents.

## Finding 3: Dead Convenience Singletons (3 × ~1 line each)

These are module-level `export const` shortcuts that create a tool with `process.cwd()`:
- `src/lib/tools/bash.ts:364` → `export const bashTool = createBashTool(process.cwd());`
- `src/lib/tools/read.ts:147` → `export const readTool = createReadTool(process.cwd());`
- `src/lib/tools/write.ts:215` → `export const writeTool = createWriteTool(process.cwd());`

None are imported anywhere. Agent-loader calls `createBashTool()` etc. directly with the correct directory.

**Recommendation**: Delete (3 lines total, trivial cleanup).

## Finding 4: Dead Exports from lib/index.ts

These functions are exported from the package API but never imported:
- `listLabAgents()` from `growth.ts` — 0 callers
- `readLatestCheckpoint()` from `checkpoint.ts` — 0 callers (only `readLatestCheckpointForAgent` is used by manager.ts)
- `createHealthCheckTool()` from `health.ts` — 0 callers (covered in Finding 2)

**Recommendation**: Remove from lib/index.ts exports. The functions can stay in their source files for now (they'll be found if needed).

## Finding 5: Unused Tool Presets (informational, NOT dead code)

These tool presets are wired in agent-loader.ts but no agent.json uses them:
- `read-only`: 0 agents
- `message-only`: 0 agents
- `background-exec`: 0 agents
- `agent-growth`: 0 agents

**Not dead code** — they're latent capabilities ready for any agent to opt into. No cleanup needed.

## Things Verified as Alive

These initially looked suspicious but are legitimately used:
- `abort-utils.ts` — used internally by edit.ts, write.ts
- `edit-diff.ts` — used internally by edit.ts  
- `path-utils.ts` — used internally by edit.ts, write.ts, read.ts
- `cross-edit-guard.ts` — used inside bash.ts, edit.ts, write.ts (not as standalone guard)
- `request-status.ts` — dynamic import from may.ts (`await import(...)`)
- All guard files (commit-guard, completeness-guard, etc.) — imported by manager.ts or compose-guards.ts

## Cleanup Impact

| Item | Lines | Risk |
|------|-------|------|
| security.ts + skill-linter.ts | ~222 | Low — never called |
| health.ts | ~77 | Low — superseded by system-status |
| 3 convenience singletons | ~3 | Zero — unused exports |
| lib/index.ts dead exports | ~3 | Zero — just export lines |
| **Total removable** | **~305** | |

Plus ~200 lines of test code for dead modules.
