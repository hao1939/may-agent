# Finding: Coder 20-Op Average Investigation (Apr 15)

**Mode**: C (Skill & Technique Scouting)  
**Date**: 2026-04-15  
**Data window**: 48h, 30 evaluated coder sessions

## Summary

Coder sessions average 18.9 ops (48h, n=30) — the highest non-outlier average among agents. This is driven by a combination of task complexity, gate friction, and verification overhead rather than inherent inefficiency. The key insight: **low-op sessions aren't just smaller tasks — they have meaningfully higher quality and efficiency scores**.

## Distribution

| Bucket | Count | Avg Ops | Avg Quality | Avg Efficiency |
|--------|-------|---------|-------------|----------------|
| Low (≤12) | 10 | 7.7 | 0.72 | 0.71 |
| Mid (13-24) | 11 | 18.2 | 0.60 | 0.57 |
| High (≥25) | 9 | 31.0 | 0.62 | 0.54 |

**Key stat**: Low-op sessions score +20% quality and +31% efficiency over mid/high. More ops ≠ more quality.

## Root Causes of High Op Counts

### 1. Gate Friction (FM-3.3) — ~3-5 ops wasted per incident
At least 5/30 sessions (17%) mention finish() gate blocks in outcomes. The post-write verification gate triggers on git commits (flagged as "bash-written files"), causing 2-4 extra verification+retry cycles. This is the single largest waste driver.

**Sessions affected**: op=17, 18, 19, 19, 21 — all would be 2-5 ops lower without gate friction.

### 2. Persistent Task Iterations Are Inherently Costly
The "Fix verify-wrap ctx.agent bug" persistent task appears in 7/30 sessions, averaging 17.9 ops per iteration. These sessions involve:
- Reading existing code + understanding context (~3-5 ops)
- Making changes (~3-5 ops)
- Running verification (tsc, vitest) (~3-5 ops)
- Gate compliance + finish (~3-5 ops)

This is a reasonable floor for iterative bug-fix work.

### 3. Multi-Step Operational Tasks (Merge, Build)
- review-merge: 29-44 ops (n=3, avg=35.3) — inherently sequential (checkout, merge, test, repeat per branch)
- build-handler: 19 ops (n=1) — normal for greenfield + verification
- add-workflow-support: 3 ops (blocked by permissions, not truly efficient)

### 4. Reference-Example Task Variance
Sessions with "Reference: How a similar task was handled" context show the widest range: 6-34 ops (n=8). The reference material doesn't consistently help — some sessions use it efficiently (6 ops), others seem confused by it (34 ops, interrupted).

## Efficiency Patterns from Low-Op Sessions

### What makes ≤12 op sessions succeed:
1. **Narrow scope** — Fix-retry tasks with a single file target complete in 5-11 ops
2. **Zero failure chains** — 7/10 low-op sessions have empty failure chains
3. **Direct approach** — No exploratory grep/find sequences, straight to editing
4. **Reference-example sessions that work** — When the reference pattern is clear, sessions finish in 6-8 ops

### Anti-patterns in ≥25 op sessions:
1. **Scope creep** — 3/9 high-op sessions had scope violations (editing files outside spec)
2. **FM-3.3 gate loops** — Verification gate triggers add 3-5 ops
3. **Multi-branch merges** — Sequential per-branch work is inherently expensive (29-44 ops)
4. **Reasoning-action mismatches** — 3/9 high-op sessions show FM-2.6 issues

## Ops/Minute Rate

Average: ~4.8 ops/min across all sessions. No meaningful correlation between rate and session length — coder maintains consistent throughput. The 34-op interrupted session hit 10.4 ops/min (likely due to fast failures).

## Reusable Techniques

### T1: Scope Discipline Reduces Ops
Sessions that stay within spec average 15.3 ops. Sessions with scope violations average 26.7 ops. **Tight delegation constraints save ~11 ops per session.**

### T2: Gate-Aware Workflow
Sessions that proactively verify before finish (read-back after edit, run tests) avoid the 3-5 op gate penalty. The cost of proactive verification: ~2 ops. The cost of gate friction: ~4 ops. **Net savings: 2 ops per session.**

### T3: Fix-Retry Pattern Is Efficient
"Fix Required (attempt 2/2)" tasks average 13.2 ops with clear success criteria. The pattern works because: (a) scope is narrow, (b) verification command is pre-specified, (c) prior attempt provides debugging context.

### T4: Persistent Task Context Loading
Persistent task sessions spend ~5 ops on context loading (reading history, understanding state). This overhead is fixed regardless of task complexity. For simple fixes, this represents 25-45% of total ops.

## Recommendations

1. **Gate calibration**: Git commits should not trigger the post-write verification gate — this would save ~2-5 ops in 17% of sessions. (Filed separately if not already tracked.)
2. **Merge task decomposition**: Instead of one 33-44 op mega-session for 5 branches, dispatch 5 single-branch sessions at ~8 ops each (40 total but parallelizable and individually recoverable).
3. **Persistent task warm-start**: Include a "last session summary" in persistent task context to reduce the 5-op context-loading overhead to ~2 ops.
4. **Reference example curation**: The "How a similar task was handled" reference has high variance (6-34 ops). Audit which reference examples help vs. confuse.

## Data Notes
- All 30 sessions are `kind=call` (delegated by tech-lead/coordinator)
- All sessions show `wastedCalls=0` in evaluations (the evaluator doesn't count gate friction as waste)
- Quality and efficiency scores from the evaluator heuristic may undercount gate-induced waste
