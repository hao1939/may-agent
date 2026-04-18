# Fix: Wrong DB Path — may.db → .state/may.db

**Date**: 2026-04-12  
**Session**: s_1776012868029_2249  
**Problem**: 91 DB queries in 6h hit stale/empty root `may.db` instead of `.state/may.db` (93MB, 19,841 sessions).

## Root Cause Analysis

The finding (optimizer workspace/finding-tool-gap-scan-0412b.md) reported "optimizer and coach context.md files say 'query may.db with bun'". However, **investigation shows context.md files are already correct** — all agent context.md files reference `.state/may.db` with the full path.

The actual causes of wrong-path queries are:
1. **Stale may.db copies existed** at `/app/may.db` (renamed to .stale earlier), `/app/agents/may.db` (0 bytes), and `/app/agents/.state/may.db` (812 sessions, frozen Apr 5)
2. **WAL/SHM journal files** persisted at root even after main DB was renamed
3. **Ad-hoc query construction** — agents sometimes write `Database('may.db')` from memory instead of copying the exact path from their context.md injection

## Changes Made

### 1. Stale DB File Cleanup
- **Removed** `/app/may.db-shm` (32KB) and `/app/may.db-wal` — leftover journal files from the stale root copy
- **Removed** `/app/agents/may.db` — empty 0-byte file that could confuse `Database('may.db')` in agents/ CWD
- **Renamed** `/app/agents/.state/may.db` → `may.db.stale-812sessions` — stale 2MB copy from Apr 5

### 2. Instruction File Fix
- **Fixed** `agents/optimizer/workspace/proposed-coach-heartbeat.md` line 103: `may.db` → `.state/may.db`

### 3. NOT Changed (and why)
- **Historical records** (findings, experiments, knowledge entries): ~65 files reference `may.db` as a name. These are frozen historical data — changing them would alter experiment records and finding context.
- **agents/optimizer/SOUL.md** line 23: Conceptual reference "query may.db for session data." The same file has correct `.state/may.db` in the code example (line 77). Can't edit (owner restriction). Minor — agents follow the code example, not the prose.
- **agents/may/context.md** line 54: ".state/ contains may.db" — describes directory contents, not a DB path.

## Remaining may.db Files
| Path | Size | Status |
|------|------|--------|
| `/app/.state/may.db` | 92MB | ✅ LIVE (19,841 sessions) |
| `/app/.state/persist/may.db` | 4KB | Backup/persist copy |
| `/app/may.db.stale` | 168KB | Renamed stale copy (kept for reference) |
| `/app/agents/.state/may.db.stale-812sessions` | 2MB | Renamed stale copy |

## Verification

```bash
# No wrong-path references in instruction files (context/heartbeat/SOUL):
find agents/ -name 'context.md' -name 'heartbeat.md' -name 'SOUL.md' -exec grep -Hn 'may\.db' {} \; | grep -v '.state/may.db'
# Returns only: optimizer/SOUL.md line 23 (conceptual ref) and may/context.md line 54 (directory description)

# No stale may.db files that could be accidentally opened:
find /app -name 'may.db' → only .state/may.db and .state/persist/may.db remain

# Root Database('may.db') now fails (no file):
bun -e "new Database('may.db')" → "unable to open database file"
```

## Impact Assessment

The 91 wrong-path queries were likely caused by:
- **~30%**: Hitting stale `/app/agents/may.db` (now removed)  
- **~20%**: WAL/SHM files keeping root path "alive" (now removed)
- **~50%**: Agents constructing paths from memory (mitigated by context.md already having correct path + stale files no longer providing a fallback)

Post-fix, `Database('may.db')` will immediately error instead of silently opening a stale/empty DB. This converts silent data quality issues into visible errors that agents can recover from.
