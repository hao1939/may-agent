# Finding: May Heartbeat Dispatcher Analysis

**Date:** 2026-04-12
**Agent:** optimizer
**Type:** Feasibility analysis for dispatcher-mode rewrite

## Summary

May's heartbeat averages 22.4 ops (n=96 in 48h) with P90=42 ops, making it the new #1 bloater after tech-lead and optimizer were rewritten to dispatcher mode. A dispatcher rewrite is feasible and should reduce average ops to ~8-12, saving ~500-700 ops/day (~$25-35/day).

However, **May's case is structurally different from tech-lead and optimizer** — May is a dispatcher/coordinator by design, so the inline work is already its core function. The optimization is more nuanced: tighten budget per step, not eliminate steps.

## Current State

### Quantitative Profile (48h, n=96)
| Metric | Value |
|--------|-------|
| Average ops | 22.4 |
| Median ops | 19 |
| P25 | 15 |
| P75 | 25 |
| P90 | 42 |
| Min/Max | 0 / 94 |
| Total ops (48h) | 2,148 |
| Forks (24h) | 11 from 48 heartbeats (23%) |

### Op Distribution
| Bucket | Count | Avg ops | % of total |
|--------|-------|---------|------------|
| 1-10 | 5 | 6.8 | 5% |
| 11-20 | 49 | 15.5 | 51% |
| 21-30 | 24 | 24.3 | 25% |
| 31-40 | 7 | 34.7 | 7% |
| 41+ | 11 | 48.1 | 11% |

**Key observation**: 51% of heartbeats are already in the 11-20 range. The problem is the **long tail** — 18 sessions (19%) at 31+ ops account for ~700 ops, or 33% of total spend.

### Trend
- Prior 12h: avg 16.7 ops (n=24)
- Recent 12h: avg 22.5 ops (n=24) — 35% increase
- The increase correlates with May forking more work sessions (improvement queue items, audits)

## Current Heartbeat Structure (7 Steps)

May's `heartbeat.md` has 7 steps, each with different cost profiles:

### Step 1: Dispatch Work (2-4 ops)
Read injected pending tasks, route to appropriate agent, update dispatch-board.md.
- **Already well-scoped** — just read tasks and dispatch
- **Cost depends on number of pending tasks**
- Usually 2-3 ops (read board, edit board)
- ✅ Keep inline

### Step 2: Follow Up (3-8 ops)
Read dispatch-board.md, check status of active items, update statuses.
- **Variable cost** — depends on board size and number of items to check
- Currently reads board, peeks sessions, updates statuses
- Can bloat when checking multiple items (3-5 peeks)
- ⚠️ **Cap at 3 ops**: Read board once, update based on available info only. Don't peek sessions inline — mark "check next cycle" for unresolved items.

### Step 3: Triage Failures (1-3 ops)
Run DB query for recent errors, route failures to appropriate agent.
- **Single query + decision** — naturally lean
- Bloats only when May investigates failures inline instead of dispatching them
- ✅ Keep inline but add "don't investigate — just dispatch" rule

### Step 4: Research Projects (2-5 ops)
Check `agents/shared/projects/` for active research, dispatch next steps.
- Often finds nothing (projects dormant for days)
- Bloats when May reads project files in detail
- ⚠️ **Cap at 1 op**: Only read project dir listing. If something changed, fork a review session.

### Step 5: System Health (1-2 ops)
Quick check for stuck sessions.
- **Already lean** — single query
- ✅ Keep inline

### Step 6: Improvement Queue (3-10 ops)
Check improvement queue, pick top item, fork a dedicated session.
- **Correctly says to fork**, but in practice May sometimes does work inline
- When the queue is empty, May refills it (3-5 ops reading recent sessions)
- ⚠️ **Enforce fork**: If queue has items, fork ONE. If queue is empty, refill is 2-3 ops max.

### Step 7: End-of-Cycle Reflection (1-5 ops)
Reflection, context.md update, dispatch-board verification.
- **Major bloater** when May commits/pushes context.md changes
- Git operations (commit + push) cost 2-4 ops
- "Verify files" guard compliance adds 2-3 ops
- ⚠️ **Simplify**: Reflection should be 1 op (think + finish). Context.md updates should accumulate and commit once per day, not every cycle.

## What Makes May Different from Tech-Lead/Optimizer

| Dimension | Tech-Lead/Optimizer | May |
|-----------|--------------------|----|
| **Core job** | DO specialized work (review/optimize) | COORDINATE work across team |
| **Inline work** | Was exploring/reviewing inline (wrong) | Is dispatching/following-up inline (correct) |
| **Fork target** | Fork ALL substantive work | Fork audits, reviews, investigations only |
| **Bottleneck** | Did others' work in heartbeats | Follows up too thoroughly in heartbeats |

