# Finding: Fast vs Slow Session Techniques — Bob & Tech-Lead Work Sessions

**Date**: 2026-04-14  
**Mode**: C — Skill & Technique Scouting  
**Dataset**: 70 bob + tech-lead work sessions (last 24h), excluding heartbeats  
**Prior art**: finding-lean-vs-bloated-techniques-0413.md, finding-efficient-session-techniques-0412.md

---

## Executive Summary

Work sessions for bob and tech-lead average 25.1 ops (range 3–94, median 15). Three structural patterns separate fast sessions (≤10 ops, n=27, avg 6.3) from slow sessions (>30 ops, n=19, avg 56.1):

1. **Data-in-task** — Sessions with data/results pre-loaded in the task description average **9.6 ops** vs 26.3 without (−16.7 ops, −63%)
2. **Deliverable-specified** — Sessions told *exactly* what to produce average **16.8 ops** vs 28.5 without (−11.7 ops, −41%)  
3. **Explicit budgets** — Sessions with a budget in the task average **20.6 ops** vs 27.5 without (−6.9 ops, −25%)

Total addressable savings: **~200 ops/day** from the 19 slow sessions that lacked these patterns.

---

## 1. The Data

### 1.1 Distribution (70 bob + tech-lead work sessions, 24h)

| Agent | Sessions | Avg Ops | Min | Max | Total Ops |
|-------|----------|---------|-----|-----|-----------|
| bob | 47 | 25.3 | 4 | 93 | 1,191 |
| tech-lead | 23 | 24.6 | 3 | 94 | 566 |
| **Combined** | **70** | **25.1** | **3** | **94** | **1,757** |

### 1.2 Speed Tiers

| Tier | Op Range | Count | Avg Ops | % Has Parent | Avg Task Len |
|------|----------|-------|---------|-------------|-------------|
| Fast | ≤10 | 27 | 6.3 | 70% | 1,232 chars |
| Mid | 11–30 | 23 | 20.0 | 39% | 1,532 chars |
| Slow | >30 | 19 | 56.1 | 63% | 1,475 chars |

### 1.3 Task Category Analysis

| Category | Sessions | Avg Ops | Range | Notes |
|----------|----------|---------|-------|-------|
| Research thread | 13 | 8 | 4–21 | 100% child sessions, always budgeted |
| Deep dive | 17 | 14 | 4–60 | Read-heavy, write-early pattern |
| Process results | 6 | 19 | 4–37 | Data pre-loaded in task |
| Synthesize | 11 | 18 | 4–84 | Budget helps enormously |
| Write hypothesis | 19 | 22 | 4–84 | Wide variance |
| Design | 36 | 29 | 4–93 | Open-ended → bloat risk |
| Review/merge | 19 | 27 | 3–94 | Git ops drive bloat |
| Build script | 14 | 27 | 3–67 | Implementation = more ops |
| Run baselines | 16 | 41 | 4–93 | Gym runs are inherently expensive |
| Fix | 20 | 35 | 6–93 | Investigation spirals |

### 1.4 Call vs Job

| Kind | Sessions | Avg Ops | Median | Notes |
|------|----------|---------|--------|-------|
| call (child) | 40 | 21.1 | 12 | Scoped by parent, often budgeted |
| job (top-level) | 30 | 29.5 | 23 | Self-directed, less constrained |

---

## 2. Three Technique Patterns

### Pattern 1: Data-In-Task (−63% ops)

**What**: Pre-loading data/results directly into the task description eliminates the #1 time sink — discovery.

**Evidence**: 7 sessions with data inline averaged **9.6 ops**. 62 without averaged **26.3 ops**. This is the single strongest predictor of session speed.

**Fast example**: `s_1776115382142_409` (bob, 4 ops) — Task included full EXP-153 results (sample sizes, percentages, p-values). Agent went straight to writing KE-175 and updating hypothesis status. No discovery needed.

**Slow example**: `s_1776117187894_422` (bob, 84 ops) — "Write Bayesian Hypothesis Scorecard Pass 4" gave a list of files to read but no data. Agent spent ~50 ops reading KE entries, priority tracker, previous scorecard before writing.

**Mechanism**: When the parent session already has the data (it dispatched the work!), including it in the task saves the child from re-reading 5–20 source files. This is the "push knowledge" principle (KE-026).

### Pattern 2: Deliverable-Specified (−41% ops)

**What**: Naming the exact output artifact ("Write KE-175", "Script at scripts/batch-merge.sh") constrains the session to produce rather than explore.

**Evidence**: 23 sessions with deliverable specified averaged **16.8 ops**. 46 without averaged **28.5 ops**.

**Fast example**: `s_1776176546016_171` (tech-lead, 3 ops) — "Build a batch merge tool script. Deliverable: Script at scripts/batch-merge.sh" — wrote script immediately.

**Slow example**: `s_1776163966393_44` (bob, 69 ops) — "Design EXP-RECOGNITION" — open-ended design task with no specific artifact named. Agent explored 6+ scenario files, 4 KE entries, existing experiments before converging on a design.

