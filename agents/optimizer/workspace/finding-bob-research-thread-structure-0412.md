# Finding: Bob Research Thread Structure Analysis (Apr 12, 2026)

## Summary

Bob's research threads (via `parallel-research` workflow) are the **single largest uncontrolled cost center** in the system. No structural caps exist. Research threads consume 52% of Bob's total ops, with individual sessions regularly hitting 79-113 ops. The `parallel-research` workflow amplifies cost by running 2-3 threads simultaneously, each uncapped, plus a synthesis step that can itself run 113 ops.

## How Research Threads Work

### The parallel-research Workflow

Located at `agents/shared/workflows/parallel-research.ts`, this workflow:

1. **FORK**: Runs N research threads in parallel via `Promise.allSettled` (max 5 threads)
2. **COLLECT**: Gathers results from all threads
3. **SYNTHESIZE**: Runs a separate agent call to find cross-thread connections

### How Bob Uses It

Bob's heartbeat dispatches research via `workflow.run('parallel-research', ...)`. His `heartbeat.md` explicitly instructs this pattern with examples. Each heartbeat that triggers a parallel-research run spawns 2-3 child sessions plus a synthesis session.

### The Flow

```
Bob Heartbeat (5-18 ops)
  └─ workflow.run('parallel-research')
       ├── Research Thread 1 (10-79 ops) — runs as callAgent → often triggers D-o-R internally
       ├── Research Thread 2 (10-79 ops) — same
       └── Research Synthesis (7-113 ops) — separate callAgent with all thread results
```

## The Problem: No Caps at Any Level

| Layer | Cap? | Reality |
|-------|------|---------|
| `parallel-research` workflow | Max 5 threads | Only limits thread count, not ops per thread |
| Research thread task prompt | None | No budget text in thread task template |
| Synthesis task prompt | None | No budget text in synthesis template |
| D-o-R (when triggered by thread) | 15-op text cap on P1 | Ignored (93-op violation observed) |
| Infrastructure | None | No `maxOps` parameter on `runAgent()` |

## Data: Research Thread Cost Analysis

### Parallel-Research Invocations (Apr 11-12)

| Parent Session | Started | # Children | Total Child Ops | Worst Thread |
|----------------|---------|------------|-----------------|-------------|
| s_...1662 | Apr 11 22:24 | 4 | 227 | 79 ops (×2) |
| s_...1715 | Apr 12 00:23 | 3 | 74 | 49 ops |
| s_...1730 | Apr 12 00:53 | 3 | 38 | 21 ops |
| s_...1745 | Apr 12 01:23 | 3 | 166 | 113 ops (synthesis!) |
| s_...1761 | Apr 12 01:53 | 2 | 17 | 14 ops |
| s_...1778 | Apr 12 02:23 | 2 | 105 | 93 ops (P1 cap violation) |

**Total**: 627 child ops across 6 parallel-research invocations in ~4 hours. Average 105 ops per invocation.

### High-Op Research Sessions (>40 ops)

| Session | Ops | Type | Task |
|---------|-----|------|------|
| s_...1759 | 113 | Synthesis | Guard internalization × KB integration cross-ref |
| s_...1787 | 93 | Thread (D-o-R P1) | KB INDEX batch integration |
| s_...1663 | 79 | Thread | EXP-131 + EXP-134 KB integration |
| s_...1664 | 79 | Thread | EXP-135 + EXP-140 KB integration |
| s_...304 | 70 | Synthesis | Cascade dynamics cross-ref |
| s_...1354 | 51 | Thread | EXP-130 KB integration |
| s_...1665 | 51 | Thread | EXP-132 + EXP-138 KB integration |
| s_...1725 | 49 | Thread | EXP-123 hypothesis integration |

### Overall Research Session Stats

- **Research Threads**: n=27, avg 33.2 ops, total 897 ops, max 93
- **Research Synthesis**: n=10, avg 28.0 ops, total 280 ops, max 113
- **Combined**: 1,177 ops across 37 sessions = **31.8 ops/session avg**

