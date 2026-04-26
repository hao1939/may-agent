# Fix Summary: Database Connection Timeout

## Root Cause

The database was migrated from port 5432 to port 5433 on 2026-03-15 (documented in both the README and the `.env` file). However, the hardcoded fallback in `src/config.js` still used port 5432:

```js
port: parseInt(process.env.DB_PORT) || 5432
```

When the environment variable failed to load (e.g., missing `dotenv` dependency, wrong working directory, or any other reason `process.env.DB_PORT` was undefined), the `|| 5432` fallback kicked in, causing the app to connect to the old port. The error logs confirm this: all "Connection refused" errors reference port 5432, not the correct 5433.

## Files with Conflicting Information

| File | Port Referenced | Notes |
|------|----------------|-------|
| `.env` | 5433 | ✅ Correct (updated by ops team 2026-03-15) |
| `.env.example` | 5432 | ❌ Stale — still references old dev port |
| `README.md` | 5432 in setup instructions, 5433 in DB section | ⚠️ Contradictory within the same file |
| `src/config.js` | 5432 (hardcoded fallback) | ❌ Bug — fallback points to old port |
| `logs/app.log` | 5432 (in error messages) | Confirms the fallback was being used |

## What Was Changed

**`src/config.js`**: Changed the fallback port from `5432` to `5433` to match the migrated database:

```js
// Before:
port: parseInt(process.env.DB_PORT) || 5432

// After:
port: parseInt(process.env.DB_PORT) || 5433
```

## Prevention

1. **Keep fallback values in sync with infrastructure changes.** When the DB was migrated, the `.env` was updated but the hardcoded fallback in code was not.
2. **Fail loudly instead of falling back silently.** A better pattern would throw an error if `DB_PORT` is missing rather than silently using a default: `port: parseInt(process.env.DB_PORT) || (() => { throw new Error('DB_PORT not set') })()`
3. **Update `.env.example` alongside `.env`** so new deployments don't start with stale defaults.
4. **Use a config validation step at startup** that logs the resolved configuration, making port mismatches immediately visible.
