# ANALYSIS: Zombie Session Accumulation

**Author**: Bob | **Date**: 2025-05-02 | **Type**: System Health Audit

## Finding

The system reports **398 "active" sessions**, but only **2 are actually running** (coach and bob heartbeats). The remaining 396 are zombies — sessions marked "interrupted", "done", or "idle" from days to weeks ago that are never cleaned up.

## Evidence (from system_status at 2025-05-02 08:46 UTC)

### Session Age Distribution
| Age Bucket | Count (approx) | Status |
|-----------|----------------|--------|
| < 1 hour | 2 | Running (current heartbeats) |
| 1-24 hours | ~5 | Mostly done/interrupted |
| 1-7 days | ~50 | Interrupted |
| 1-4 weeks | ~200 | Interrupted/done |
| 4+ weeks (574h+) | ~140 | Done/interrupted/error |

### Worst Offenders (Repeat Patterns)
1. **"Ship EXP-188 finish-guard"** — Bob dispatched this task repeatedly across 15+ sessions (276h-282h ago), each interrupted. The task was never completed or killed.
2. **"Resume context-learning project"** — Same pattern, 10+ interrupted sessions.
3. **"Process scout deep-dives"** — 8+ interrupted sessions.
4. **Coach EXP-188 trial execution** — 12+ interrupted sessions.
5. **May "Triage Hao requests"** — 5+ interrupted sessions.

### Impact
- **system_status output is massive** — 50KB+ of stale session data drowning the 2 real sessions
- **Request tracking pollution** — stale sessions may confuse dedup logic
- **No session GC** — nothing ever cleans up interrupted/done sessions from the active list

## Root Causes

### RC-1: No Session Garbage Collection
Sessions that complete, error, or get interrupted remain in the "active" list indefinitely. The `system_status` tool has no TTL or cleanup filter.

### RC-2: Dispatch-Without-Completion Loop
The "Ship EXP-188" pattern shows a task being re-dispatched every heartbeat because:
- Previous session was interrupted (timeout or crash)
- Next heartbeat sees "task not done" → dispatches again
- No dedup catches the pattern because each session ID is unique
- Result: N interrupted sessions for the same task

### RC-3: No "Abandoned" Detection
A session interrupted 574 hours ago is clearly dead, but nothing marks it as such.

## Recommendations

### Immediate (this session)
- **Notify tech-lead**: Session GC is needed. Proposed: sessions older than 24h in `done`/`interrupted`/`error` state should be archived out of the active list.

### Short-term
- **Session TTL in system_status**: Filter out sessions older than N hours from "active" display (suggested: 6h for done, 24h for interrupted)
- **Dispatch dedup enhancement**: Before forking a new session for task X, check if there's already an interrupted session for the same task in the last 6h

### Medium-term  
- **Session lifecycle state machine**: `running` → `done`/`error`/`interrupted` → (after TTL) → `archived`
- **Stuck-task escalation**: If the same task is dispatched 3+ times without completion, escalate to human

## Relationship to Existing Work
- **ANALYSIS-zero-output-loops**: Covers the *content* of stuck sessions (zero output). This analysis covers the *accumulation* of dead sessions.
- **DESIGN-dispatch-dedup-guard**: Addresses duplicate dispatch. Complementary — dedup prevents new zombies, GC cleans old ones.
- **IMPL-zero-output-circuit-breaker**: Phase 2 enforcement would reduce future zombies by terminating stuck loops earlier.

## Hypothesis (H-302)
> Implementing session GC (archiving sessions >24h in terminal states) will reduce system_status output by ≥90% and improve heartbeat decision quality by removing noise.

**Falsification**: If agents need to reference sessions older than 24h for context, GC would break that workflow. Check if any agent reads old session data before implementing.

## Priority: P1
This is a quality-of-life issue that degrades every heartbeat for every agent. The system_status call returns 50KB of noise, consuming context window budget that could be used for actual reasoning.
