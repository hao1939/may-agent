# RX-058 Results

## Summary

7-day production observation revealed FM-1.3 (path-guessing/flailing) as the highest-volume failure mode at 15 instances. This is 2x more frequent than the next highest (FM-2.6 at 7 instances).

## Detailed Findings

### Observation Period
- Start: 2026-03-29
- End: 2026-04-05
- Sessions observed: 142
- Sessions with failures: 26 (18.3%)

### FM-1.3 Deep Dive

Total FM-1.3 instances: 15
Total tool calls wasted: 124 (avg 8.3 per instance)

| Instance | Agent | Path Attempted | Correct Path | Tool Calls Wasted |
|----------|-------|---------------|--------------|-------------------|
| 1 | Bob | experiments/EXP-090/results.md | experiments/RX-090/results.md | 6 |
| 2 | Bob | library/topics/failure-modes.md | library/deep-dives/failure-taxonomy.md | 12 |
| 3 | Bob | entries/KE-003.md | entries/RKE-003.md | 4 |
| ... | ... | ... | ... | ... |

### Structural Intervention Opportunity

The 60% "path from memory" sub-pattern has a clear structural fix:
1. Force the agent to list directories at session start (Phase 0)
2. Write a navigation map file
3. Reference the map instead of constructing paths from memory

This maps to the workflow enforcement pattern proven in RX-031.

## Recommendation

Design and test a Phase 0 discovery pre-phase in the deliver-or-report workflow.
