# Finding: Tech-Lead Heartbeat Bloat — 28 avg ops, #1 Spender

**Date**: 2026-04-11 ~06:50 UTC  
**Investigator**: optimizer (Mode B: Tool Gap Analysis)  
**Status**: Root cause identified, fix recommended

## Summary

Tech-lead heartbeats are the **#1 op consumer** across all agents at 28.1 avg ops/heartbeat (8h window). This mirrors optimizer's old problem (pre-dispatcher avg 56 ops → post-fix 3.2 ops). Tech-lead heartbeats do extensive inline exploration — reading code, running tests, analyzing architecture — but **produce zero outputs** (no files modified, no forks spawned).

## Evidence

### 8h Heartbeat Comparison (all agents)

| Agent | Avg Ops | Max Ops | Total Ops (8h) |
|-------|---------|---------|-----------------|
| **tech-lead** | **28.1** | **50** | **449** |
| may | 19.1 | 42 | 306 |
| scout | 14.8 | 46 | 237 |
| coach | 13.4 | 42 | 214 |
| qa | 9.1 | 13 | 145 |
| bob | 7.6 | 42 | 121 |
| evaluator | 5.9 | 11 | 95 |
| **optimizer** | **2.9** | **7** | **49** |

Tech-lead uses **9.7x more ops** than optimizer per heartbeat.

### 24h Stats

- **48 heartbeats** in 24h (every 30 min)
- **1,531 total heartbeat ops** vs 426 work session ops → **78% of all tech-lead ops are heartbeats**
- Median: 31 ops, p75: 42 ops, p90: 50 ops
- Range: 0 - 60 ops
- Distribution: 0-10: 1, 11-20: 2, 21-30: 7, 31-40: 2, 41-50+: 4

### 3 Highest-Op Heartbeats (last 8h)

| Session | Ops | Turns | Duration | What It Did | Output |
|---------|-----|-------|----------|-------------|--------|
| s_...1209 | 50 | 48 | 284s | Ran full test suite (2046 tests), TSC check | **Nothing** |
| s_...1249 | 45 | 52 | 314s | Investigated architecture, search for dead imports | **Nothing** |
| s_...1191 | 42 | 53 | 337s | Code analysis, TSC check | **Nothing** |

### Critical Pattern: Zero Productive Output

Across **all 16 heartbeats in 8h**:
- **Files modified: 0** (every single heartbeat)
- **Forks spawned: 0** (every single heartbeat)
- **1 fork in entire 24h** (1 out of 48 heartbeats = 2% fork rate)

The heartbeats are pure exploration with no action. They read code, run tests, analyze patterns — then exit with observations that disappear.

### What the Heartbeats Actually Do (from digests)

- "108 commits undeployed! That's a lot." → exits
- "The evaluation system has a concrete redundancy" → exits (no fork)
- "Two review branches waiting for merge" → exits
- "Classic TOCTOU race condition in applyContextUpdates()" → exits (no fork)
- "All 2046 tests pass, 138 test files, TSC clean" → exits after running full test suite
- "Guard system (10 files): Well-architected modular design. Not worth consolidating." → exits

Every session finds something potentially interesting, then **exits without acting**. The observations are not persisted anywhere useful.

## Root Cause Analysis

### 1. Heartbeat.md encourages inline exploration (Primary)

The heartbeat has 4 "Lens" modes (Architecture, Flow Complexity, Dead Weight, Fragility) that each encourage deep code exploration. Example from Lens A:
```
"Are there modules that overlap in responsibility? Could they merge?"
```

This is an open-ended question that invites 20-40 ops of reading before it can be answered.

### 2. No fork-by-default discipline

Step 3 says "If you spotted something worth pursuing → Fork a work session" but there's no nudge to fork EARLY. The heartbeat does all the investigation inline, then by the time it reaches Step 3, it's already spent 40+ ops and has nothing left to fork.

### 3. No op budget or guardrail

No mention of op targets. Optimizer's heartbeat says "observe in 1-2 ops" — tech-lead's Step 1 says "1-2 ops" but Steps 2-3 have no budget and routinely consume 25-45 additional ops.

### 4. Test suite runs in heartbeat

Multiple heartbeats ran the full test suite (2046 tests, 138 files). This is a ~5 op operation that belongs in a work session, not a heartbeat health check.

## Comparison: Optimizer Pre/Post Dispatcher Mode

| Metric | Optimizer Pre-Fix | Optimizer Post-Fix | Tech-Lead Now |
|--------|------------------|--------------------|---------------|
| Avg ops/heartbeat | 56 | 3.2 | 31.9 |
| Max ops | 60+ | 8 | 60 |
| Total 8h ops | 451 | 49 | 449 |
| Fork rate | Low | High (forks work) | 2% (1/48) |

Optimizer's fix was identical problem: inline exploration in heartbeats. Dispatcher mode fixed it by limiting heartbeat to observe + fork.

## Recommendation: Rewrite heartbeat.md to Dispatcher Mode

Same fix that worked for optimizer:

1. **Step 1 (OBSERVE): 2-4 ops max**
   - Health check query (1 op)
   - Check pending tasks (1 op)  
   - Glance at todo.md (1 op)
   - That's it.

2. **Step 2 (THINK): 0 ops**
   - Pick a lens based on context, formulate 1-sentence observation.
   - No reading code, no running tests, no multi-file analysis.

3. **Step 3 (ACT): 1-2 ops**
   - If observation warrants it → fork a work session with specific scope.
   - If pending task → fork it.
   - If nothing → exit.

4. **Step 4 (EXIT): 1 op**
   - finish() with observation + what was dispatched.

**Total target: ≤8 ops/heartbeat** (conservative, optimizer achieves ≤7).

## Expected Savings

| Metric | Current | Projected | Savings |
|--------|---------|-----------|---------|
| Avg ops/heartbeat | 31.9 | ~5 | 84% reduction |
| Daily heartbeat ops | 1,531 | 240 | 1,291 ops/day |
| Daily cost savings | - | - | ~$61/day (~$1,830/month) |
| % of tech-lead ops freed | 78% → ~30% | - | Shifts work to productive sessions |

This would be the **single largest efficiency improvement available** after the LiteLLM caching fix ($143/day).

## Risk Assessment

- **Low risk**: Optimizer's identical fix worked first try (56 → 3.2 avg).
- **No functionality loss**: Heartbeat observations are currently discarded anyway.
- **Upside**: Fork-based work sessions produce tracked, persistent outputs instead of ephemeral observations.
