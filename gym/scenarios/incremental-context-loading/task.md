# Task: Fix the Cache TTL Bug

You're resuming work on the Analytics Dashboard Service. In your previous session,
you read the codebase and documented your findings in `workspace/context-cache.md`.

**Since your last session**, the `src/cache.js` file has been modified — a developer
refactored the eviction logic and introduced a TTL bug that causes cache entries to
expire too early, resulting in excessive cache misses and increased database load.

## Your Context Cache

Read `workspace/context-cache.md` first — it contains summaries of all files you read
in your previous session, along with their modification timestamps. Use this to decide
which files need re-reading and which you can skip.

**Hint**: Not all files have changed since your last session. Check file modification
times (`stat`) against your cached timestamps before re-reading large unchanged files.
Efficiency matters — don't waste ops re-reading files you already know the contents of.

## Requirements

1. **Check which files have changed** since your previous session using the context cache
2. **Read only the files that changed** (skip unchanged files with a brief note about why)
3. **Find and fix the TTL bug** in the changed file
4. **Run the test**: `node test/cache-test.js` to verify your fix
5. The test must pass (all 4 tests green)

## Files in the codebase
- `docs/architecture.md` (~7.5KB) — System architecture documentation
- `docs/api-reference.md` (~5.8KB) — API endpoint reference
- `src/server.js` (~10KB) — Express HTTP server
- `src/database.js` (~8.8KB) — PostgreSQL module
- `src/cache.js` (~5.5KB) — Cache manager (CHANGED since last session)
- `test/cache-test.js` — Test file for cache behavior
