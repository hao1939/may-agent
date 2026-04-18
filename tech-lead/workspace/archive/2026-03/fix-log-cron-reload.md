# Fix: Cron Config Reload + Turn Budget

**Date**: 2026-03-17T23:38
**Status**: Fixed, pending process restart

## Fix 1: Cron Reload (CRITICAL — req:dfd10fcd)

### Root Cause
`fs.watchFile()` with 30s polling interval was not reliably detecting file changes in the Bun/container environment. The callback never fired after `cron.json` was modified at 22:50, causing 5 agents (optimizer, may, bob, coach, tech-lead) to continue running at their old intervals (540-780s) instead of the configured 1800s.

### Evidence
- Config file shows 1800000ms for all heartbeats
- Actual firing intervals: optimizer=540s, may=600s, bob=660s, coach=720s, tech-lead=780s
- Agents that were ALREADY at 1800s (amy, scout, amy-kimi, qa) were unaffected
- No "Config file changed" messages in logs = watchFile never triggered

### Fix Applied
Added a fallback explicit `statSync` poll every 15s alongside the existing `watchFile`. This ensures changes are detected even if `watchFile` fails to fire. File: `src/app/cron.ts` lines 75-120.

### Requires Process Restart
The fix only takes effect after the may.ts process restarts. The current process (PID 7) still has old intervals cached.

## Fix 2: Turn Budget Warning (HIGH — req:44da3d3b)

### Change
`TURN_BUDGET_WARNING_DEFAULT`: 35 → 55

### Rationale
77% of sessions were being interrupted before agents could call `finish()`. The warning at 35 turns was too aggressive — agents routinely need 40-60 turns for heartbeat work.

### File
`src/lib/manager-utils.ts` line 163
