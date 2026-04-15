# Finding: 81% of All Sessions Are Idle — $2,155+ Wasted on May Alone

**Date**: 2026-03-18T03:25 UTC
**Status**: NEW — needs infra fix
**Impact**: HIGH — largest single source of waste identified

## Summary

81.2% of all sessions system-wide (11,273 / 13,890) do ≤3 ops and produce zero useful work. The worst offender is **May**, with 97.8% idle sessions (3,376 / 3,452), costing an estimated $2,155 in wasted API calls.

## Evidence

### System-wide idle rate by agent (core agents)

| Agent | Total | Idle(≤3 ops) | Idle% |
|-------|-------|--------------|-------|
| **may** | 3,452 | 3,376 | **97.8%** |
| evaluator | 1,459 | 1,377 | 94.4% |
| bob | 1,573 | 1,369 | 87.0% |
| amy | 857 | 765 | 89.3% |
| scout | 641 | 511 | 79.7% |
| amy-kimi | 764 | 596 | 78.0% |
| optimizer | 902 | 666 | 73.8% |
| coach | 1,613 | 1,105 | 68.5% |
| tech-lead | 1,462 | 1,000 | 68.4% |
| coder | 158 | 155 | 98.1% |
| qa | 193 | 83 | 43.0% |
| **TOTAL** | **13,890** | **11,273** | **81.2%** |

### May's Pattern (examined transcript)

Typical May idle session (s_1773803832490_408):
1. Wake up → 2 API calls → $0.078 (11.6K + 12.4K input tokens)
2. Check for pending tasks → find none
3. Git auto-commit (usually nothing to commit)
4. Check active requests → find nothing targeting May
5. `finish(success)` → interrupted

**Duration: 12-19 seconds. Cost: $0.078. Value: zero.**

### Cost Impact

- **May idle cost**: $2,155.50 (97.2% of May's $2,218 total)
- Avg idle session: $0.64 (higher for older sessions with larger context)
- Recent idle sessions: ~$0.078 each (Opus at $3/Mtok input)
- At current rate (~20 May sessions/day), ongoing waste: ~$1.56/day just for May idle sessions

## Root Cause

The cron scheduler fires May's heartbeat every interval regardless of whether there's pending work. May's heartbeat pattern requires:
1. LLM invocation to read injected context
2. Query request DB (via tool call)
3. Find nothing → finish

This is a **pure LLM call for a boolean check** that should be done in JS.

## Proposed Fix: Pre-flight Check Handler

Add a JS pre-flight check to May's cron job that skips the LLM session if no work exists:

```javascript
// In cron scheduler, before launching May heartbeat:
async function shouldRunMayHeartbeat(): boolean {
  const pendingForMay = await db.query(
    "SELECT COUNT(*) FROM requests WHERE to_agent = 'may' AND status = 'CREATED'"
  );
  const uncommittedFiles = await exec('cd /app/agents && git status --porcelain | wc -l');
  
  // Only invoke LLM if there's actual work
  return pendingForMay > 0 || parseInt(uncommittedFiles) > 0;
}
```

This could be generalized for ALL agents — skip heartbeat if:
1. No CREATED requests targeting this agent
2. No pending signals
3. Agent-specific pre-conditions not met

### Expected Savings

- **May**: Eliminate ~96% of sessions → save ~$2/day
- **System-wide**: If applied to all agents, could eliminate 50-70% of idle sessions
- **Conservative estimate**: $5-10/day savings → $150-300/month
- **Bonus**: Reduces cron load, session storage, evaluation overhead

## Related Issues

- Cron hot-reload broken (finding-cron-reload-broken.md) — intervals still at 540s not 1800s
- Prompt caching broken (finding-prompt-caching-broken-opus.md) — 0% cache hits inflate idle session costs
- Session overtriggering (brief-session-waste-analysis.md) — agents fire 2-12x more than configured

## Action Items

1. **tech-lead**: Implement pre-flight skip for May heartbeat (JS handler, no LLM needed)
2. **tech-lead**: Generalize to all agent heartbeats as `heartbeat-preflight.ts`
3. **Hao**: Restart process to apply cron interval fixes (would reduce May from ~7/hr to 2/hr)
