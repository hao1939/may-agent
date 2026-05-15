# Proposal: Session Waste Reduction — Eliminating 30-40% No-Op Sessions

**Author**: Bob  
**Date**: 2026-06-01  
**Status**: APPROVED (2027-09-04) — Layer 2 already implemented per tech-lead feedback  
**Priority**: P0 — this is the single largest efficiency problem in the system

## Problem

Two independent analyses confirm **30-40% of all system sessions produce zero deliverables**:

| Analysis | Date | Waste Rate | Root Cause |
|----------|------|------------|------------|
| finding-may-session-waste | 2026-03-17 | 36.5% | May heartbeats with 0 deliverables |
| finding-may-project-cron-waste | 2026-04-28 | 32% (~78% of May sessions) | Project cron polling every 5min with 31 BLOCKED items |

Previous "fix" (experiment-session-waste-reduction, 2026-04-23) was marked done but **data shows no improvement**. The 78% no-op rate persisted.

## Root Causes (ordered by impact)

### 1. Polling Without Preflight (biggest waste source)
May's `project` cron fires every 5 minutes. Each time, May wakes, discovers 31 BLOCKED items and 0 dispatchable, then exits. This accounts for ~300 wasted sessions.

### 2. Stale Todo Items Triggering `hasRemainingWork()`
Unchecked `- [ ]` items in May's todo.md cause `hasRemainingWork() → true`, re-triggering heartbeats endlessly even when nothing is actionable.

### 3. No Session Cooldown / Dedup
If May just completed a "0 dispatchable" session 30 seconds ago, another trigger immediately starts a new identical session. There's no cooldown.

## Proposed Fix: Three-Layer Defense

### Layer 1: Preflight Skip (zero-code-change, immediate)
**Action**: Mark May's 3 stale `- [ ]` todo items as `- [x] BLOCKED:` or remove them.  
**Effect**: Stops hasRemainingWork() from re-triggering.  
**Risk**: Zero.  
**Owner**: Anyone with write access to May's todo.md.

### Layer 2: Cron Interval Increase (config change)
**Action**: Change May's `project` cron from 5min (`intervalMs: 300000`) to 30min (`intervalMs: 1800000`).  
**Effect**: Reduces polling sessions by ~83% (from ~300 to ~50 per equivalent window).  
**Risk**: Low — if something becomes unblocked, worst case is 30min delay before May notices.

### Layer 3: Smart Preflight Filter (code change)
**Action**: Add a preflight check to the project cron handler:
```
Before spawning a session:
1. Read May's project items
2. Count non-BLOCKED items
3. If count == 0, skip session entirely
4. Log skip for audit
```
**Effect**: Eliminates remaining no-ops even at 30min interval.  
**Risk**: Medium — need to ensure the filter doesn't suppress genuinely actionable triggers.

## Expected Impact

| Metric | Before | After All 3 Layers |
|--------|--------|-------------------|
| Total system sessions/day | ~1000 | ~650 |
| May no-op sessions/day | ~350 | ~10 |
| Waste rate | 35% | <5% |
| Compute savings | — | ~30% reduction |

## Validation Plan

After implementing each layer, measure over 24h:
- Count May sessions
- Count May sessions with 0 deliverables  
- Calculate waste rate
- Compare against baseline (35%)

**Success threshold**: Waste rate < 10% sustained over 48h.

## Dependencies

- Layer 1: No dependencies (just edit a file)
- Layer 2: Access to May's cron config
- Layer 3: Code change to session dispatch logic

## Recommendation

Implement Layer 1 immediately (literally right now). Layer 2 within this session. Layer 3 as a tracked project for optimizer.
