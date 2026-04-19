# May Heartbeat Ops Diet Audit
**Date**: 2026-04-16
**Scope**: All heartbeat sessions, last 24h from may.db

## Executive Summary

The "14.4 avg" target appears to come from a different agent or an older time window. **May's actual heartbeat avg is 2.4 ops** across 4,032 sessions in the last 24h — she's already extremely lean. The bloat problem is in OTHER agents.

## Data

### Per-Agent Heartbeat Averages (last 24h)
| Agent | Avg Ops | Sessions | Total Ops | Bloated (>12) |
|-------|---------|----------|-----------|---------------|
| optimizer | **12.8** | 1,530 | 19,572 | 561 (37%) |
| tech-lead | **9.8** | 2,039 | 20,040 | 447 (22%) |
| coach | **9.4** | 1,752 | 16,545 | 472 (27%) |
| scout | **9.4** | 1,101 | 10,350 | 311 (28%) |
| bob | **6.8** | 2,050 | 13,885 | 364 (18%) |
| qa | 7.2 | 858 | 6,136 | 82 (10%) |
| amy-kimi | 5.1 | 981 | 5,040 | 200 (20%) |
| **may** | **2.4** | **4,032** | **9,625** | **259 (6%)** |
| amy | 2.3 | 780 | 1,793 | 69 (9%) |
| evaluator | 1.8 | 1,873 | 3,456 | 23 (1%) |

**Overall heartbeat avg: 6.3 ops** across 17,017 sessions.

### May's Distribution
| Bucket | Count | Avg Ops |
|--------|-------|---------|
| 0-3 | 3,437 (84%) | 0.4 |
| 4-6 | 207 (5%) | 4.9 |
| 7-12 | 143 (4%) | 9.2 |
| 13-20 | 136 (3%) | 16.0 |
| 21+ | 154 (4%) | 31.6 |

84% of May heartbeats complete in ≤3 ops. The 7% that go >12 ops account for most of her total budget.

### May's Bloated Sessions (>12 ops, last 48h sample)
These typically happen when May:
1. Does inline investigation instead of forking
2. Multi-step dispatch-board management (read/edit cycles)
3. Context.md rewrites during heartbeats
4. Running multiple DB queries instead of using the system snapshot

The evaluator marks 0 wasted calls on all sampled bloated sessions — suggesting the ops are *productive* but *shouldn't be in heartbeats*.

## Where the Real Savings Are

May is NOT the problem. The top 3 ops consumers are:
1. **tech-lead** — 20,040 total heartbeat ops (avg 9.8, 447 bloated)
2. **optimizer** — 19,572 total heartbeat ops (avg 12.8, 561 bloated)  
3. **coach** — 16,545 total heartbeat ops (avg 9.4, 472 bloated)

### Recommended Priorities
1. **Optimizer** (avg 12.8 → target ≤10): Highest avg, most bloated sessions. 37% of sessions exceed 12 ops.
2. **Tech-lead** (avg 9.8 → target ≤8): Highest total ops. 22% bloated.
3. **Coach** (avg 9.4 → target ≤8): 27% bloated.
4. **Scout** (avg 9.4 → target ≤8): 28% bloated.

## May heartbeat.md — Already Well-Optimized

The current heartbeat.md already includes:
- ✅ Single system snapshot query for steps 1-5
- ✅ "Fork all deep work" directive  
- ✅ Explicit "What MUST Be Forked" blocklist
- ✅ "Do NOT run another query" reminders

### Minor Proposals for May heartbeat.md

1. **Cap dispatch-board edit cycles**: Currently Steps 1-2 can each read+edit the board. Combine into a single read+edit cycle.
   - Location: Steps 1 and 2 — merge board operations
   - Expected savings: ~1-2 ops on cycles with dispatches

2. **Remove Step 4 (Triage Failures) bash block**: The code block duplicates the system snapshot query. Agents following the instruction ("use system snapshot") don't need it, but its presence invites re-running it.
   - Location: Step 4, the ```bash block
   - Expected savings: Prevents accidental re-query

3. **Eliminate Step 4 (Research Projects) directory listing**: "Only check the directory listing" still costs 1 op when nothing changed. Make it conditional on dispatch needs.
   - Location: Step 4 (Research Projects)
   - Expected savings: ~1 op per cycle when no research activity

These are marginal — May's real lever is maintaining the 84% ≤3-ops rate and ensuring bloated outliers get forked instead of inline.

## Conclusion

May heartbeat is already near-optimal at 2.4 avg ops. The "≤12" target from the task title likely refers to the **system-wide heartbeat average of 6.3** or to a specific agent like **optimizer (12.8)**. 

**Recommendation**: Redirect this effort to an **optimizer ops diet** — that's where 12.8→≤10 would have measurable system impact.
