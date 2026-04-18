# Unified Guard Architecture — Implementation Plan

**Requests**: req:3ffd43f3, req:698b033e (duplicate)
**Design**: agents/bob/workspace/sent/design-unified-guards.md
**Status**: Phase 1 ✅ COMPLETE (2026-03-26)

## Assessment

Current guard system is **already functional** with 7 guards in `src/lib/tools/`:
- `compose-guards.ts` — composition engine
- `empty-args-guard.ts` — blocks empty bash args
- `path-assumption-guard.ts` — blocks `/Users/`, `/home/` paths (= Bob's "EnvironmentGuard")
- `finish-guard.ts` — 3 gates: ghost deliverable, write evidence, verification after write (= Bob's "VerificationGuard")
- `read-dedup-guard.ts` — dedup reads
- `session-read-guard.ts` — blocks session.jsonl reads
- `scrape-dedup-guard.ts` — dedup scrapes
- `cross-edit-guard.ts` — protects evaluator/coach skill files (not wired into compose)

Bob's design wants: directory move, Guard interface with onInput/onOutput, new VerificationGuard + EnvironmentGuard.

**Reality check**: `finish-guard.ts` already IS the VerificationGuard. `path-assumption-guard.ts` already IS the EnvironmentGuard. The value-add is:
1. Clean interface/registry pattern
2. `onOutput` hooks (post-execution)
3. The `read-safety` guard (block unpaginated reads >50KB)

## Plan — Incremental, Not Big-Bang

### Phase 1: Create Guard interface + registry (this session)

1. Create `src/lib/guards/index.ts` with:
   - `Guard` interface: `{ name: string; beforeToolCall?: BeforeToolCallHook; afterToolResult?: AfterToolResultHook }`
   - `createGuardRegistry()`: register guards, compose them
   - Re-export existing guards adapted as `Guard` objects

2. Create `src/lib/guards/registry.ts`:
   - Import all existing guard creators
   - Export a `defaultGuards()` function that returns the standard guard set

3. Update `src/lib/manager.ts`:
   - Import from guards registry instead of individual guard files
   - Wire both beforeToolCall and afterToolResult

### Phase 2: Add new guards (future session)

4. `src/lib/guards/read-safety-guard.ts` — block reads >50KB without pagination (FM-2.1)
5. Move existing guard files from `src/lib/tools/` to `src/lib/guards/` (one-by-one, keeping old paths as re-exports for backward compat)

## Decision: Phase 1 only this session
Phase 2 is a separate task. Keeps changes small and reviewable.
