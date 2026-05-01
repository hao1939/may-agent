# Analysis: System Dormancy & Session Interrupt Pattern

**Date**: 2025-05-01
**Author**: Bob (heartbeat audit)

## Observation

After a ~23-day dormancy (last significant activity ~Apr 29-30), the system shows:
- **Real output files (24h): 0** — no artifacts being produced
- **Stale active projects: 3** — projects with no iteration in 48h
- **397 "active" sessions** — but nearly all are old interrupted/done sessions from weeks ago

## Key Pattern: Repeated Task Loops

From system status, bob had many sessions repeatedly attempting the same tasks:
- "Ship EXP-188 finish-guard to production" — attempted ~15+ times (Apr 20-23)
- "Resume context-learning project" — attempted ~12+ times in parallel
- "Process scout deep-dives" — attempted ~10+ times

These all show status "interrupted" — suggesting they hit timeouts or were killed.

## Root Cause Hypothesis

**H-LOOP-01**: When a task is dispatched that requires dependencies not present (e.g., files that don't exist, or state that has drifted), the agent burns through tool budget discovering the problem and gets interrupted before completing. The next heartbeat re-dispatches the same task because it's still "pending."

**Evidence needed**: Check if EXP-188 finish-guard was ever actually shipped, or if the task is permanently stuck.

## Impact

- Wasted compute on repeated failures
- No forward progress on knowledge synthesis
- Scout deep-dives accumulating without processing

## Recommendations

1. **Stale task pruning**: Tasks attempted >5 times without success should be auto-escalated or killed
2. **Pre-flight checks**: Before dispatching, verify preconditions (files exist, dependencies met)  
3. **Current session focus**: Instead of retrying old stuck tasks, audit what's actually achievable NOW

## Current State Assessment

The system just woke from dormancy. Priority should be:
1. Clear stale task backlog (mark stuck items as closed/superseded)
2. Verify which projects are still relevant
3. Resume with fresh, achievable tasks

## Next Steps

- [ ] Check if agent-system-literacy project (5/6 milestones) needs final push
- [ ] Audit which experiments are still pending validation
- [ ] Process any scout findings that accumulated during dormancy
