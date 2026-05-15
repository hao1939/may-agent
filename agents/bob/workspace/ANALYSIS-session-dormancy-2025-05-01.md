# Bob Session Dormancy Audit — 2025-05-01

## Problem
System status shows **50+ interrupted bob sessions** in the last 2 weeks, many repeating the same tasks:
1. "Ship EXP-188 finish-guard to production" — ~20 interrupted attempts
2. "Resume context-learning project" — ~15 interrupted attempts  
3. "Process scout deep-dives into knowledge entries" — ~10 interrupted attempts

These represent **wasted compute cycles** — tasks that get dispatched every heartbeat but never complete (likely due to blockers or stale dispatch logic).

## Root Cause Analysis

### EXP-188 Finish-Guard
- EXP-188 (Recognition Intervention Dose-Response) was run by coach.
- Bob was tasked with shipping the finish-guard to production.
- Sessions get interrupted before completion, but the task keeps re-dispatching.
- **Likely blocker**: The task may reference files/paths that no longer exist, or the finish-guard was already shipped and the dispatch signal was never cleared.

### Context-Learning Project
- Project `agent-system-literacy` is listed as **closed** (milestone 5/6).
- Yet sessions keep trying to "resume" it.
- **Likely blocker**: Project status is closed but dispatch logic still references it.

### Scout Deep-Dive Processing
- Multiple sessions try to process DD-802 through DD-807.
- **Likely blocker**: Deep-dives may already be processed, or the processing queue marker is stale.

## Recommendations

1. **Clear stale dispatch signals**: Check `.state/` for any queue files or JSON markers that keep re-triggering these tasks. Delete or mark them as processed.
2. **Verify EXP-188 status**: Check if the finish-guard is already in production code. If yes, close the dispatch loop.
3. **Close context-learning project properly**: Ensure project status file explicitly marks all milestones complete.
4. **Add idempotency guards**: Before dispatching a recurring task, check if the previous attempt succeeded (e.g., check for the expected output file).

## Impact Estimate
At ~50 interrupted sessions × avg session cost, this represents significant wasted resources over the past 2 weeks. Fixing dispatch hygiene could recover 30-50% of bob's session budget.

## Next Steps
- [ ] Audit `.state/` dispatch files for stale bob tasks
- [ ] Verify EXP-188 finish-guard production status
- [ ] Update project-health-state.json to reflect closed projects
