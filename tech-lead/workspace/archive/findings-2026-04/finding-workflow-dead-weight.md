# Dead Weight Audit: `agents/shared/workflows/`

**Date**: 2025-07-18  
**Lens**: Dead Weight  
**Scope**: 11 files, 2323 lines total in `agents/shared/workflows/`

## Summary

3 of 10 workflow files are candidates for removal (1 alias, 2 zero-usage). 1 helper file is correctly excluded from workflow loading. The directory is reasonably clean after the April 2026 archive purge but still has dead weight.

## Findings

### 🔴 P1: `persistent-task.ts` — Pure alias, should be deleted (3 lines)

This file is a 3-line re-export alias to `project.ts` (`persistent-task.ts:2-3`). The comment says "Keep during transition" but per REGISTRY.md it shows only ~5 sessions usage attributed to `persistent-task`. All substantive code lives in `project.ts:1-872`. The alias adds confusion — callers should reference `project.ts` directly.

**References found**: `agents/shared/workflows/project.ts`, `agents/src/lib/finish-guard.ts`, `agents/shared/guards/finish-guard.ts`, `agents/may/handlers/proof-of-life.ts`, `agents/may/handlers/session-sync.ts` — but these reference the *name* "persistent-task", not the file. After rename, only the workflow registry lookup needs updating.

**Action**: Delete `persistent-task.ts`, update any workflow name references to use `project`.

### 🟡 P2: `implement-and-review.ts` — Zero recent usage (163 lines)

Per `REGISTRY.md:14`: "48h Usage: 0 (but 143 all-time)". This workflow was superseded by `implement-and-verify.ts` which handles 85% of all workflow usage (`REGISTRY.md:13`). The only code reference is a self-reference within `implement-and-review.ts` and `agents/shared/guards/auto-test.ts`. 

**Action**: Candidate for archival. Verify no agent config selects it as default before removing.

### 🟡 P2: `verify-wrap.ts` — Zero usage, pending pilot (233 lines)

Per `REGISTRY.md:18`: "0 (new — pending production pilot)". Referenced by `agents/tech-lead/workflows/lens-analysis.ts` and `agents/qa/workflows/qa-heartbeat.ts`. If no pilot has occurred since creation, this is speculative code.

**Action**: Set a deadline — if no pilot usage within 2 weeks, archive.

### 🟢 P3: `heartbeat.ts` vs `agent-heartbeat.ts` — Potential overlap

Two heartbeat-related workflows exist: `heartbeat.ts` (172 lines) and `agent-heartbeat.ts` (263 lines). The `agent-heartbeat.ts` is a factory that all agent-specific heartbeats import (confirmed: 8 agent heartbeat files reference it). `heartbeat.ts` is described as a "lightweight heartbeat wrapper" (`REGISTRY.md:20`) marked "new". If `agent-heartbeat.ts` has fully replaced it, `heartbeat.ts` may be dead.

**Action**: Investigate whether any agent still uses `heartbeat.ts` directly vs `agent-heartbeat.ts`.

### ℹ️ Info: `fewshot-inject-helpers.ts` — Not a workflow (correctly noted)

Per `REGISTRY.md:22`: "NOT a workflow (no `execute()` function)". It's a utility file. No action needed but it could be relocated to `agents/shared/lib/` for clarity.

### ℹ️ Info: `freestyle-wrap.ts` — Low visibility

66 lines (`freestyle-wrap.ts:1-66`). Only referenced by `agent-heartbeat.ts`. Serves as a thin wrapper for ad-hoc sessions. Useful infrastructure, not dead weight.

## Removal candidates summary

| File | Lines | Severity | Action |
|------|-------|----------|--------|
| `persistent-task.ts` | 3 | P1 | Delete (pure alias) |
| `implement-and-review.ts` | 163 | P2 | Archive if confirmed unused |
| `verify-wrap.ts` | 233 | P2 | Deadline for pilot or archive |
| `heartbeat.ts` | 172 | P3 | Investigate overlap with agent-heartbeat.ts |

**Total removable**: ~571 lines (25% of directory)

## Follow-up

- [ ] Fix: Delete `persistent-task.ts` alias and update references
- [ ] Investigate: Check if `heartbeat.ts` has any direct callers vs `agent-heartbeat.ts`
- [ ] Decision: Set archival deadline for `verify-wrap.ts`
