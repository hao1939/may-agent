# Finding: Dead job-history.jsonl (2.9MB Legacy Artifact)

**Date:** 2026-03-17
**Severity:** LOW (no operational impact, but confusing)
**Status:** Identified — needs cleanup

## What

`.state/job-history.jsonl` is a 2.9MB file (11,897 lines) that hasn't been written to since 2026-03-17T14:56 UTC. It's a legacy artifact from before the cron system migrated to SQLite request tracking (`.state/may.db`).

## Evidence

1. File last modified: `Mar 17 14:56` (verified via `ls -la`)
2. Last entry timestamp: `2026-03-17T14:56:20.420Z` (session s_1773759308226_54)
3. 409 sessions created since then — none logged to this file
4. `.state/may.db` last modified: `22:15 UTC` (actively used)
5. `src/app/cron.ts` has NO code that writes to `job-history.jsonl`
6. All consumers already use SQLite:
   - `agents/may/handlers/daily-brief.ts` line 131: `collectCronHealth()` queries `may.db`
   - `src/lib/tools/system-status.ts` line 100+: uses `getDbLazy()` 
7. Comment on line 130 of daily-brief.ts is stale: says "from job-history.jsonl" but code uses DB

## Recommendation

1. Delete `.state/job-history.jsonl` (2.9MB reclaimed)
2. Fix stale comment in `agents/may/handlers/daily-brief.ts` line 130:
   - Old: `// 8. Cron job health from job-history.jsonl`
   - New: `// 8. Cron job health from request tracking DB`

## Impact

- No operational impact (the file isn't used)
- Removes source of confusion (I spent 15 minutes investigating why "job history logging stopped")
- 2.9MB disk space reclaimed
