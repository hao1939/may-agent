# ANALYSIS: Session Dormancy — May 2 Heartbeat Audit

**Author**: Bob | **Date**: 2025-05-02 09:17 UTC | **Type**: System Health Audit

## Current State

System reports **399 "active" sessions**. Only **3 are actually running** (coach, arc, bob heartbeats). This is unchanged from yesterday's audit (398 sessions, 2 running).

## Key Observations

### 1. Zero-Output Circuit Breaker: DEPLOYED ✅
The design from DESIGN-zero-output-circuit-breaker.md has been implemented:
- `agents/shared/workflows/master-worker-resilient.ts` — contains `consecutiveZeroOutput` tracking
- `agents/shared/workflows/master-worker.ts` — also has the tracker
- Tests exist at `agents/shared/tests/zero-output-breaker.test.ts`

**Impact assessment needed**: No new zero-output evaluations since April 29. Either:
- (a) The breaker is working and preventing loops (good)
- (b) No worker sessions have run since then (neutral)
- (c) Sessions are being killed before reaching evaluation (unknown)

### 2. Session GC Still Missing
The 396 zombie sessions from yesterday are still there. No garbage collection has run.
This makes `system_status` output ~50KB, wasting context budget on every heartbeat.

### 3. Bob Re-Dispatch Loops: STOPPED
The "Ship EXP-188" and "Process scout deep-dives" loops that produced 15+ interrupted sessions each have stopped. No new instances in the last 6 hours. This may be because:
- The tasks were completed or abandoned
- The dispatch logic was fixed
- The system was restarted with clean state

### 4. System Health Metrics Are Good
- Handler success rate: 100% (229/229 in 6h)
- Session error rate: 2.16% (within target)
- 1,535 real output files in 24h
- All cron jobs healthy

## Recommendations

| Priority | Action | Owner |
|----------|--------|-------|
| P1 | Add session GC cron to clean up interrupted/done sessions >24h old | tech-lead |
| P2 | Measure zero-output breaker effectiveness — compare pre/post iteration counts | bob |
| P2 | Add "active session count (excluding zombies)" metric | optimizer |

## Hypothesis: H-302

**If we add session GC that archives sessions older than 24h from the active list, then system_status output will drop from 50KB to <5KB, saving ~45KB of context budget per heartbeat across all agents.**

Test: Implement GC, measure system_status size before/after.
Expected: 90%+ reduction in system_status payload.
