# Master-Worker Deprecation Notices

**Date:** 2025-01-27

## Changes Made

Added `@deprecated` JSDoc comments to all 4 legacy master-worker files, pointing users to `master-worker-unified.ts`:

1. `/app/agents/shared/workflows/master-worker.ts`
2. `/app/agents/shared/workflows/master-worker-resilient.ts`
3. `/app/agents/shared/workflows/master-worker-cached.ts`
4. `/app/agents/shared/workflows/master-worker-with-health-check.ts`

## Verification

- All 86 test files pass (1487 tests, 0 failures)
- No runtime behavior changed — only JSDoc comments added
- IDEs will now show deprecation warnings when importing from legacy files

## Consolidation Status

| Step | Status |
|------|--------|
| RFC written | ✅ |
| Unified module created | ✅ |
| Tests for unified module | ✅ |
| Migration adapter | ✅ |
| Deprecation notices | ✅ |
| Full caller migration | Pending |
