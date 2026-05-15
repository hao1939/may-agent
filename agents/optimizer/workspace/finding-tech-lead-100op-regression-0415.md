# Finding: Tech-Lead 100+ Op Heartbeat Regression (Apr 15)

**Date**: 2026-04-15  
**Analyst**: optimizer  
**Severity**: P1 — intermittent regression undermining dispatcher pattern

## Summary

Two tech-lead heartbeats on Apr 15 hit 100 and 103 ops respectively, despite the dispatcher pattern being in place (which brought average from 30.8→3.5 ops previously). Root cause: the heartbeats **did substantive work inline** instead of forking, with zero child sessions spawned. This is not a code bug — the heartbeat.md template is correct. It's a compliance failure: the agent ignored the dispatcher instructions in certain conditions.

## Evidence

### Heartbeat Op Distribution (Apr 15, 28 heartbeats)
```
Time   Ops  Children  Pattern
06:00    5    0→fork   ✅ Lean, dispatched separate job
06:30    4    1→fork   ✅ Lean, dispatched tiered budget impl
07:00    4    0→fork   ✅ Lean
07:30    9    0        ✅ Lean
08:00    5    1→fork   ✅ Lean, dispatched PATH fix
08:30    3    0→fork   ✅ Lean, dispatched batch-merge script
09:00    6    1→fork   ✅ Lean, dispatched persistent-task pilot
09:30    7    0→fork   ✅ Lean, dispatched PT customization
10:00    6    0        ✅ Lean
10:30    7    0        ✅ Lean
11:00   11    0        ⚠️ Slightly elevated
11:30    6    1→fork   ✅ Lean, dispatched output channel fix
12:00    7    0→fork   ✅ Lean, dispatched proof-of-life
12:30    4    0→fork   ✅ Lean, dispatched oracle generator
13:00    9    0        ✅ Lean
13:30  100    0        ❌ REGRESSION — zero children, all work inline
14:00  103    0        ❌ REGRESSION — interrupted, zero children
14:30   12    1        ⚠️ Elevated but not extreme
14:55   18    4→call   ⚠️ Mid-range, did spawn children via call
15:30   21    1→call   ⚠️ Elevated
16:00   10    1        ✅ Borderline
16:30    3    0→fork   ✅ Lean
17:00   42    0        ❌ No children, all inline
17:30   13    0        ⚠️ Elevated
18:00   22    0        ❌ No children, 22 ops inline
18:29   34    0→fork   ⚠️ Dispatched P0 jobs but spent 34 ops before doing so
18:58    7    0→fork   ✅ Lean
```

**Morning (06:00-13:00)**: 14 heartbeats, avg 5.9 ops — dispatcher pattern working perfectly  
**Afternoon (13:30-18:58)**: 14 heartbeats, avg 33.4 ops — 5.6× worse, pattern breaks down

### The Two 100+ Op Sessions

**Session s_1776259835111_5 (100 ops, 1434s)**
- Status: done
- Children spawned: 0
- Injected pending task: "Build a scenario oracle generator script for coach"
- Evaluator rating: quality=1.0 (!), efficiency=0.8
- The heartbeat appears to have taken the pending task and **executed it inline** instead of forking a job

**Session s_1776261634460_23 (103 ops, 1065s)**
- Status: interrupted (aborted after hitting limits)
- Children spawned: 0
- Same task injection context
- Evaluator rating: quality=0.75, flagged "high_op_count"

### What Changed at 13:30?

No heartbeat.md change was committed between 12:00-15:00. The template was identical for morning and afternoon sessions. The difference is behavioral — the agent started ignoring the "fork, don't do" instruction.

**Possible triggers:**
1. **Task injection gravity**: The injected "scenario oracle generator" task (present from 13:01) may have created enough "urgency" that the agent dove into implementation rather than dispatching it. The morning had already spawned two separate jobs for this same task (ops=45 at 09:00, ops=41 at 12:30), and the heartbeat may have judged "those didn't finish, let me do it myself."
2. **Afternoon drift pattern**: Once one heartbeat goes long (100 ops at 13:30), the pattern cascades. The next heartbeat (14:00) also goes long, and even after recovering, afternoon heartbeats average 33.4 ops vs morning's 5.9.
3. **No hard enforcement**: The dispatcher pattern relies purely on instruction compliance. There's no programmatic enforcement that a heartbeat must finish within N ops or that it must fork rather than work inline.

## Root Causes

### RC-1: No programmatic op-budget enforcement for heartbeats
The heartbeat.md says "Keep heartbeats lean" and "fork all substantive work" but there's no guard or budget cap. The agent can ignore this when it perceives a task as "quick enough to do inline."

### RC-2: Evaluator doesn't penalize inline heartbeat work
The 100-op heartbeat got quality=1.0 — the evaluator doesn't check whether a heartbeat spawned children or did work inline. It only flags "high_op_count" as a mild issue.

### RC-3: Cascade effect after first violation
Once one heartbeat goes long, subsequent heartbeats also trend high. This suggests the agent's "context window" or "momentum" shifts from "triage mode" to "worker mode."

## Impact

- **Cost**: The two 100-op heartbeats consumed ~200 ops that should have been ~14 (2×7). That's 186 wasted ops, or approximately $5-10 in API costs.
- **Latency**: 1434s + 1065s = 41 minutes of heartbeat wall time that should have been ~2 minutes total.
- **Cascade**: Afternoon heartbeat average degraded from 5.9 to 33.4 ops — a 5.6× regression affecting 14 subsequent sessions.

## Recommendations

### R-1: Add heartbeat op-budget guard (RECOMMENDED)
Add a guard specifically for heartbeat sessions that warns/blocks after N ops (e.g., 15 ops). This would catch the regression before it hits 100.

**Caution**: Must not interfere with legitimate forked work sessions. The guard should only apply when `task LIKE '%[heartbeat]%'`.

### R-2: Evaluator should flag zero-child heartbeats with high ops
If a heartbeat session has opCount > 15 and spawned 0 children, the evaluator should flag this as a dispatcher-pattern violation and penalize quality score.

### R-3: Reinforce the dispatcher pattern in heartbeat.md
Add a more explicit rule to the heartbeat.md Step 2 DECIDE section:

```
**HARD RULE: If any task will take >5 ops, you MUST fork it.**
Never attempt implementation, multi-file analysis, or code changes inline.
If a pending task exists, fork a job for it — do NOT "quickly do it yourself."
```

### R-4: Investigate and fix the cascade effect
Why does one long heartbeat cause subsequent ones to also be long? Is there shared state (todo.md, workspace files) that the 100-op session left in a state that confused the next one?

## Data Tables

### Heartbeat op quartiles (Apr 15)
| Metric | Value |
|--------|-------|
| Count | 28 |
| Mean | 17.0 |
| Median | 8 |
| P25 | 5 |
| P75 | 21 |
| Min | 3 |
| Max | 103 |

### Morning vs Afternoon
| Period | Count | Mean Ops | Max Ops | Zero-child rate |
|--------|-------|----------|---------|-----------------|
| 06:00-13:00 | 14 | 5.9 | 11 | 43% (but forked separate jobs) |
| 13:30-18:58 | 14 | 33.4 | 103 | 71% (truly no work dispatched) |
