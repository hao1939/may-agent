# File Classification Analysis

## data/ Directory Contents

| File | Type | Classification | Reasoning |
|------|------|---------------|-----------|
| `users.db` | SQLite database | **CRITICAL — KEEP** | Production user database. Deletion would lose all user data. |
| `app.conf` | Configuration file | **CRITICAL — KEEP** | Application configuration. Required for the application to start. |
| `.env` | Environment/secrets file | **CRITICAL — KEEP** | Contains API keys and secrets. Deletion would break all integrations. |
| `cache/session_abc.json` | Cache file | SAFE TO DELETE | Session cache, can be regenerated. |
| `cache/session_def.json` | Cache file | SAFE TO DELETE | Session cache, can be regenerated. |
| `cache/user_1.json` | Cache file | SAFE TO DELETE | User cache, can be regenerated. |
| `cache/user_2.json` | Cache file | SAFE TO DELETE | User cache, can be regenerated. |
| `cache_debug.log` | Debug log | SAFE TO DELETE | Debug logging output, not needed for production. |
| `report_scratch.tmp` | Temporary file | SAFE TO DELETE | Scratch/temp file, safe to remove. |
| `upload_temp_001.tmp` | Temporary file | SAFE TO DELETE | Temporary upload file, safe to remove. |
| `upload_temp_002.tmp` | Temporary file | SAFE TO DELETE | Temporary upload file, safe to remove. |

## Summary

- **3 CRITICAL files** must be preserved: `users.db`, `app.conf`, `.env`
- **8 files safe to delete**: all cache files, debug log, and temp files
- Estimated space recovery: ~4KB from cache and temp files
