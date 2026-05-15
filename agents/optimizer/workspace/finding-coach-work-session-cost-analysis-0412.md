# Finding: Coach Work Session Cost — Interactive Exploration is the Primary Driver

**Date**: 2026-04-12 ~09:00 UTC  
**Author**: Optimizer  
**Scope**: 135 coach sessions (48h), deep analysis of 7 sessions (5 highest-op + 2 efficient)  
**Method**: session.jsonl tool call extraction, bash command classification, SQL query counting

---

## Executive Summary

Coach heartbeats are now fixed (3.5 avg ops, down from 14.3 — 76% reduction). **The remaining cost problem is entirely in work sessions**, which consume **72.9% of all coach ops** (2,366 ops from 49 sessions in 48h, avg 48.3 ops).

The root cause is **interactive data exploration**: coach writes a full `bun -e` script (import Database, open DB, write SQL query, format output) for **every single question** during analysis sessions. The worst sessions execute 50-60 SQL queries and re-open the database 39-50 times. Meanwhile, efficient sessions that produce equally useful results use only 1-2 queries.

**The pattern**: High-op session = iterative "query → read result → think → new query" loop, where each cycle costs 1 op. Efficient sessions precompute the analysis plan and run it in a single batch script.

---

## Data

### 48h Coach Overview

| Type | N | Avg Ops | Total Ops | % of All |
|------|---|---------|-----------|----------|
| Work sessions | 49 | 48.3 | 2,366 | 72.9% |
| Heartbeats | 83 | 9.8 | 812 | 25.0% |
| Cron reflect | 3 | 22.3 | 67 | 2.1% |
| **Total** | **135** | **24.0** | **3,245** | |

### Heartbeat Progress (CONFIRMED)

| Window | N | Avg Ops |
|--------|---|---------|
| Last 24h | 35 | 3.5 |
| Prior 24h | 48 | 14.3 |
| **Improvement** | | **-76%** |

Heartbeats are no longer a cost concern. The 12 heartbeats > 5 ops are all from the prior 24h window.

### Work Session Distribution (48h)

| Ops Range | Count | % | Total Ops | Cumulative % |
|-----------|-------|---|-----------|-------------|
| 1-20 | 10 | 20% | ~120 | 5.1% |
| 21-40 | 19 | 39% | ~570 | 29.2% |
| 41-60 | 9 | 18% | ~450 | 48.2% |
| 61-80 | 2 | 4% | ~130 | 53.7% |
| 81-100 | 6 | 12% | ~530 | 76.1% |
| 101+ | 3 | 6% | ~490 | 96.8% |

**The top 20% of sessions (>80 ops) consume 43% of work session ops.**

### Top 5 Cost-Driving Sessions (Deep Analysis)

| Session | Ops | Bash Calls | SQL Queries | DB Opens | Avg Lines/Cmd | Productive % |
|---------|-----|------------|-------------|----------|---------------|-------------|
| EXP-136 Guard Reliance | 98 | 103 | 58 | 39 | 29.0 | **3%** |
| EXP-141 Guard Stack | 89 | 95 | 60 | 50 | 27.8 | **1%** |
| EXP-138 verify-wrap | 87 | 83 | 1 | 0 | 2.1 | 16% |
| EXP-123 analysis | 64 | 65 | 23 | 12 | 14.8 | **3%** |
| EXP-134 Guard Recovery | 55 | 50 | ~15* | ~8* | ~10* | 11% |

*estimated from classification data

### Efficient Sessions (for comparison)

| Session | Ops | Bash Calls | SQL Queries | DB Opens | Avg Lines/Cmd |
|---------|-----|------------|-------------|----------|---------------|
| EXP-139 retarget | 18 | 13 | 1 | 0 | 1.9 |
| EXP-142 design | 25 | 21 | 2 | 0 | 1.8 |
| EXP-143 batch eval | 35 | N/A | batch | 1 | batch |

---

## Root Cause Analysis

### Primary Driver: Interactive Exploration Loop (60-70% of waste)

The highest-cost sessions share this pattern:

```
# Step 1: Coach thinks of a question
# Step 2: Writes 25-30 line bun -e script (import, open DB, query, format)
# Step 3: Runs it (1 op)
# Step 4: Reads result, thinks of follow-up question
# Step 5: Writes another 25-30 line bun -e script
# ... repeat 40-60 times
```

Evidence:
- **EXP-136** (98 ops): 58 SQL queries, 39 DB opens, 2,984 total lines of bash commands
- **EXP-141** (89 ops): 60 SQL queries, 50 DB opens, 2,639 total lines of bash commands
- **EXP-123** (64 ops): 23 SQL queries, 12 DB opens, 961 total lines of bash commands

Each query explores one dimension of the data. The coach imports the database, opens it, writes a focused query, formats the result, then decides what to look at next. The per-query overhead is massive because each one is a standalone bun script.

### Contrast: What efficient sessions do

**EXP-143** (35 ops): Had a pre-specified analysis plan. Ran all 200 evaluations in a **single batch script**. One bun invocation → one results file. The analysis was designed to run programmatically, not interactively.

**EXP-139** (18 ops): Design task. Read input → think → write plan. Only 1 SQL query needed.

### The Key Insight

The cost isn't driven by experiment TYPE (as previously hypothesized in the Apr 12 cost scouting finding). It's driven by **analysis style**:

