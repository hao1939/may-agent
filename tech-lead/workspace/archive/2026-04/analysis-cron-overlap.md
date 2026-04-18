# Cron Tick Overlap Analysis

**Date:** 2026-04-11  
**Lens:** D — Cron tick overlap fragility  
**Status:** Investigation complete — low severity

## Executive Summary

Investigated 804 heartbeat sessions across 48 hours. Found **270 overlapping session pairs** but **zero are bugs** in the cron overlap guard. The guard works correctly. The "overlaps" are two distinct, intentional patterns.

## Overlap Patterns Found

### Pattern 1: Agent-forked child sessions (245 cases, 92%)

Heartbeat sessions use `agents.fork()` to spawn child work sessions. Both sessions run concurrently for the same agent — the heartbeat parent finishes quickly while the child does the real work.

**Example:** tech-lead heartbeat (5 ops, 30s) → forks "[WORK SESSION] Lens D: cron overlap analysis" (50+ ops, 5min+)

**Verdict:** Intentional. This is how agents do multi-step work.

### Pattern 2: Different cron jobs for same agent fire simultaneously (25 cases, 8%)

Multiple cron entries target the same agent with the same interval (30min), so they fire at the same tick:
- **bob:** `heartbeat-bob` + `common-sense-infra` (2 overlaps, ~3min each)
- **coach:** `heartbeat-coach` + `reflect` (4 overlaps, ~3-5min each)
- **optimizer:** `heartbeat-optimizer` + `optimize` (2 overlaps, ~4-5min each)
- **evaluator:** `heartbeat-evaluator` + `evaluateTask()` bus events (17 overlaps, ~5-15s each)

**Verdict:** By design. The overlap guard `isAgentHeartbeatRunning()` only blocks duplicate heartbeats for the same agent, not different job types. Running a heartbeat and a reflect job concurrently is fine — they have different tasks.

## The Overlap Guard Works Correctly

The `isAgentHeartbeatRunning()` check in `cron.ts:fire()`:
1. Queries the requests DB for `artifact IN (heartbeat-names) AND status IN ('CREATED', 'IN_PROGRESS')`
2. If found, skips the tick

This correctly prevents **duplicate heartbeat** sessions. In 804 heartbeat sessions over 48h, there are **zero cases** of the same heartbeat firing twice concurrently.

## Impact Assessment

| Metric | Overlapping | Non-overlapping |
|--------|-------------|-----------------|
| Sessions | 500 | 601 |
| Errors | 11 (2.2%) | 8 (1.3%) |

Error rates are comparable — no evidence that concurrent sessions cause problems.

Total overlap time: ~2,200s for cron-to-cron, ~70,000s for agent-forked children.

## Recommendation

**No code changes needed.** The cron overlap guard is working correctly. The concurrent sessions are either intentional (agent forks) or harmless (different job types for same agent).

One minor improvement opportunity: the evaluator's `evaluateTask()` bus handler spawns sessions without request tracking, making them invisible to the cron system. This could be tracked for observability, but it's not causing harm.
