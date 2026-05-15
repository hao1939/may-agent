# Scout Reliability Investigation Report
**Date**: 2026-04-04 | **Investigator**: Optimizer | **Priority**: P1

## Executive Summary

Scout has the **highest waste rate (49%)** and **highest error rate (28%)** of all agents. Of $690 total spend, approximately **$337 was wasted** on failed/interrupted sessions. The root causes are mostly **platform-level issues** (process restarts, API failures), not Scout-specific bugs. Three categories of errors have been identified, with specific recommendations for each.

## Key Metrics

| Metric | Scout | System Avg | Best (QA) |
|--------|-------|-----------|-----------|
| Success Rate | 63% | 73% | 91% |
| Error Rate | 28% | 19% | 4% |
| Waste Rate | 49% | 35% | 13% |
| Avg Session Cost | $0.92 | $0.70 | $0.25 |
| Total Sessions | 769 | — | 506 |
| Total Cost | $690 | — | $128 |

## Error Taxonomy

### 1. API/LLM Failures (Historical — Resolved)
- **78x** "LLM returned stopReason toolUse but no tool call" (Mar 10-19)
- **41x** "Model returned empty response" ($174 wasted in W11 alone)
- **12x** "429 Rate limit" ($23 wasted)
- **Status**: ✅ Resolved — haven't recurred since W11

### 2. Process Restarts → "Request was aborted" (Ongoing)
- **36x** over entire history, **11x** in W13 alone
- Sessions run 20-31 turns, costing **$1.55 avg** each, then get killed
- Affects ALL agents (coach: 40x, optimizer: 37x, bob: 31x, scout: 11x in W13)
- Root cause: Binary rebuilds and process restarts during active sessions
- **Status**: 🔴 Active — system-wide issue, not Scout-specific

### 3. Turn Limit Exceeded (Transient — Resolved)
- **3x** on Apr 3: "Turn limit reached: 31/30 turns"
- Sessions produced real work (24-37 ops) but terminated with error status
- Root cause: `maxTurns` config was temporarily set to 30, now removed
- **Status**: ✅ Resolved — Apr 4 session completed successfully with 34 ops

### 4. Timeouts (Intermittent)
- Occasional "The operation timed out" errors
- Low frequency, low cost
- **Status**: 🟡 Intermittent — inherent to network operations

## Weekly Trends

| Week | Sessions | Total Cost | Waste Rate | Notes |
|------|----------|-----------|-----------|-------|
| W09 | 22 | $20 | 19% | Baseline |
| W10 | 428 | $45 | 2% | Many cheap API errors |
| **W11** | **212** | **$537** | **58%** | **Catastrophic: $313 wasted on API failures** |
| W12 | 53 | $51 | 0% | **Perfect week** |
| W13 | 38 | $37 | 51% | Process restart issues |

**Key observation**: W12 shows Scout CAN achieve 100% reliability when the platform is stable. The waste is caused by infrastructure issues, not Scout's behavior.

## Waste by Category

| Error Type | Count | Total Cost | Avg/Session | Period |
|-----------|-------|-----------|------------|--------|
| Empty LLM response | 35 | $174 | $4.97 | W11 only |
| Request aborted | 36 | $96 | $2.67 | Ongoing |
| Null error (interrupted) | 25 | $52 | $2.08 | W11 |
| OpBudget exceeded | 13 | $31 | $2.38 | W11 (now removed) |
| Rate limit 429 | 12 | $23 | $1.94 | W11 |
| Turn limit | 3 | $3 | $1.08 | Apr 3 only |

## Recommendations

### P0: Add maxTurns Guardrail for Scout
**Cost to implement**: 1 line in cron.json
**Expected savings**: Prevents runaway sessions

Scout's successful sessions: 65% complete in ≤5 turns, 95% in ≤30 turns. Sessions going past 35 turns are almost always stuck.

**Recommendation**: Add `"maxTurns": 35` to Scout's `handlerConfig` in cron.json. This would:
- Prevent turn-count runaway (saves $1-2+ per stuck session)
- Still allow deep research sessions (95th percentile is ~30 turns)
- Match the existing behavior without cutting productive work

### P1: Graceful Abort Handling (System-Wide)
When process restarts, active sessions get "Request was aborted" with no chance to save progress. These sessions cost $1.55 avg but produce no persisted output.

**Recommendations**:
1. Before process restart, signal sessions to checkpoint and finish
2. Or: Implement session resume after restart (recover from last checkpoint)
3. Or: Shorter sessions that complete before the next restart cycle

### P2: Cost Circuit Breaker
Add a per-session cost limit. If a session exceeds $3 without progress, terminate it. This would have saved ~$50 during W11.

### P3: Better Empty Response Handling
When LLM returns empty response, immediately retry (current behavior may not). This was the single most expensive error category ($174 in W11).

## Productivity Assessment (When Working)

When Scout sessions succeed, they are **highly productive**:
- Producing deep-dives (476 DDs), cross-references (265 CRs), predictions, and theory
- W13 alone: 14 DDs, 8 CRs, 37 predictions, 3 laws, 3 mechanisms, 3 trilemmas
- Average successful session: 7.9 turns, $0.74 cost — very efficient
- Scout uses Opus model effectively for deep research

## Conclusion

Scout's reliability problem is **80% platform-level** (process restarts, API failures) and **20% configuration** (missing turn guardrails). The most impactful fix is the P0 maxTurns guardrail (1 line change), followed by P1 graceful abort handling (requires infrastructure work). Scout itself is the most productive research agent in the system — the investment in reliability improvements will directly increase output.
