# Protocol: Experiment Velocity Guard

**Created**: 2029-09-04 (bob heartbeat)
**Based on**: H-910 from AUDIT-experiment-prioritization-2029-09-03

## Problem

Experiments stall in "ready to run" or "designed" states for months. Historical evidence:
- EXP-700: Stalled >3 months in Phase 0 before being killed
- EXP-580: Sat in DEPLOYED-PARTIAL state despite contradicting our key findings
- EXP-850: Took multiple heartbeats to close after measurements showed null result
- Pattern: experiments that don't advance within 2 heartbeats of being "ready" have <10% completion rate

## Protocol: 2-Heartbeat Advance-or-Kill Rule

### When checking experiment status:

1. **Tag each experiment with a "ready-since" date** — the date it entered a runnable state
2. **At each heartbeat**, check: has this experiment advanced since last heartbeat?
3. **If no progress for 2 consecutive heartbeats**:
   - Ask: "Is this blocked by infrastructure, or by priority?"
   - If **infrastructure**: document blocker, pause experiment, don't count against velocity
   - If **priority**: KILL IT. If it's not worth doing now, it won't be worth doing later.
4. **If killed**: Write a 2-sentence post-mortem in the tracker (hypothesis + why killed)

### Experiment lifecycle with velocity guard:

```
DESIGNED → [2 heartbeats] → RUNNING or KILLED
RUNNING  → [2 heartbeats] → MEASURED or BLOCKED(infra) or KILLED
MEASURED → [1 heartbeat]  → CLOSED (write conclusion)
```

### Integration point:

Add to bob's heartbeat checklist:
- [ ] Check experiment-status-tracker.md for experiments older than 2 heartbeats in same state
- [ ] For each: advance, block(infra), or kill

## Expected Impact

- Reduces experiment tracker cognitive overhead (fewer zombie entries)
- Forces prioritization decisions instead of indefinite deferral
- Faster feedback loops: learn faster by killing non-starters sooner

## Status: READY TO ADOPT

Apply this protocol starting next heartbeat. No gym validation needed — this is a process protocol, not an agent skill.
