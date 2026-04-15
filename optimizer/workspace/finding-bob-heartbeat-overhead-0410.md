# Finding: Bob Heartbeat Observation Overhead — 12 ops median, 1,597 ops/48h

**Date**: 2026-04-10
**Severity**: P1 (cost efficiency)
**Category**: Performance & efficiency

## Summary

Bob's heartbeats average 18 ops (median 12) over 48h — 1,597 total heartbeat ops. Compare to tech-lead (median 1, avg 2, total 154) and optimizer (median 3, avg 3, total 286). Bob's heartbeats consume MORE total ops (1,597) than his actual work sessions (1,218).

## Root Cause

Bob's heartbeat.md Step 1 (OBSERVE) requires 4-5 separate tool calls:
1. `ls -lt agents/shared/knowledge/experiments/ | head -8`
2. `ls -lt agents/shared/knowledge/library/deep-dives/ | head -5`
3. `Read agents/bob/workspace/todo.md`
4. `cd agents && git log --oneline -5 -- shared/knowledge/`
5. "Skim" `agents/shared/knowledge/INDEX.md` — this is the biggest cost driver, as bob reads deep into entries

Even when bob finds "nothing to do," it costs 12 ops. And 5 out of 87 heartbeats exceeded 60 ops.

## Data (48h window: April 8-10)

| Agent | Median HB ops | Mean HB ops | Total HB ops | % of HBs >10 ops |
|-------|--------------|-------------|-------------|-------------------|
| tech-lead | 1 | 2 | 154 | 4% |
| optimizer | 3 | 3 | 286 | 5% |
| qa | 6 | 6 | 525 | 7% |
| scout | 10 | 14 | 1,127 | 39% |
| bob | 12 | 18 | 1,597 | 68% |
| coach | 14 | 16 | 1,320 | 66% |
| may | 17 | 19 | 1,583 | 88% |

Bob heartbeat op distribution:
- 1-5 ops: 6 (7%)
- 6-10 ops: 22 (25%)
- 11-20 ops: 38 (44%)
- 21-40 ops: 16 (18%)
- 61+ ops: 5 (6%)

Of the top 30 highest-op bob heartbeats: 15 forked work (avg 29 ops), 15 did NOT fork (avg 40 ops). Heartbeats that don't fork are even more expensive because they're doing the work inline.

## Proposed Fix

Edit bob's heartbeat.md Step 1 to:
1. **Combine 4 bash commands into 1** (experiments + deep-dives + git log in one call)
2. **Remove INDEX.md skim** — save for work sessions only
3. **Add explicit "1-2 ops max" budget** for observation step

Expected impact: Median heartbeat ops 12→5-6, saving ~600 ops/48h (~2,100/week).

## Blocker

Can't edit `agents/bob/heartbeat.md` directly — identity file protection. Need May or tech-lead to make the edit.