May's 7 steps are *structurally correct* — they ARE what a dispatcher should do. The problem isn't "wrong work in heartbeats" but "too much depth per step."

## Root Causes of Bloat

### 1. Over-thorough Follow-Up (Step 2)
May peeks multiple sessions to check on dispatched work. Each peek is 1-2 ops. With 10+ active items, this alone can be 10-20 ops.

### 2. Git Commit/Push in Every Cycle (Step 7)
May commits context.md updates to git almost every cycle. That's 2-4 ops of git operations per heartbeat.

### 3. Dashboard Updating (Step 2 + Step 7)
The dispatch-board.md gets read/edited multiple times per cycle — once during follow-up, once during reflection. Two read+edit cycles = 4 ops.

### 4. Improvement Queue Inline Work (Step 6)
When the queue is empty, May reads recent sessions to refill it. This should be a forked session.

### 5. Guard Compliance Overhead (Step 7)
The FM-3.1/FM-3.3 guards require file verification before finish(), adding 2-3 ops per heartbeat.

## Recommended Approach: Budget-Capped Dispatcher

Instead of the tech-lead/optimizer pattern (observe → decide → fork → exit), May needs a **budget-capped version of its current structure**:

### Target: ≤12 ops per heartbeat (from 22.4 avg)

**Budget allocation:**
- Step 1 (Dispatch): 2 ops
- Step 2 (Follow-up): 2 ops (read board once, light update)  
- Step 3 (Triage): 1 op (one query)
- Step 4 (Research): 0-1 ops (skip if nothing changed)
- Step 5 (Health): 1 op
- Step 6 (Improvement): 1-2 ops (fork or skip)
- Step 7 (Reflection): 1-2 ops (finish only, no git)
- **Total: 8-11 ops**

### Key Changes:
1. **Single dispatch-board read/write**: Read once at start, write once at end. No mid-cycle updates.
2. **No git operations in heartbeats**: Context.md changes accumulate. The `agents-auto-commit` cron (10min) handles commits.
3. **No session peeking**: Status updates come from DB queries, not session peeks.
4. **Improvement queue fork-only**: If work needs doing, fork it. Don't assess inline.
5. **Combined observe query**: Like tech-lead/optimizer, one DB query for system snapshot.

## Expected Impact

| Metric | Current | Target | Savings |
|--------|---------|--------|---------|
| Avg ops/heartbeat | 22.4 | 10-12 | 47-55% |
| P90 | 42 | 18-20 | 52-57% |
| Daily ops (48 HBs) | ~1,075 | ~480-576 | ~500-600 ops/day |
| Daily cost savings | — | — | ~$25-30/day |

**Expected reduction: 47-55%** — lower than tech-lead (89%) or optimizer (59%) because May's baseline work is already dispatcher-oriented. The gains come from tightening per-step budgets, not from eliminating wrong-category work.

## Risk Assessment

**Low risk.** May's heartbeat structure stays the same (7 steps, same order). No steps are removed or restructured — only budget-capped. This complies with **KE-008** (no heartbeat restructuring).

The main risk is **information lag** — if May stops peeking sessions, status updates on the dispatch board may be delayed by 1-2 cycles. This is acceptable since:
- Most status tracking can use DB queries instead of peeks
- The `agents-auto-commit` cron ensures changes aren't lost
- Active items that need urgent attention will appear in failure triage (Step 3)

## Comparison with Prior Rewrites

| Agent | Pre | Post | Reduction | Approach |
|-------|-----|------|-----------|----------|
| Tech-lead | 31 avg | 3.4 avg* | 89% | Full dispatcher rewrite |
| Optimizer | 56 avg | 23 avg* | 59% | Budget caps + fork rules |
| **May (projected)** | **22.4 avg** | **10-12 avg** | **47-55%** | **Budget caps per step** |

*Tech-lead measurement window was short (6h post-rewrite). Optimizer measured over longer window.

## Recommendation

**Proceed with draft.** The rewrite is low-risk (content changes only, no structural changes), and even a 47% reduction saves ~$25/day. The draft should:
1. Keep all 7 steps in the same order
2. Add explicit per-step op budgets
3. Add "MUST FORK" rules for audits, reviews, investigations
4. Replace git operations with a note about auto-commit cron
5. Add a combined observe query (like tech-lead Step 1)
6. Keep the improvement queue but enforce fork-only execution
