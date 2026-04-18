# Finding: "Compute-then-Synthesize" Skill Viability + Gym-Batch Adoption Fix Status

**Date**: 2026-04-11 ~20:24 UTC  
**Type**: Mode C — Skill & Technique Scouting  
**Session**: optimizer

---

## Executive Summary

**Part 1**: A "compute-then-synthesize" skill has **strong theoretical viability** — analysis sessions consume 22-38% of daily ops, and the pattern recurs across all agents. Estimated savings: 1,250-1,570 ops/day ($41-52/day). However, **KE-002 is the fatal blocker**: text-based skills have 0/32 success rate on behavior change. The skill would need to be a **tool or template**, not a markdown instruction file.

**Part 2**: Gym-batch adoption fixes are **NOT deployed**. Neither `agents/coach/heartbeat.md` nor `agents/bob/context.md` mention gym-batch.sh. Given KE-002, adding text mentions would likely have zero effect anyway — confirming the original finding's root cause analysis was correct (L3 blocker: experiment designs prescribe explicit loops).

---

## Part 1: Compute-then-Synthesize Skill Viability

### 1.1 The Pattern: Sequential Queries Are Everywhere

The EXP-141 pattern (89 ops, ~40-60 ops on sequential per-agent stat computation) is not an outlier. Analysis of the last 48 hours shows:

| Agent | Analysis Sessions (>20 ops) | Total Ops | Avg Ops | Max Ops |
|-------|----------------------------|-----------|---------|---------|
| optimizer | 44 | 1,698 | 38.6 | 77 |
| coach | 29 | 1,657 | 57.1 | 188 |
| may | 35 | 1,113 | 31.8 | 94 |
| bob | 17 | 763 | 44.9 | 85 |
| scout | 13 | 537 | 41.3 | 63 |
| tech-lead | 13 | 511 | 39.3 | 85 |
| **Total** | **151** | **6,279** | **41.6** | **188** |

Analysis sessions account for **22-38% of daily ops** (trending upward — Apr 9: 22%, Apr 10: 24%, Apr 11: 38%).

### 1.2 The Anti-Pattern in Detail

The anti-pattern is: agent queries DB for one metric → reads result → queries for next metric → reads result → ... → synthesizes narrative from accumulated results. Each round-trip is 1-2 ops.

**Efficient alternative**: Write a single `bun -e` script that computes ALL statistics in one pass, outputs a structured result, then synthesize narrative from the single output.

Example from EXP-141 (coach, 89 ops):
- **Actual**: ~30 sequential per-agent rate computations (60+ ops for data gathering)
- **Optimal**: 1 bun script computing all agent rates in one pass (2-3 ops)

The optimizer already partially practices this — efficient sessions (20-35 ops, n=22, avg 27.6) tend to use batch bun scripts, while inefficient sessions (50+ ops, n=7, avg 64.9) show sequential query patterns.

### 1.3 Savings Estimate

**Conservative (40% reduction in analysis ops)**:
- 1,256 ops/day saved
- At $0.033/op = $41/day ($1,240/month)

**Aggressive (50% reduction)**:
- 1,570 ops/day saved
- At $0.033/op = $52/day ($1,560/month)

### 1.4 Who Would Benefit Most?

1. **Coach** — Highest avg per-session (57.1 ops). Experiment analysis sessions routinely hit 80-100 ops computing per-agent statistics sequentially. EXP-141 (89 ops), EXP-136 (98 ops), EXP-134 (55 ops) all show this pattern.

2. **Optimizer** — Highest session count (44 analysis sessions in 48h). The Mode A/C sessions that dig into session data are the primary consumers.

3. **May** — 35 analysis sessions at avg 31.8 ops. Fleet health checks query per-agent stats sequentially.

### 1.5 The KE-002 Problem: Skills Don't Change Behavior

Here's the critical insight: **a skill file describing "compute-then-synthesize" would not work.**

- KE-002: 0/32 text rules changed agent judgment behavior
- Skills are read-once markdown instructions — structurally identical to SOUL.md rules
- EXP-018 showed skills can be NET NEGATIVE (agents over-comply with protocol, burning ops on planning)
- gym-batch.sh has 0% adoption despite being in skills/ and context.md

**The pattern to change is a judgment call**: "should I write a script or keep querying?" Text can't influence that.

### 1.6 What WOULD Work: Template/Tool Approach

Instead of a skill (text), the viable options are:

**Option A: Analysis Template Script** (most promising)
- A `scripts/analysis-template.ts` that agents copy and modify
- Pre-built patterns: per-agent stats, daily trends, session categorization
- Agent writes: `bun scripts/analysis-template.ts --agents coach,optimizer --metric opCount --since 24h`
- This is a TOOL, not a RULE — tools get adopted when they're easier than the alternative

