# Finding: Coder Efficiency Analysis — 6h Window (2026-04-16 10:30–16:30)

## Summary
7 coder sessions in last 6h, all workflow-driven. **Zero wasted calls reported** across all sessions — a dramatic improvement from historical patterns (path confusion, env errors). Current cost driver is op count variance, not waste.

## Data

| Ops | Quality | Efficiency | Verdict | Pattern |
|-----|---------|-----------|---------|---------|
| 43 | 0.92 | 0.78 | good | Milestone implementation (iteration 1) — large but productive |
| 25 | 0.88 | 0.68 | acceptable | Session startup reduction (iter 2) |
| 21 | 0.55 | 0.60 | acceptable | Same goal (iter 5) — quality dipped |
| 16 | 0.86 | 0.82 | good | Same goal (iter 4) |
| 14 | 0.93 | 0.86 | good | Same goal (iter 3) |
| 13 | 0.28 | 0.42 | needs_improvement | Iter 8 — did admin checkbox edits instead of real work |
| 9 | 0.62 | 0.55 | acceptable | Iter 9 |

**Avg ops: 20.1 | Avg quality: 0.72 | Avg efficiency: 0.67**

## Key Findings

### 1. Zero wasted calls — waste pattern eliminated
All 7 sessions show `wastedCalls=0`. Compare to historical coder sessions which averaged 5-25 wasted calls (path confusion, env errors, blind overwrites). The persistent-task workflow + workflow-only dispatch appears to have eliminated the classic failure modes.

### 2. The 43-op outlier is fine
The highest-op session (43) was iteration 1 of a milestone implementation — new code, not rework. Quality 0.92. Only issue was FM-3.3 (finish without verification), recovered cleanly. This is appropriate cost for a greenfield task.

### 3. Real problem: iteration fatigue (iter 5-9)
Quality degrades in later iterations of the same persistent task:
- Iters 1-4: avg quality 0.90, avg efficiency 0.79
- Iters 5-9: avg quality 0.48, avg efficiency 0.52

Iter 8 (13 ops, q=0.28) did checkbox edits instead of real work — classic "task drift" when the goal becomes stale. This is the main cost sink: not wasted tool calls, but entire sessions that produce marginal value.

### 4. All sessions are workflow-driven
100% (7/7) used workflows. No ad-hoc coder sessions. This is good discipline from the dispatch layer.

## Recommendations

1. **Cap persistent task iterations** — After 5-6 iterations on the same goal, auto-escalate for re-scoping rather than continuing to iterate with diminishing returns.
2. **No action needed on waste** — The historical patterns (path confusion, env guessing, blind overwrites) are absent in this window. Whatever fixed them (workflow structure, better prompts, or model improvements) is working.

## Comparison with Historical

| Metric | Historical (pre-workflow) | Current 6h window |
|--------|--------------------------|-------------------|
| Avg wasted calls | 5-25 | 0 |
| Path confusion incidents | ~40% of sessions | 0% |
| Avg quality | 0.45 | 0.72 |
| Workflow usage | ~30% | 100% |
