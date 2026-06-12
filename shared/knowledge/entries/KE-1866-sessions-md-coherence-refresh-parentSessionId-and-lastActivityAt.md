<ai_context>
sessions.md design doc had two drifted claims: (1) parentSessionId was documented as populated by "job or chat" kind but current retention window shows only job kind (10 rows, 0 chat); (2) lastActivityAt status said "8 agents" and "1102/1103" but current data shows 7 active agents and 1319/1321 (99.8%). Both fixed in-place.
Triggers: sessions.md, parentSessionId, lastActivityAt, coherence audit, design doc drift
</ai_context>

# KE-1866: sessions.md Coherence Refresh — parentSessionId and lastActivityAt

**Status**: resolved
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1865 (cron.md drift), KE-1785 (events.md drift)

## Claim

Two factual claims in `sessions.md` had drifted from current production data.

## Evidence

### 1. parentSessionId kind distribution

**Documented (2026-06-12):** "all 14 sessions with parentSessionId are `job` or `chat` kind"

**Actual (2026-06-13):**
- 10 sessions with non-null `parentSessionId`, **all** `job` kind
- 0 `chat` sessions have `parentSessionId`
- 0 `call` sessions have `parentSessionId` (0 of 13,220)
- 4 rows from the original census aged out via 14-day db-retention

The structural claim (call sessions don't populate parentSessionId) was and
remains correct. The "or chat" qualifier was stale — those rows were pruned
by retention.

### 2. lastActivityAt coverage

**Documented (2026-06-11):** "100% across all 8 agents, 99.9% (1102/1103) for 24h"

**Actual (2026-06-13):**
- 7 active agents (not 8 — one agent dropped from the active set)
- 24h coverage: 99.8% (1319/1321)
- 2 unpopulated rows are evaluator sessions
- 6h/12h: 100%

The precondition for pure-SQL zombie detection remains met.

## Fix Applied

Updated `sessions.md`:
- parentSessionId note: "job or chat" → "job"; count 14 → 10
- lastActivityAt status: date 2026-06-11 → 2026-06-13; 8 agents → 7; 1102/1103 → 1319/1321
