# Fix Summary: Database Connection Timeout

## Root Cause

The database was migrated to a new cluster on **port 5433** on 2026-03-15 (documented in `.env`), but `src/db.js` had port **5432 hardcoded** from a hotfix on 2026-02-10 that was never reverted. This meant the application always connected to port 5432 regardless of the `.env` configuration, resulting in "Connection refused" errors.

## Conflicting Files

| File | Port Value | Notes |
|------|-----------|-------|
| `.env` | 5433 | Updated by ops team on 2026-03-15 (correct) |
| `src/config.js` | reads `DB_PORT` env var | Would have used 5433 correctly |
| `src/db.js` | 5432 (hardcoded) | Old hotfix overrode config — **the bug** |
| `README.md` | 5432 | Stale documentation |
| `.env.example` | 5432 | Dev default, not directly relevant |

## What Changed

1. **`src/db.js`**: Removed the hardcoded `port: 5432` and replaced it with `DB_CONFIG.port` so the port flows from `.env` → `config.js` → `db.js` as intended.
2. **`README.md`**: Updated port references from 5432 to 5433 to match the current production configuration.

## Prevention

- **Never hardcode values that override configuration.** If a hotfix requires pinning a value, create a tracked issue (not just a TODO comment) to revert it.
- **Use a single source of truth** for connection parameters (the `.env` file via `config.js`). No other file should override those values.
- **Add a startup log** that prints the actual connection parameters being used, making mismatches immediately visible.
- **Health check monitoring** should alert on sustained failures, prompting investigation of config drift.
