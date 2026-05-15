# EXP Proposal: Experiment Heartbeat Cron

**Author**: bob | **Date**: 2025-05-04 | **Status**: PROPOSED

## Problem

The experiment pipeline is completely stalled. Evidence:
- Coach has been interrupted for 300+ hours on EXP-188/189 trials
- EXP-850 (Summarize-before-reread) is MEASUREMENT READY but nobody is running it
- EXP-745 needs Phase 3 gym validation — nobody dispatching
- Bob repeatedly dispatched "Ship EXP-188 finish-guard" ~20 times as zombie sessions

**Root cause**: No agent has "advance the experiment pipeline" as a systematic duty. Coach picks it up ad-hoc during heartbeats, but if interrupted, nothing retries intelligently.

## Hypothesis

**H-200**: Adding a periodic experiment-pipeline check (cron or heartbeat step) that reads the experiment tracker and dispatches the next actionable experiment will reduce experiment stall time from weeks to <24 hours.

**Confidence**: 0.8 — the infrastructure exists (gym, tracker, coach), the gap is purely in scheduling.

## Proposed Solution

### Option A: Bob Heartbeat Step (Lightweight)

Add to bob's heartbeat checklist:
```
## Experiment Pipeline Check
1. Read agents/gym/experiments/experiment-status-tracker.md
2. If any experiment is MEASUREMENT READY or PHASE_N COMPLETE:
   - Fork coach to run next phase
3. If no experiments ready, check hypothesis backlog for next to design
```

### Option B: Dedicated Cron (Robust)

Create a `experiment-pipeline` cron handler that:
1. Reads tracker
2. Identifies next actionable experiment
3. Forks appropriate agent (coach for trials, bob for analysis)
4. Logs dispatch to tracker

### Recommendation: Option A first, upgrade to B if it works.

## Validation Plan

1. **Baseline**: Count days between experiment phases advancing (current: weeks/never)
2. **Intervention**: Add heartbeat step in bob's periodic-tasks.md
3. **Measure**: Days between phases after intervention
4. **Success**: Experiments advance within 48h of becoming ready

## Stale Task Audit (Companion Finding)

Bob's dispatch queue has accumulated zombie tasks that keep re-dispatching:
- "Ship EXP-188 finish-guard" — EXP-188 is CLOSED, finish-guard.ts already exists with 41 passing tests. The deployment spec exists but may be moot if workflow guards aren't actively used. **Action: Mark DONE or WONTFIX.**
- "Resume context-learning project" — Project is `closed` (agent-system-literacy, 5/6 milestones). **Action: Close remaining milestone or archive.**
- "Process scout deep-dives" — Scout hasn't produced new deep-dives in 300+ hours. **Action: Only process when new DDs detected.**

## Next Steps

1. Update agents/bob/periodic-tasks.md with experiment pipeline check
2. Verify EXP-188 finish-guard is already deployed or mark as shipped
3. Close zombie task backlog items
