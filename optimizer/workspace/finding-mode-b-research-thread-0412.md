# Finding: Research Thread Workflow Gap & Tool Adoption Check (Apr 12)

**Mode**: B — Tool Gap Analysis  
**Date**: 2026-04-12  
**Budget**: 25 ops (used ~16)

## 1. Research Thread Sessions — The Problem

### What They Are
Bob's "Research Thread" sessions are KB integration work dispatched via the **`parallel-research` workflow** (`agents/shared/workflows/parallel-research.ts`). The workflow forks N research threads in parallel (Promise.allSettled), then runs a synthesis step to cross-reference findings.

### Why They're Expensive: 79+79+51+18 = 227 ops in One Run

The worst run (`wr_1775946417530_jnvr`) spawned 3 parallel KB integration threads + 1 synthesis agent call:
- Thread 1 (EXP-131 + EXP-134): **79 ops**
- Thread 2 (EXP-135 + EXP-140): **79 ops** 
- Thread 3 (EXP-132 + EXP-138): **51 ops**
- Synthesis: **18 ops**
- **Total: 227 ops** for integrating 6 experiments

### The D-o-R Comparison
The same KB integration work done via D-o-R (Phase 1→2→3) workflows averages **41.8 ops/run** across 52 runs. Some D-o-R runs integrate the same experiments for as low as **16 ops** (e.g., EXP-144 integration via `wr_1775951900732_nv46`).

### Key Metrics

| Approach | Runs | Avg Ops/Run | Worst Run | Notes |
|----------|------|-------------|-----------|-------|
| Research Thread workflow | 11 | **64.1** | 227 | Parallel, no per-thread budget |
| D-o-R workflow (KB integration) | 52 | **41.8** | 127 | Sequential, Phase-budgeted |
| No workflow (raw KB integration) | 58 | **41.4** | ~60 | Unstructured |

### Root Cause: No Budget Caps on Research Threads

The `parallel-research.ts` workflow has **zero budget enforcement**:
- Each thread gets a task with "Be thorough but focused" — but no op cap
- The synthesis step has no budget either
- Parallel execution means N threads × uncapped ops = massive total
- Contrast with D-o-R: "Phase 1: BUDGET: 15 TOOL CALLS MAX", "Phase 2: BUDGET: 25 TOOL CALLS MAX"

### The Specific 79-Op Pattern
Both 79-op sessions (`s_1775946417531_1663`, `s_1775946417555_1664`) were `kind: call` from `source: workflow`. They each integrated 2 experiments into the KB — work that D-o-R handles in ~20 ops with budget caps. The 79-op count suggests the agent explored extensively without constraint.

## 2. Recommendation: Budget-Capped Research Threads

**Estimated savings**: Adding per-thread budget caps of 25 ops would cut avg from 64.1 → ~35 ops/run (**45% reduction**). For the worst case (227→~100 ops), that's **56% savings**.

### Proposed Changes to `parallel-research.ts`:

1. **Add `budgetPerThread` field** to input (default: 30 ops)
2. **Inject budget cap** into each thread's task prompt: `"BUDGET: ${budget} TOOL CALLS MAX"`
3. **Add `synthesisBudget` field** (default: 15 ops)
4. **Cap total threads at 3** for KB integration (currently allows 5)

### Alternative: Route KB Integration Through D-o-R Instead
KB integration is structured, predictable work — it doesn't benefit from parallel-research's fork-join pattern. A simpler approach: stop using `parallel-research` for KB integration entirely and route it through D-o-R with budget caps. Reserve `parallel-research` for genuinely divergent exploration.

## 3. Tool Adoption Check

### session-query
- **10 mentions** in task text, but all from optimizer sessions analyzing data
- **Zero adoption** by bob or other agents for self-service data queries
- Status: **Not adopted** outside optimizer

### gym-batch
- **13 mentions** in task text, all from optimizer sessions
- **Zero usage** by non-optimizer agents (confirmed by DB query)
- Status: **Not adopted** outside optimizer

### gym-batch / session-query Verdict
Both tools remain optimizer-only. No evidence of any agent organically reaching for them. This is consistent with previous Mode B findings — tools don't get adopted without workflow integration or prompt injection.

## 4. Summary

| Finding | Impact | Action |
|---------|--------|--------|
| parallel-research has no budget caps | 64 avg ops/run vs D-o-R's 42 | Add per-thread budget to workflow |
| KB integration uses wrong workflow pattern | +53% overhead vs D-o-R | Route KB work through D-o-R, not parallel-research |
| session-query: zero adoption | Tools are dead | Needs workflow integration to be used |
| gym-batch: zero adoption | Tools are dead | Same — needs prompt injection or workflow |

**Bottom line**: The "Research Thread" pattern is a legitimate workflow for divergent research, but it's being misapplied to structured KB integration work that D-o-R handles more efficiently. Adding budget caps to `parallel-research.ts` and/or routing KB integration through D-o-R would save ~500 ops/day across Bob's research sessions.
