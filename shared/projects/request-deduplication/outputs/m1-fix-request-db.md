# M1: Fix Request DB — Complete

## Problem
`agents.requests()` failed with `no such table: requests` because:
1. The `requests` table existed in `.state/requests.db` (separate DB, 0 rows)
2. But the `agents.requests()` tool queries `.state/may.db` which had no `requests` table

## Fix Applied
Created the `requests` table in `.state/may.db` with the same schema as `.state/requests.db`.

## Verification
```
agents.requests({filter: 'all'}) → { filter: "all", count: 0, requests: [] }
```
No more "no such table" error.

## Migration Script
See `ensure-requests-table.sh` in this directory for a reusable script.
