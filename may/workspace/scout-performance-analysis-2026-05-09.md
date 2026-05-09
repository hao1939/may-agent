# Scout Performance Analysis — 2026-05-09

## Summary

Scout's good-session rate is **32.8%** (target: 85%, threshold: 65%) and operational friction rate is **82.4%** (target: 10%, threshold: 30%). Both metrics are in deep breach. This analysis identifies the root causes and recommends fixes.

## Data (Last 24h)

| Metric | Value |
|--------|-------|
| Total scout sessions | 134 |
| Evaluations | 125 |
| Good verdict | 41 (32.8%) |
| Needs improvement | 84 (67.2%) |
| Error sessions | 11 (8.2%) |
| Interrupted sessions | 6 (4.5%) |
| Sessions with "uncommitted changes" friction | 70 (56%) |

## Root Causes

### 1. Uncommitted Changes Friction (56% of all sessions)
70 of 125 evaluated sessions hit "finish blocked by uncommitted changes". This is the **dominant cause** of low good-session rate. Scout writes knowledge files and artifacts but the git worktree has dirty files from other agents, triggering the finish guard. Even when scout self-repairs (commits its own work), the evaluator still logs the friction issue, which either:
- Directly drops the verdict to `needs_improvement`, or
- Triggers a deep review that may downgrade an otherwise good session

**Impact**: If we removed this friction, ~56% of sessions would likely flip from needs_improvement to good, pushing the rate from 32.8% to potentially 70-80%.

### 2. Provider Auth Failures (8.2% error rate)
11 sessions died immediately with "Agent ended without producing a response" — caused by expired GitHub Copilot tokens (401 errors). These get scored at 0.2 quality, dragging down averages.

### 3. Heartbeat Interruptions (4.5%)
6 sessions interrupted mid-work, likely from overlapping heartbeats or resource contention.

## Recommendations

### P0: Fix git worktree isolation for scout
The core problem is that scout shares the `/app/agents` worktree with all other agents. Options:
1. **Separate worktree per agent** — each agent operates in its own git worktree/branch
2. **Pre-session git stash** — stash dirty files before scout runs, restore after
3. **Evaluator heuristic fix** — don't penalize "finish blocked by uncommitted changes" if the uncommitted files belong to other agents (different path prefix)

Option 3 is the fastest fix. The evaluator could check if the dirty files are under `scout/` vs other agent paths.

### P1: Provider auth resilience
Add automatic token refresh or fallback model routing when GitHub Copilot returns 401. This would recover 8% of sessions.

### P1: Evaluator scoring adjustment
Currently, "finish blocked by uncommitted changes" that self-repairs still gets flagged as an issue. If the agent successfully commits its own work, the friction should be discounted. The heuristic labels these as `success_candidate` but deep reviews sometimes downgrade them — 70% of overrides target sessions that were initially `good`.

## Projected Impact

| Fix | Sessions recovered | New good rate |
|-----|-------------------|---------------|
| Git isolation / eval adjustment | ~45 | ~69% |
| Auth resilience | ~8 | ~75% |
| Both | ~53 | ~75-80% |

This would bring Scout good-session rate from 32.8% to within range of the 65% threshold, potentially near the 85% target.
