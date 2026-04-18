# Finding: Coder 13-avg Ops Deep Dive (Apr 16)

**Date**: 2026-04-16 07:31 UTC  
**Query window**: Last 6 hours  
**Total sessions**: 393 (235 non-zero, 158 zero-op)

## Key Numbers

| Metric | Value |
|--------|-------|
| Overall avg ops | 8.2 |
| Non-zero avg ops | 13.6 |
| Max | 120 |
| Total ops burned | 3,203 |

## Distribution (bucket view)

| Bucket | Sessions | Ops | % of total ops |
|--------|----------|-----|----------------|
| 0 | 158 | 0 | 0% |
| 1-5 | 67 | 216 | 7% |
| 6-10 | 57 | 439 | 14% |
| 11-15 | 33 | 433 | 14% |
| 16-20 | 38 | 674 | 21% |
| 21+ | 40 | 1,441 | 45% |

**Key insight**: 40 sessions (10% of total) consume 45% of all ops. The long tail is dominant.

## What's in the 21+ tail?

The 43 sessions with ≥20 ops fall into clear categories:

### 1. Gym "job" sessions (test-fixing tasks) — ~20 sessions
- Tasks: "Fix the failing tests in this Express API project" and "Fix the failing tests in this student grade processing pipeline"
- Range: 20-120 ops
- The 120-op outlier is a gym job (Express test fixing)
- **Verdict: Healthy** — these are real coding tasks from the gym. High ops expected for multi-test fixing.

### 2. Workflow "call" sessions with few-shot reference — ~15 sessions  
- Tasks start with "## Reference: How a similar task was handled"
- Range: 22-104 ops
- These are workflow-dispatched coding tasks with few-shot examples injected
- The 104-op and 74-op outliers are both this pattern
- **Verdict: Mostly healthy** but the few-shot reference text bloats the task prompt. The 104-op session is suspicious — may indicate the reference caused confusion rather than helping (per KE-133: few-shot examples can harm discovery tasks).

### 3. Internal platform work (merges, features, cleanup) — ~8 sessions
- Merge review branches (44, 33, 29 ops), add workflow entry type (41 ops), gym scenario creation (42 ops), cleanup tasks (39, 33 ops)
- **Verdict: Healthy** — complex multi-step real work.

## Conclusions

1. **The 13-avg is not bloated** — it's driven by real work (gym tasks + platform development). Zero-op sessions (40%) pull the average down; excluding those gives 13.6 which is reasonable for a coding agent.

2. **Biggest optimization opportunity**: The few-shot workflow sessions (15 of the 43 high-op sessions). If few-shot references are causing confusion on some tasks (KE-133), removing them from discovery-type tasks could shave ops.

3. **No retry/spiral patterns detected** — the high-op sessions are doing different tasks, not retrying the same thing.

4. **158 zero-op sessions** (40%) deserve separate investigation — these are sessions that started but did nothing. Could be cancelled, failed early, or duplicate dispatches.

## Recommendations

- **No action needed on coder ops** — the average is healthy for the workload mix
- **Investigate zero-op sessions** separately — 158 is a lot of wasted session starts
- **Monitor few-shot workflow sessions** — if the 74-104 op ones are underperforming, consider removing references for those task types
