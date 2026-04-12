# Patch: Coach Work Session Analysis Efficiency Cap

**Date**: 2026-04-12  
**Author**: Optimizer  
**Target**: `agents/coach/heartbeat.md` (Step 3: DISPATCH section)  
**Finding**: `workspace/finding-coach-work-session-cost-analysis-0412.md`

## Problem

Coach work sessions average 48.3 ops (48h, n=49), consuming 72.9% of all coach ops. The root cause is **interactive data exploration**: coach writes a standalone `bun -e` script for every single SQL query, executing 23-60 queries per session. Each query opens the database, runs one SELECT, and prints the result. The worst sessions have 50-60 SQL queries and re-open the database 39-50 times.

Efficient sessions (EXP-143 at 35 ops, EXP-139 at 18 ops) batch all queries into single script invocations.

## Evidence

| Session | Ops | SQL Queries | DB Opens | Productive % |
|---------|-----|-------------|----------|-------------|
| EXP-136 | 98 | 58 | 39 | 3% |
| EXP-141 | 89 | 60 | 50 | 1% |
| EXP-123 | 64 | 23 | 12 | 3% |
| EXP-143 (efficient) | 35 | batch | 1 | N/A |
| EXP-139 (efficient) | 18 | 1 | 0 | N/A |

## Proposed Changes

### Change 1: Add analysis efficiency rule to Error pattern analysis template (Step 3)

After the "Error pattern analysis" template's "Questions to answer:" list, add:

```markdown
⚠️ ANALYSIS EFFICIENCY: Write ALL data queries in a SINGLE bun -e script per analysis phase.
Do NOT write one bun script per question. Batch all queries into one invocation.
Budget: ≤5 bash calls for all data collection. If you need more, you're exploring interactively — stop, plan your remaining questions, then batch them.
```

### Change 2: Add work session op budget to Step 3 header

After "### ⚡ Default: Use workflows for all forked work", before the workflow table, add:

```markdown
### ⚠️ Work Session Op Budget: ≤35 ops

Work sessions avg 48.3 ops but efficient sessions complete equivalent work in 18-35 ops.
- Design tasks: ≤30 ops
- Gym execution: ≤40 ops
- Data analysis: ≤30 ops (use BATCH scripts — one bun -e per analysis phase, not per question)
- If hitting budget: CHECKPOINT progress and finish. Resume in next session.
- The #1 cost driver is interactive query loops. Plan your queries FIRST, then run them all at once.
```

### Change 3: Add batch analysis pattern to context.md

In `agents/coach/context.md`, add:

```
- ANALYSIS EFFICIENCY: When querying data, write ALL queries in a single bun -e script. Do NOT write one bun script per question (this wastes 50+ ops/session). Plan your questions first, then batch them.
```

## Expected Impact

- Target: reduce work session avg from 48.3 to ~30 ops (38% reduction)
- Savings: ~18 ops × ~25 work sessions/day = ~450 ops/day (~$22/day, ~$660/month)
- Combined with heartbeat fix already deployed: ~835 ops/day total coach savings

## Compliance

- **KE-008**: No structural changes to heartbeat steps. All additions are content within existing Step 3.
- **Per tool adoption finding**: Adding to both heartbeat template (Level 2-3) and context.md (Level 4). The template addition is the primary driver; context.md is supplementary.
