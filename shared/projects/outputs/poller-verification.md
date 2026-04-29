# Poller Verification Report

**Date**: 2026-04-26  
**Baseline lessons.jsonl**: 20 lines (all seeded)  
**Poller state file**: Does NOT exist — poller has never run

## Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| `context-learn-poller.ts` | ✅ Exists | Handler file deployed |
| `cron.json` entry | ✅ Exists | 30min interval, enabled, offset 900000ms |
| `context-learn.ts` handler | ✅ Exists | Listens for `context-learn` events |
| `CONTEXT_LEARN_AGENTS` env | ✅ Set | `coder,may,bob,coach,optimizer,tech-lead` |
| State file | ❌ Missing | No `/app/agents/may/.state/context-learn-poller-processed.json` |

## Critical Bug Found: SKIP_AGENTS Conflict

The poller has a hardcoded skip list:
```typescript
const SKIP_AGENTS = new Set(["evaluator", "coach", "judge"]);
```

**But 18 of the 20 most recent sessions are from `coach`!** The poller will skip nearly all sessions.

Recent session breakdown (last 20):
- **coach**: 16 sessions
- **optimizer**: 1 session  
- **bob**: 2 sessions
- **evaluator**: 1 session (correctly skipped)

The `context-learn.ts` handler ALSO skips coach:
```typescript
if (["evaluator", "coach", "judge"].includes(agentName)) return;
```

So even if the poller dispatches events for the 3 non-coach sessions, the downstream handler would process them — but only if they're within the 2-hour window (`MAX_AGE_MS = 2 * 60 * 60 * 1000`).

## Why the Poller Hasn't Fired

The poller is registered in cron.json but the cron scheduler may not have reloaded since the entry was added. The absence of the state file (`context-learn-poller-processed.json`) confirms zero executions.

## Why Even If It Fires, Volume Will Be Low

1. **Coach sessions dominate** (~80% of traffic) but are skipped by both poller AND context-learn handler
2. **2-hour window** means sessions older than 2h are permanently missed
3. **Only bob/optimizer/coder/tech-lead** sessions qualify — these are infrequent

## Recommendations

### Immediate Fix (high impact)
Remove `"coach"` from SKIP_AGENTS in both files:
- `/app/agents/may/handlers/context-learn-poller.ts` line 16
- `/app/agents/may/handlers/context-learn.ts` line 19

Coach sessions contain the richest learning material (behavioral observations, pattern recognition, growth tracking). Skipping them defeats the purpose.

### Secondary Fix
Increase `MAX_AGE_MS` from 2 hours to 24 hours to catch sessions from less-frequent agents.

### Verification Plan
After fixes:
1. Restart/reload cron to pick up the poller
2. Wait for one 30-min cycle OR manually trigger
3. Check `wc -l lessons.jsonl` — should grow beyond 20

## Manual Test Attempt

Cannot invoke the poller manually — it requires a full `HandlerContext` with `dispatchEvent`, `readSessionMeta`, `readSessionMessages`, `manager`, `persistDir`, and `agentsRoot`. These are provided by the cron runtime and cannot be easily mocked from CLI.

## Conclusion

The poller infrastructure is correctly wired but **will produce near-zero organic lessons** because it skips coach sessions (the dominant session type). The fix is a 2-line change removing "coach" from skip lists in both handler files.
