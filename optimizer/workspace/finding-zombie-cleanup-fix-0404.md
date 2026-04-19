# Finding: Zombie Cleanup Bug — DB Never Updated

**Date**: 2026-04-04  
**Status**: FIXED  
**Impact**: 10 zombie sessions stuck as "running" in DB (26-51 hours old)  
**Root cause**: `cleanupZombieSessions()` updated meta.json but not the DB

## Problem

The `cleanupZombieSessions()` method in `manager.ts` was designed to clean up sessions stuck in "running" state. However, it had two bugs:

### Bug 1: DB not updated
The method calls `registry.updateSessionStatus()` which writes to `meta.json` on disk. But DB writes only happen through `DbWriter` event bus subscriber (reacting to `session_end` events). Since `cleanupZombieSessions()` bypasses the event bus, the DB was never updated.

### Bug 2: Archived sessions not scanned
The method only scanned `listActiveSessionIds()` which looks at `.state/sessions/<id>/` directories. Sessions already archived to `.state/sessions/history/<id>/` were invisible. The 9/10 zombie sessions were in history — their meta.json said "interrupted" but the DB still said "running".

## Fix (in `/app/src/lib/manager.ts`)

Two-phase approach:
1. **Phase 1** (existing logic + DB fix): Scan active session dirs, update meta.json AND call `updateSessionDb()` directly
2. **Phase 2** (new): Query DB for "running" sessions older than 30min that aren't in `this.activeSessions` or active dirs. Update them to "interrupted" in DB.

### Import added:
```ts
import { getDb, updateSessionDb } from "./requests.js";
```

### Test results:
- `test/manager-zombie-cleanup.test.ts`: 9/9 pass
- `test/manager-methods.test.ts`: 10/10 pass
- `test/manager-close-finish.test.ts`: 3/3 pass
- `tsc --noEmit`: clean (0 errors)

## Secondary Finding: ALL JS handlers stopped firing since supervisord migration

**Impact**: zombie-cleanup, evaluate-sessions, and ALL other JS handler crons have not fired since Apr 3 ~17:00. Heartbeat crons (LLM sessions) continue working fine.

**Timeline**:
- Apr 3 16:40: Last evaluate-sessions run
- Apr 3 16:57: Last heartbeat before gap  
- Apr 3 17:00-18:00: supervisord migration commits (12fe66d, d4a4cfb)
- Apr 4 04:45: Process restart — heartbeats resume
- Apr 4 04:45-08:10: ZERO JS handler sessions created

**Root cause hypothesis**: The supervisord migration changed the process lifecycle. The handler registration code runs at startup inside `if (CRON_ENABLED)` and iterates `agentCrons` from `loadAgents()`. The code path looks correct but no handler sessions appear. Possible causes:
1. Race condition between `loadAgents()` populating `agentCrons` and `loadAgentHandlers()` reading it
2. The bundled binary doesn't support dynamic TypeScript imports (`import(\`\${path}?t=\${Date.now()}\`)`)
3. Handler errors being swallowed silently

**Recommendation**: P0 — escalate to May/tech-lead. Without JS handlers, zombie-cleanup and evaluate-sessions won't run regardless of the code fix.

## Zombie Sessions (at time of fix)

| Session ID | Agent | Age | Location |
|------------|-------|-----|----------|
| s_1775105173843_0 | coder | 51h | history/ |
| s_1775192965499_0 | coder | 27h | history/ |
| s_1775192971184_0 | coder | 27h | history/ |
| s_1775193114524_0 | coder | 27h | history/ |
| s_1775193183905_0 | coder | 27h | history/ |
| s_1775193326012_0 | coder | 27h | history/ |
| s_1775193434052_0 | coder | 27h | history/ |
| s_1775193696981_0 | coder | 27h | history/ |
| s_1775213588524_21 | bob | 21h | history/ |
| s_1774796644661_0 | may | 48h | active/ |
