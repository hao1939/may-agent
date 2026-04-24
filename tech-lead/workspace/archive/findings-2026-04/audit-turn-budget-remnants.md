# Audit: maxTurns / Turn Budget Remnants After Removal (8df485ec)

**Date**: 2026-04-15  
**Scope**: Trace `maxTurns` field end-to-end across 7 source files after turn-budget enforcement was removed in commit 8df485ec (-523 lines)  
**Verdict**: All references are dead weight except `turnCount` (which is live and serves auto-resume, digests, and shallow-heartbeat detection). The `maxTurns` field is carried through the entire lifecycle but **never checked or enforced anywhere**.

---

## Summary

The turn budget *enforcement* (soft limit → steer → hard limit → abort) was fully removed. But the `maxTurns` **field** survived in 7 files. It flows through the system as a ghost: set on session creation, persisted to disk, restored on crash recovery, passed through the event bus — but never read for any decision.

## End-to-End Flow (all dead)

### 1. Type Definitions (dead type fields)

| File | Line | Reference | Status |
|------|------|-----------|--------|
| `src/lib/manager-utils.ts` | L229 | `ActiveSession.maxTurns: number` | **Dead** — field is always 0 (unlimited), never read for enforcement |
| `src/lib/manager-utils.ts` | L267 | `RunOptions.maxTurns?: number` | **Dead** — no caller passes a non-zero value |
| `src/lib/persistence.ts` | L60 | `PersistedSession.maxTurns?: number` | **Dead** — persisted for crash recovery of a feature that no longer exists |
| `src/lib/types.ts` | L71 | `turnBudget?: number \| Record<string, number>` | **Dead** — already marked `@deprecated`, never read |
| `src/app/event-bus.ts` | L22 | `opts?.maxTurns?: number` in fork event | **Dead** — passthrough field, no consumer checks it |

### 2. Session Creation (dead writes)

| File | Line | Code | Status |
|------|------|------|--------|
| `src/lib/manager.ts` | L986 | `maxTurns: opts?.maxTurns ?? 0` | **Dead write** — always 0 since no caller passes maxTurns |
| `src/app/may.ts` | L818 | `maxTurns: event.opts?.maxTurns` | **Dead write** — passes event bus value to RunOptions, but no event bus emitter sets it |

### 3. Persistence (dead read/write cycle)

| File | Line | Code | Status |
|------|------|------|--------|
| `src/lib/manager.ts` | L1021 | `maxTurns: session.maxTurns \|\| undefined` (save to meta.json) | **Dead write** — persists 0 or undefined |
| `src/lib/manager.ts` | L1421 | `maxTurns: persisted.maxTurns ?? RESTORED_MAX_TURNS_FALLBACK` (restore) | **Dead read** — restores from persisted value, but value is always 0/undefined |

### 4. RESTORED_MAX_TURNS_FALLBACK

| File | Line | Code | Status |
|------|------|------|--------|
| `src/lib/manager-utils.ts` | L158 | `export const RESTORED_MAX_TURNS_FALLBACK = 0` | **Dead constant** — already marked `@deprecated`, value is 0 (unlimited), used only in restore path above |
| `src/lib/manager.ts` | L12 | `import { RESTORED_MAX_TURNS_FALLBACK }` | **Dead import** |

### 5. Handler-level reference

| File | Line | Code | Status |
|------|------|------|--------|
| `agents/may/handlers/run-agent-task.ts` | L178 | `maxTurns?: number` in handlerConfig | **Ambiguous** — config can specify maxTurns, but L208 maps it to `opBudget`, not `maxTurns`. See below. |
| `agents/may/handlers/run-agent-task.ts` | L208 | `...(maxTurns ? { opBudget: maxTurns } : {})` | **Active-ish** — this maps handlerConfig.maxTurns to opBudget, which IS still enforced in manager-receipts.ts. However, no current cron.json entry sets handlerConfig.maxTurns. |

### 6. Test reference

| File | Line | Status |
|------|------|--------|
| `test/cron.test.ts` | L374-406 | Tests `handlerConfig.maxTurns` change detection in cron reload. **Still valid** — tests that cron detects config changes, regardless of whether maxTurns is used. |

## What IS Still Live: `turnCount`

`turnCount` (distinct from `maxTurns`) is actively used:

| Location | Purpose |
|----------|---------|
| `manager.ts:286` | Incremented on each assistant message |
| `manager.ts:788` | Reset to 0 for chat sessions on idle |
| `manager.ts:812-813` | Shallow heartbeat detection (`turnCount` in digest details) |
| `manager.ts:689,769` | Timeout/error digest details |
| `manager.ts:861` | Session info for status API |
| `manager.ts:1695` | Auto-resume heuristic (`turns > 0` = did real work) |
| `manager.ts:1714` | `turnsUsed` in TaskResult |
| `manager.ts:1966,1981` | Completion logging |

`turnCount` is healthy and earning its keep. Do not remove.

## Severity Assessment

| Category | Count | Severity |
|----------|-------|----------|
| Dead type fields | 5 | LOW — type noise, no runtime cost |
| Dead writes (set but never read) | 4 | LOW — trivial CPU, adds confusion |
| Dead constant + import | 2 | LOW — already `@deprecated` |
| Dead event bus passthrough | 1 | LOW — unused plumbing |
| Ambiguous handler mapping | 1 | LOW — works but naming is confusing (maxTurns → opBudget) |

**Overall**: P3 cleanup. No functional bugs, no performance impact, just dead code weight (~30 lines across 7 files).

## Recommended Action

**Single cleanup task**: Remove `maxTurns` from `ActiveSession`, `RunOptions`, `PersistedSession`, event-bus fork opts, and all related writes/reads in manager.ts. Keep `RESTORED_MAX_TURNS_FALLBACK` deletion. Keep `turnCount` (it's live). Keep `run-agent-task.ts` mapping (it maps to opBudget which works). Rename the run-agent-task field from `maxTurns` to `opBudget` for clarity.

**Do NOT fix now** — this is a separate cleanup session.
