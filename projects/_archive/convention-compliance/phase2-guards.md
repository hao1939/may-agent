# Convention Compliance — Phase 2 Runtime Guards

**Date**: 2026-05-26
**Iteration**: 1 (of Phase 2)
**Status**: Complete — guards built and tested

## Deliverables

### 1. Edit Guard (`agents/src/lib/edit-guard.ts`)
- **Convention**: C1.1 (Edit without prior read)
- **Mechanism**: Session-scoped `EditGuard` class tracks `read()` calls. Before any `edit()`, call `validateEdit(path)` — rejects if file not read or read is stale (>10min).
- **API**: `trackRead(path)`, `validateEdit(path)`, `enforceReadBeforeEdit(path)` (throws)
- **Expected impact**: 100% elimination of C1.1 violations (per finish-guard precedent)

### 2. Path Guard (`agents/src/lib/path-guard.ts`)
- **Convention**: C7.1 (Hallucinated /home/ paths)
- **Mechanism**: Validates bash commands for `/home/` path references. Allowlists grep/echo/sed that legitimately mention `/home/`.
- **API**: `validateBashCommand(cmd)`, `enforceNoHallucinatedPaths(cmd)` (throws)
- **Expected impact**: 100% elimination of C7.1 violations

### 3. Tests (`agents/src/lib/guards.test.ts`)
- 15 tests, all passing
- Covers: reject unread, allow after read, stale detection, normalization, path rejection, allowlist, dedup

## Integration Plan

Both guards follow the same pattern as `finish-guard.ts`:
1. Import in manager.ts tool handlers
2. Edit guard: `trackRead()` on read(), `enforceReadBeforeEdit()` on edit()
3. Path guard: `enforceNoHallucinatedPaths()` on bash()

## Next Steps

- Wire guards into manager.ts tool dispatch
- Run gym trials comparing baseline (no guards) vs treatment (guards enabled)
- Measure C1.3 (write without verify) — may need a similar write-guard
- Amy-specific: test if path-guard alone fixes her 39% C7.1 rate