**Mechanism**: Without a named deliverable, the agent optimizes for "understanding" rather than "producing." Understanding is unbounded; producing is not.

### Pattern 3: Explicit Budget (−25% ops)

**What**: Including "Budget: ≤15 tool calls" in the task creates a constraint the agent respects.

**Evidence**: 29 sessions with budget averaged **20.6 ops**. 40 without averaged **27.5 ops**. Bob's research threads all include budgets and average just 8 ops.

**Fast example**: `s_1776174961447_155` (bob, 5 ops) — "Budget: ≤15 tool calls. Synthesize the thread results." — came in well under budget.

**Interaction with other patterns**: Budget alone saves 25%, but combined with data-in-task, the effect is multiplicative — research threads (budgeted + data-loaded) average 8 ops vs 56 for unbounded sessions without data.

---

## 3. What Makes Sessions Slow?

The 19 slow sessions (>30 ops, avg 56.1) share these anti-patterns:

### Anti-pattern A: Open-ended exploration mandate
Tasks like "Design EXP-RECOGNITION" or "Design Pure Judgment Scenarios" give a goal but not a path. The agent reads 10–20 files before committing to a direction. **10 of 19 slow sessions** are design/exploration tasks.

### Anti-pattern B: Undirected read lists
"Read these 6 files and then decide what to do" leads to sequential reading → each file suggests more context → discovery spiral. The Bayesian Scorecard session (84 ops) read 15+ files. **8 of 19 slow sessions** had read lists without inline data.

### Anti-pattern C: Implementation complexity
Scripts, POCs, and review/merge sessions are slow because the work is genuinely complex (git operations, code writing + testing, compilation). These sessions SHOULD be slower — the question is whether they can be decomposed into smaller sub-tasks.

---

## 4. Recommendations

### R1: Dispatcher should push data into child tasks (HIGH IMPACT)

**Change**: When bob or tech-lead dispatches a work session via `agents(call)`, include summarized data in the task description instead of just file paths to read.

**Example**: Instead of "Process EXP-163 results. Read: agents/bob/workspace/exp-163-results.md"  
Do: "Process EXP-163 results. Data: Arm A 12/15 (80%), Arm B 8/15 (53%), p=0.07. Write KE-XXX."

**Where to implement**: Bob's research workflow already does this for research threads (avg 8 ops). Extend the pattern to experiment processing, hypothesis writing, and design tasks.

**Estimated impact**: 19 slow sessions × ~15 ops saved per session = **~285 ops/day saved**. Conservative estimate (not all slow sessions benefit): **~150 ops/day**.

### R2: Always name the deliverable artifact (MEDIUM IMPACT)

**Change**: Every work session task must name the specific file to produce. Add to dispatcher logic.

**Example**: Instead of "Design EXP-RECOGNITION"  
Do: "Design EXP-RECOGNITION. Write: agents/bob/workspace/exp-recognition-design.md"

**Estimated impact**: 46 sessions without deliverable × ~5 ops saved = **~230 ops/day**. Conservative: **~100 ops/day**.

### R3: Default budgets by task type (LOW-MEDIUM IMPACT)

**Change**: Auto-inject budgets based on task category:
- Research synthesis: ≤15 ops
- Process results: ≤15 ops  
- Write hypothesis: ≤20 ops
- Design: ≤35 ops
- Build/implement: ≤40 ops

**Where**: In the deliver-or-report workflow's phase budget allocation.

**Estimated impact**: 40 unbudgeted sessions × ~3 ops saved = **~120 ops/day**. Conservative: **~60 ops/day**.

---

## 5. Cross-reference with Prior Findings

| Prior Finding | Alignment |
|--------------|-----------|
| finding-lean-vs-bloated-techniques-0413 | Confirms delegation (#1 separator there = our call vs job finding). Confirms write-within-5 and bash-streak-breaker. |
| finding-efficient-session-techniques-0412 | Confirms bob's phased workflow (17.7 avg) vs monolithic (31.4). Our data shows similar: budgeted=20.6 vs unbudgeted=27.5. |
| finding-dor-budget-cap-impact-0412 | Budget caps work but can cut sessions short (0-10 ops, 25% success). Our data: fast sessions succeed because they're *structurally* fast, not budget-truncated. |
| KE-026 (Push > Pull) | Directly validated: data-in-task is the strongest speed predictor because it pushes knowledge instead of making agents pull it. |

---

## 6. Summary Impact Estimate

| Recommendation | Ops/day saved | Confidence | Effort |
|---------------|--------------|------------|--------|
| R1: Push data into tasks | ~150 | High | Medium (change dispatcher logic) |
| R2: Name deliverable | ~100 | Medium | Low (add to task templates) |
| R3: Default budgets | ~60 | Medium | Low (config change) |
| **Total** | **~310** | | |

Current baseline: ~1,757 ops/day from 70 work sessions. Potential reduction: **~18%** of work session ops through dispatcher improvements, with no quality loss.
