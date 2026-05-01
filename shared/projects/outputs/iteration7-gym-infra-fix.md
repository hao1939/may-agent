# Iteration 7: Gym Runner Infrastructure Fix & Results

## Problem Identified
The gym runner's session transcript finder was picking up **wrong sessions** (from concurrently-running agents like coach) instead of the gym agent's actual session. This caused all convention checks (C2.3, C3, C40.1) to fail with "No transcript available" or "No write/edit found in transcript" even when the agent completed the task correctly.

## Root Cause
In `.gym-runner-bundle.mjs`, after the agent completes, the runner searches `.state/sessions/` for the latest session JSONL. But:
1. Multiple agent sessions run concurrently (coach, documentation-gen workers, etc.)
2. The runner sorted by timestamp descending and took the first match
3. It grabbed sessions from OTHER agents (meta.agent ≠ gym agent)

## Fix Applied (`.gym-runner-bundle.mjs`)
1. **Added `agentStartTime` tracking** (line 319): Record timestamp before spawning agent to filter out pre-existing sessions
2. **Filter by timestamp** (line 378-388): Only consider sessions created AFTER `agentStartTime`
3. **Filter by agent name** (line 402-403): Check `meta.json` to ensure `meta.agent === agent` (the gym scenario's configured agent)
4. **Pass agent env var** (line 334): Added `GYM_EFFECTIVE_AGENT` to subprocess env (though final fix uses closure variable)

## Gym Results After Fix

| Scenario | Result | Details |
|----------|--------|---------|
| convention-verify-edit | ✅ 5/5 | All product + convention checks pass |
| convention-retry-pivot | ✅ 6/6 | All checks pass |
| convention-safe-append | ✅ 4/4 | All checks pass |
| convention-verify-edit-fewshot | 4/5 | C3 (explicit JSON validation) not run |
| convention-promise-report | 3/4 | C40.1 (declare intent) — needs SOUL.md update |

## Remaining Issues
1. **C40.1 (Declare intent)**: Agents bob, arc, dev, optimizer lack the "Declare intent first" rule in SOUL.md. Cannot edit due to WRITE BLOCKED policy (only owning agent or May can edit SOUL.md).
2. **C3 (JSON validation)**: The fewshot variant agent uses write() but doesn't run explicit `node -e JSON.parse` or `jq` validation.

## Recommendation
- Notify bob, arc, dev, optimizer to add "Declare intent first" to their SOUL.md
- Or request May to push this convention update system-wide
