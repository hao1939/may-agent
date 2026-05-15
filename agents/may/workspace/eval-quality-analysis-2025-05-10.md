# Evaluation Quality Analysis — 2025-05-10

## Key Finding: May's cron-steward sessions are the biggest quality drag

### The Numbers (last 24h)
| Agent | Total Evals | Good | Acceptable | Needs Improvement | Avg Quality |
|-------|------------|------|------------|-------------------|-------------|
| arc   | 70         | 46   | 15         | 9                 | 0.78        |
| dev   | 83         | 51   | 18         | 14                | 0.73        |
| may   | 244        | 128  | 27         | 89                | 0.71        |
| scout | 148        | 93   | 6          | 48                | 0.71        |

### Root Cause: `closed-loop-steward` cron producing empty sessions

May's 88 heuristic `needs_improvement` sessions are dominated by `closed-loop-steward` cron invocations that produce **0 productive calls and 1 wasted call** before being interrupted. These are sessions that start, make one call, then get killed — likely due to concurrent session limits or timeouts.

- 15 of may's needs_improvement sessions are from `closed-loop-steward` with identical pattern: quality=0.55, productiveCalls=0, wastedCalls=1
- 3 more are heartbeat sessions with quality=0.2, productiveCalls=0, wastedCalls=1

### Scout Operational Friction (0.54 rate, target 0.1)

Scout has 48 needs_improvement sessions (heuristic avg quality 0.45). Combined with a "good session rate" of only 0.63 (target 0.85), scout is the second biggest quality concern.

### The "Overturned Good Sessions" Metric (0.27 vs target 0.05)

When LLM evaluations happen, they're actually **more generous** than heuristics for arc/dev (LLM avg quality 0.84-0.85 vs heuristic 0.71-0.77). The 27% overturn rate is likely driven by the rare LLM evaluations of may/scout sessions where LLM gives much harsher scores (may LLM avg: 0.36, scout LLM avg: 0.30).

This means: **the heuristic is too lenient for may/scout and too harsh for arc/dev**.

### Recommendations

1. **Fix closed-loop-steward interruption pattern**: Investigate why these sessions produce 0 productive calls. Either the cron interval is too frequent (causing overlap), or the session is being preempted. Consider increasing the cron interval or adding a guard that skips if a previous steward session is still running.

2. **Tune heuristic by agent**: The heuristic assigns uniform quality scores regardless of agent behavior patterns. A simple improvement: sessions with 0 productive calls should get quality < 0.3 (currently some get 0.55).

3. **Scout needs focused improvement**: 0.54 operational friction rate suggests systemic issues with scout's task execution, not just evaluation calibration.

4. **Active project iterations at 0**: No project iterations in 24h despite active projects existing. This suggests the project iteration pipeline is stalled.
