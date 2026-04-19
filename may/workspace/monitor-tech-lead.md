# Tech-Lead Health Monitor

**Created**: 2026-04-05
**Trigger**: Hao directive — tech-lead at 33% success rate (6/9 sessions hit turn limits)
**Action taken**: Removed TURN BUDGET from heartbeat. Monitor for 24h.

## Baseline (pre-fix)
- 3/9 sessions completed successfully (33%)
- 6/9 hit turn limits
- All turn-limit hits were "Turn limit reached: 41/40 turns"

## Check schedule
- Check at: 2026-04-06 ~05:00 UTC (24h after turn budget removal)
- Target: >60% success rate
- If still below 60%: investigate what tech-lead is spending turns on

## How to check
```
node -e "const db = require('better-sqlite3')('/app/.state/may.db'); console.table(db.prepare(\"SELECT status, COUNT(*) as cnt FROM sessions WHERE agent='tech-lead' AND startedAt > datetime('now', '-24 hours') GROUP BY status\").all())"
```