## Why Research Threads Are So Expensive

### 1. Double-Workflow Nesting
Research threads themselves often trigger D-o-R internally. When heartbeat.md says to use `workflow.run('deliver-or-report', task)` for knowledge work, and a parallel-research thread gets a knowledge integration task, the thread's agent session triggers ANOTHER D-o-R workflow inside the research thread. This creates:
```
parallel-research
  └── Research Thread → D-o-R Phase 1 (93 ops!) → Phase 2 → Phase 3
```

### 2. KB Integration Tasks Are Inherently High-Op  
The research tasks Bob dispatches (INDEX updates, experiment integration, hypothesis writing) require reading 5-10+ files and writing 2-5 files. Even without nesting, these are 30-50 op tasks.

### 3. Synthesis Step Unbounded
The synthesis step receives ALL thread results as context (up to 3000 chars × N threads) and is told to "write synthesis to a markdown file". No budget cap. The 113-op synthesis session is evidence this can spiral.

### 4. Thread Count × Ops = Multiplicative Cost
Running 3 threads at 50+ ops each = 150+ ops in a single heartbeat-triggered batch. This happens every 30 min.

## Concrete Fix Recommendations

### Fix 1: Add Budget Caps to parallel-research (Easy, High Impact)

In `parallel-research.ts`, modify the thread task template:

```typescript
// Current (no budget):
const threadTask = `## Research Thread: ${label}\n\n${thread.task}\n\n` +
  `Write your findings to a file. Be thorough but focused.`;

// Fixed (with budget):
const threadTask = `## Research Thread: ${label}\n\n${thread.task}\n\n` +
  `**BUDGET: 25 TOOL CALLS MAX.** Write findings to a file. Be focused, not exhaustive.\n` +
  `If you've used 20 tool calls, STOP and write what you have NOW.`;
```

Same for synthesis:
```typescript
const synthTask = `## Task: Research Synthesis\n\n` +
  `**BUDGET: 15 TOOL CALLS MAX.**\n\n` +
  `${synthesisInstructions}\n\n...`;
```

**Estimated savings**: Caps threads at ~25 (from avg 33) and synthesis at ~15 (from avg 28). Saves ~20-30% of research ops if text caps are respected.

### Fix 2: Infrastructure maxOps (Medium difficulty, Highest Impact)

Add a `maxOps` parameter to `ctx.runAgent()` that hard-terminates sessions at the budget. This is the **only reliable fix** since text-based caps are ignored 20-30% of the time.

```typescript
const phase1 = await ctx.runAgent("bob", phase1Prompt, { maxOps: 15 });
```

### Fix 3: Prevent D-o-R Nesting Inside Research Threads (Easy)

Add to the parallel-research thread task template:
```
⛔ DO NOT call workflow.run() or callAgent(). Write deliverables directly.
```

This prevents the double-workflow nesting (parallel-research → D-o-R) that caused the 93-op P1.

### Fix 4: Reduce Research Frequency (Behavioral)

Bob currently triggers parallel-research on ~every other heartbeat (6 invocations in 4 hours = every 40 min). Consider:
- Rate-limiting to max 1 parallel-research per 2 hours
- Requiring a cooldown between research batches
- Reducing default thread count from 2-3 to 1-2

## Cost Impact

Current research thread cost (extrapolated):
- 627 ops / 4 hours × 24 = **~3,762 ops/day** from research threads alone
- At ~$0.047/op: **~$177/day** ($5,310/month)
- Bob's total is ~$107/day, so research is **~60%+** of Bob's cost (research costs span across heartbeat + thread sessions)

If budget caps reduce avg thread ops from 33 to 20 and synthesis from 28 to 15:
- Projected: ~2,400 ops/day → **saves ~1,362 ops/day (~$64/day, ~$1,920/month)**

## Priority

**HIGH** — This is the single largest optimization opportunity remaining after the D-o-R P1 cap fix. Research threads are uncapped, frequent, and individually expensive. Fixes 1 and 3 can be deployed immediately with simple prompt changes.