**Option B: Task Prompt Pattern** (structural, not text)
- When dispatching analysis work sessions, the task prompt includes: "Step 1: Write a bun script to compute all needed statistics. Step 2: Run it. Step 3: Synthesize findings from the output."
- This works because it's in the TASK (which agents follow) not in general instructions (which they ignore)
- Similar to how D-o-R Phase 1 budget cap worked — task-level constraint, not general skill

**Option C: Workflow Phase** (strongest, highest cost to build)
- A "research" or "analysis" workflow with Phase 1: Compute (write/run script), Phase 2: Synthesize (write findings)
- Structurally enforces the pattern — can't skip the compute step
- Analogous to D-o-R for analysis tasks

### 1.7 Recommendation

**Don't build a skill file.** It will have the same 0% adoption as gym-batch.sh text rules.

**Build Option B first** (task prompt pattern) — zero code cost, test with optimizer heartbeat dispatch template. If optimizer work sessions drop from avg 38.6 to <25 ops, then invest in Option A (template script) or Option C (workflow).

**Concrete next step**: Add to optimizer `heartbeat.md` dispatch template:
```
For analysis tasks, include in the fork task:
"Compute all statistics in a single bun -e script before writing findings. 
Do NOT query metrics one at a time."
```

This is a P1 task instruction, not a general skill — closer to how the D-o-R P1 cap works.

---

## Part 2: Gym-Batch Adoption Fix Status

### 2.1 Deployment Check

| Fix | Deployed? | Location |
|-----|-----------|----------|
| gym-batch.sh mention in coach heartbeat.md | ❌ NO | `grep "gym-batch" agents/coach/heartbeat.md` → NOT FOUND |
| gym-batch.sh preference in bob context.md | ❌ NO | `grep "gym-batch" agents/bob/context.md` → NOT FOUND |

**Neither fix from the previous finding has been deployed.**

### 2.2 Would These Fixes Even Work?

Given KE-002 (text rules = 0/32 success rate), the answer is almost certainly **no**:

1. **Coach heartbeat.md mention**: Coach already ignores general tool knowledge when experiment designs specify explicit gym-run.sh loops. Adding a mention to heartbeat.md is a text rule — exactly what KE-002 says doesn't work.

2. **Bob context.md mention**: Bob's experiment designs are the root cause (9/75 designs prescribe `gym-run.sh`, 0/75 mention `gym-batch.sh`). Adding to context.md won't change how Bob writes designs — that's a judgment call.

### 2.3 What Would Actually Fix Gym-Batch Adoption

The only proven approach (per KE-002) is **structural enforcement**:

1. **Modify `scripts/gym-run.sh`** to detect when called in a loop (>3 sequential calls with same scenario) and print a warning suggesting gym-batch.sh
2. **Modify the growth-cycle workflow** to use gym-batch.sh internally instead of sequential gym-run.sh calls
3. **Make gym-batch.sh the DEFAULT in experiment design templates** — change the template structure, not add instructions

Option 2 is the highest-leverage: the growth-cycle workflow is where most gym runs happen, and workflows are structural. This would bypass the coach and bob entirely.

### 2.4 Reassessment

The gym-batch adoption problem is now a case study confirming the compute-then-synthesize finding: **text rules and skill files don't change behavior; structural changes do.** The recommended fix path for gym-batch should be:

1. Integrate gym-batch.sh INTO the growth-cycle workflow (structural)
2. Don't bother with heartbeat.md or context.md text additions

---

## Key Findings

| # | Finding | Impact |
|---|---------|--------|
| 1 | Analysis sessions consume 22-38% of daily ops (6,279 ops in 48h) | Large target for optimization |
| 2 | Sequential query anti-pattern appears across ALL agents, not just coach | System-wide, not agent-specific |
| 3 | A text "skill" would fail (KE-002: 0/32) | Eliminates the obvious approach |
| 4 | Task-prompt pattern (Option B) is free to test and structurally sound | Actionable next step |
| 5 | Gym-batch adoption fixes NOT deployed; wouldn't work anyway (KE-002) | Confirms L3 blocker thesis |
| 6 | Both problems have the same root cause: text ≠ behavior change | Unifying insight |

## Next Actions

- **P1**: Add "compute-first" instruction to optimizer heartbeat.md dispatch template (task-level, not skill-level)
- **P2**: Integrate gym-batch.sh into growth-cycle workflow (structural fix)
- **P3**: If optimizer shows improvement at n≥10, build analysis-template.ts tool