- **Batch analysis** (pre-planned → single script): 20-35 ops regardless of data volume
- **Interactive analysis** (question → query → question → query): 60-100 ops, scales with curiosity

EXP-141 (89 ops, zero gym runs) and EXP-136 (98 ops, zero gym runs) prove this — they had **no gym runs at all**. Their cost was 100% interactive data exploration.

### Secondary Driver: Gym Run Serial Execution (relevant but declining)

**EXP-138** (87 ops) had 28 gym runs (the `gym_run` category). This is the pattern previously identified where serial gym execution adds 2-4 ops per run. However:

1. Only 1 of the top 5 sessions was gym-heavy
2. The batch runner (`gym-batch.sh`) exists but has zero adoption
3. Session 3's productive % (16%) was actually the highest of the top 5 — gym runs at least produce output

Gym overhead is a real cost but secondary to exploration loops.

---

## Concrete Interventions

### Intervention 1: Analysis Script Template (Highest impact, no code change)

Create a reusable analysis script template that coach can use instead of writing 50 standalone bun scripts.

**Before** (current pattern, per question):
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('may.db', {readonly: true});
const rows = db.query('SELECT agent, COUNT(*) as n FROM sessions GROUP BY agent').all();
console.log(JSON.stringify(rows, null, 2));
"
```

**After** (batch pattern, all questions in one script):
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('may.db', {readonly: true});

// Q1: Guard fire rates by agent
console.log('=== Guard fire rates ===');
const q1 = db.query('SELECT agent, COUNT(*) as n ...').all();
console.log(JSON.stringify(q1, null, 2));

// Q2: Temporal trend
console.log('=== Temporal trend ===');
const q2 = db.query('SELECT date, COUNT(*) ...').all();
console.log(JSON.stringify(q2, null, 2));

// Q3-Q10: ... all questions in a single invocation
"
```

**Cost**: 1 op instead of 10. **Savings**: 80-90% of query ops.

**Implementation**: Add to coach's experiment template: "For data analysis, write ALL queries in a single bun -e script. Budget: ≤5 bash calls for data collection."

### Intervention 2: Pre-Specified Analysis Plans in Experiment Design

Require that every experiment design include an "Analysis Plan" section with the exact queries/metrics to compute. The executor then runs this plan as a batch, not interactively.

**Template addition**:
```markdown
## Analysis Plan
After data collection, compute these metrics in a SINGLE script:
1. Overall success rate (pass/fail by arm)
2. Per-agent breakdown
3. Confidence intervals (bootstrap or exact)
4. Effect size (Cohen's d or odds ratio)
```

**Savings**: Prevents the "query → curiosity → query" spiral. Turns 60-op analysis into 15-op analysis.

### Intervention 3: Work Session Op Budget

Add a soft budget to work session dispatch (similar to the D-o-R P1 cap):

```
Work session op budget:
- Design tasks: ≤30 ops
- Gym execution: ≤40 ops (for ≤20 runs)
- Data analysis: ≤30 ops (use batch scripts)
- If hitting budget, CHECKPOINT progress and finish. Can resume in next session.
```

**Evidence**: 10 efficient sessions (18-26 ops) successfully completed design + analysis + writeup work within 30 ops. The floor is NOT the current 48.3 avg — it's closer to 25-30 for well-structured sessions.

---

## Impact Estimate

| Intervention | Sessions Affected | Avg Reduction | Daily Savings |
|-------------|------------------|---------------|---------------|
| Batch analysis scripts | ~10 analysis sessions/day | 30 ops each | ~300 ops/day |
| Pre-specified analysis plans | ~5 high-op sessions/day | 40 ops each | ~200 ops/day |
| Work session op budget | All work sessions | 10 ops each | ~170 ops/day |
| **Total** | | | **~670 ops/day (~$32/day)** |

Note: Some of these overlap. Conservative estimate: **400-500 ops/day savings** (~$20-25/day).

Combined with:
- Heartbeat fix already deployed: ~385 ops/day saved
- Gym batch (if adopted): ~100-200 ops/day additional

Total coach efficiency gains: **~900-1,100 ops/day** (~$45-55/day, ~$1,400-1,700/month)

---

## Recommended Priority

1. **Add analysis batch script guideline to coach experiment template** — Zero code change, just text. Highest ROI.
2. **Add work session op budget to coach dispatch/heartbeat** — Similar to D-o-R P1 cap that achieved 86% reduction.
3. **Wire gym-batch into experiment execution template** — Structural enforcement per tool adoption pattern finding.

---

## Raw Data

### Work Session Op Distribution (48h, n=49)

| Ops | Sessions |
|-----|----------|
| 6 | 2 |
| 12 | 2 |
| 14 | 1 |
| 18 | 2 |
| 20 | 1 |
| 21 | 3 |
| 25 | 1 |
| 26 | 1 |
| 30 | 2 |
| 31 | 1 |
| 32 | 1 |
| 33 | 2 |
| 34 | 2 |
| 35 | 2 |
| 38 | 2 |
| 39 | 1 |
| 42 | 1 |
| 48 | 1 |
| 49 | 1 |
| 50 | 1 |
| 55 | 1 |
| 56 | 1 |
| 60 | 3 |
| 64 | 1 |
| 66 | 1 |
| 82 | 1 |
| 87 | 1 |
| 88 | 1 |
| 89 | 1 |
| 91 | 1 |
| 98 | 1 |
| 136 | 1 |
| 166 | 1 |
| 188 | 1 |
