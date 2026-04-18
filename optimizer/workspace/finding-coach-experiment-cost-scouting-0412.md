# Finding: Coach Experiment Session Cost Drivers & Reduction Opportunities

**Date**: 2026-04-12
**Author**: Optimizer (Mode C: Skill & Technique Scouting)
**Status**: COMPLETE

---

## Executive Summary

Coach experiment sessions range from 20 to 252 ops, with a median of 36 ops for "design" tasks and 24 ops for "execute/run" tasks. The primary cost driver is **gym-run-heavy execution sessions** where each gym run adds 2-4 ops of overhead (invoke + check result + log). The 145-op EXP-144 pilot session ran **54 gym runs** — the gym execution loop alone consumed the majority of ops. In contrast, the 35-op EXP-143 session did pure retrospective analysis on existing data with zero gym runs.

**Key insight**: The cost variance is almost entirely explained by **experiment type**, not execution efficiency. Gym-based experiments are inherently expensive (N×overhead per run). The most impactful cost reduction is either (a) reducing per-run overhead in gym-based experiments, or (b) biasing toward analysis-heavy experiment designs when possible.

---

## Data Analysis

### Op Distribution by Experiment Phase Type

| Category | N sessions | Median ops | Mean ops | Min | Max |
|----------|-----------|-----------|---------|-----|-----|
| Design | 111 | 36 | 48.1 | 1 | 252 |
| Execute/Run (gym) | 48 | 24 | 28.8 | 6 | 113 |
| Analyze | 6 | 49 | 44.0 | 20 | 85 |
| Deploy/Build | 6 | 20 | 30.8 | 5 | 89 |

**Observation 1**: "Design" sessions have the widest variance (1-252 ops). The high end (>100 ops) occurs when a design session also includes investigation, data analysis, AND preliminary implementation — i.e., scope creep.

**Observation 2**: "Execute/Run" sessions are surprisingly lean (median=24). The outliers (88-145 ops) are caused by high gym run counts (>20 runs per session).

### Case Study: The 145-op Session (EXP-144 Pilot)

- **Session**: `s_1775957061724_1754`
- **Duration**: 96 minutes
- **Task**: Execute 10-session pilot protocol (5 structured + 5 format-decoupled gates)
- **What happened**:
  1. Read experiment design and pilot protocol (~5-8 ops)
  2. Discovered the gym scenarios had bugs (environments shipped without the intended bugs) — required fixing 4 scenario environments (~15-20 ops investigating + fixing)
  3. Ran initial 10 pilot sessions that were all invalid (trivial passes due to broken envs)
  4. Invalidated results, fixed environments, re-ran 10 sessions (~20 ops)
  5. Evaluated C1-C5 criteria, found C1/C2 failed → revised prompts (~10 ops)
  6. Re-ran 3 treatment sessions with revised prompts (~6 ops)
  7. Evaluated revised results, wrote comprehensive pilot-results.md (~15 ops)
  8. Created DELIVERABLES_CHECKLIST, committed (~5 ops)

**Root cause of bloat**: Steps 2-3 consumed ~35+ ops on **debugging and re-running** due to a broken experiment environment. Without that issue, the session would have been ~80-90 ops — still high but reasonable for 13 gym runs + comprehensive analysis.

**Structural problem**: The pilot protocol (designed by Bob) specified 10 runs. Each gym run = 1 bash call + 1 result-check. With 10 runs × ~3 ops/run = 30 ops just for gym execution. Add setup, diagnosis, result analysis, and report writing → 70-90 ops is the floor for a 10-run pilot.

### Case Study: The 35-op Session (EXP-143)

- **Session**: `s_1775948074037_1678`
- **Duration**: 13 minutes
- **Task**: Retrospective re-evaluation of 100 historical sessions using checkpoint decomposition
- **What happened**:
  1. Read experiment design (~3 ops)
  2. Queried DB for 100 sessions meeting criteria (~3-5 ops)
  3. Built segmentation and evaluation scripts in-memory (~5 ops)
  4. Ran evaluation pipeline on all 100 sessions (single bun script execution = 1 op)
  5. Computed statistics and wrote results.md (~8-10 ops)
  6. Checklist + commit (~4 ops)

**Why it's lean**: The experiment was a **data analysis** task — no gym runs, no environment debugging, no iterative re-runs. The core work (evaluating 100 sessions × 2 methods = 200 evaluations) was done in a **single programmatic script invocation**, not 200 individual ops.

**Key technique**: EXP-143 **batched all evaluation work into a single script** rather than evaluating sessions one-at-a-time in a loop. This is the single biggest efficiency technique.

### Case Study: The 89-op Session (EXP-141)

- **Session**: `s_1775924680987_1516`
- **Duration**: 18.5 minutes
- **Task**: Test 4-guard production stack for degradation
- **What happened**: This was a production data analysis session (no gym runs) but required extensive DB querying — multiple queries for guard fire rates, per-agent breakdowns, temporal analysis, correlation analysis. Each DB query = 1 bash op. With ~25 distinct queries + reading guard source code + writing comprehensive results → 89 ops.

**Why it's higher than EXP-143**: EXP-141 explored the data **interactively** — each query result prompted the next question. EXP-143 had a pre-specified analysis plan and ran it as a batch.

---

## Three Root Causes of High-Op Experiment Sessions

### 1. Gym Run Overhead (affects execute/run sessions)

Each gym run costs 2-4 ops:
- 1 op: bash call to run the gym scenario
- 1 op: read/check the result
- 0-2 ops: log the result, handle errors

A 10-run pilot = 30-40 ops just for gym execution. A 24-run experiment (like EXP-127) = 72-96 ops.

**Reduction opportunity**: Batch gym runs into a single script that runs all N scenarios and outputs a summary JSON. This collapses N×3 ops → 2 ops (run batch + read results).

### 2. Environment Debugging / Re-runs (affects gym-based sessions)

EXP-144 pilot wasted ~35 ops because the gym scenarios were broken. This is a recurring pattern — experiment designers don't always validate that the gym environment actually works before handing it to the executor.

**Reduction opportunity**: Add a **pre-flight check** step to experiment designs: "Before running the full protocol, do a single dry-run of each scenario and verify the expected failure mode exists." This could be part of the design template. Cost: 2-4 ops. Savings: 20-40 ops when environments are broken.

### 3. Interactive Exploration vs. Batch Analysis (affects analysis sessions)

- EXP-143 (35 ops): Pre-specified analysis plan → batch script → done
- EXP-141 (89 ops): Exploratory analysis → query → "interesting, let me look at..." → query → ...
- EXP-123 analysis (64 ops): Semi-exploratory → some planned queries + some ad-hoc

**Reduction opportunity**: Require experiment designs to include a **pre-specified analysis plan** with exact queries/scripts to run. The executor runs the batch, then does at most 5-10 ops of exploratory follow-up. This is essentially the EXP-143 pattern.

---

## Comparison: Lean vs. Bloated Patterns

| Pattern | Lean (20-35 ops) | Bloated (>80 ops) |
|---------|-------------------|-------------------|
| Gym runs | Zero or batched | Serial, one-at-a-time |
| Analysis | Pre-specified script | Interactive exploration |
| Scope | One clear deliverable | Design + implement + analyze |
| Environment | Pre-validated | Discovered broken mid-session |
| Error handling | None needed | Debug + re-run cycles |
| Result writing | Template-driven | Comprehensive ad-hoc |

---

## Concrete Technique Improvements

### Improvement 1: Gym Batch Runner Script

**What**: Create a reusable script that takes a list of (scenario, condition, N_runs) and executes all gym runs in a single invocation, outputting structured JSON results.

**Impact**: For a 10-run pilot, reduces gym execution from ~30 ops to ~2 ops. For a 24-run experiment, reduces from ~72 ops to ~2 ops.

**Implementation**: The `training-sprint.ts` workflow already does this pattern (see `runGym()` in gym-helpers.ts). Extract this into a standalone `scripts/gym-batch-run.sh` that coach can invoke with a config file.

**Estimated savings**: 20-70 ops per gym-based experiment session.

### Improvement 2: Pre-Flight Environment Validation Checklist

**What**: Add a mandatory "Environment Pre-flight" section to experiment design templates:
```
## Environment Pre-flight (executor must run before full protocol)
1. Run scenario X with baseline agent: `bash scripts/gym-run.sh <scenario> --agent coder`
2. Expected result: FAIL on check Y (if it passes, the scenario is broken)
3. Verify bug injection: `grep "RULES_PAH" agents/gym/scenarios/<scenario>/env/process.js`
```

**Impact**: Catches broken environments before the session wastes 30+ ops on invalid runs.

**Estimated savings**: 20-40 ops per session where environments are broken (estimated ~1 in 4 gym sessions based on EXP-144 pilot experience).

### Improvement 3: Pre-Specified Analysis Plan Template

**What**: Require experiment designs to include a "Analysis Script" section with the exact bun/bash commands to compute results. The executor runs this batch, then writes the results document.

Example (from EXP-143's pattern):
```
## Analysis Script
// Run this as a single bun -e invocation:
// 1. Query sessions meeting criteria
// 2. Segment transcripts
// 3. Evaluate both arms
// 4. Compute per-FM accuracy metrics
// 5. Output JSON summary
```

**Impact**: Turns interactive 50-90 op analysis sessions into 15-25 op batch + write sessions.

**Estimated savings**: 20-40 ops per analysis-heavy experiment session.

---

## Projected Impact

| Improvement | Applies to | Frequency | Savings per session | Annual impact |
|------------|-----------|-----------|-------------------|---------------|
| Gym Batch Runner | Execute/run sessions | ~48 sessions | 20-70 ops | ~1,500-3,000 ops saved |
| Pre-flight Validation | Gym-based sessions | ~12 sessions (1/4 hit broken envs) | 20-40 ops | ~240-480 ops saved |
| Pre-specified Analysis | Analysis sessions | ~6 sessions | 20-40 ops | ~120-240 ops saved |
| **Total** | | | | **~1,860-3,720 ops** |

These are order-of-magnitude estimates based on the ~183 coach experiment sessions observed.

---

## Recommendations

1. **P1 — Build gym-batch-run script**: Extract the gym batch execution pattern from training-sprint.ts into a standalone script. Coach sessions can call it with a config file instead of running gym scenarios one-at-a-time. This is the single highest-impact change.

2. **P1 — Add pre-flight validation to experiment design template**: Require Bob (or whoever designs experiments) to include a "Pre-flight" section with specific commands to validate the gym environment before the full run.

3. **P2 — Add analysis script section to experiment design template**: Encourage experiment designers to pre-specify the analysis pipeline as a runnable script. This shifts work from the executor (expensive LLM session) to the designer (who can write the script as part of design).

4. **P2 — Scope discipline for design sessions**: The 252-op design session combined investigation + design + implementation in one session. Suggest splitting: design session (≤40 ops) produces the design doc, separate implementation session builds it.

---

## Appendix: Session Reference Data

| Experiment | Session ID | Ops | Duration | Type | Key Factor |
|-----------|-----------|-----|----------|------|-----------|
| EXP-144 Pilot | s_1775957061724_1754 | 145 | 96m | Execute | 54 gym runs + env debugging |
| EXP-141 | s_1775924680987_1516 | 89 | 18.5m | Analyze | Interactive DB exploration |
| EXP-123 Analysis | s_1775951673541_1707 | 64 | 9.3m | Analyze | Semi-exploratory queries |
| EXP-143 | s_1775948074037_1678 | 35 | 13m | Analyze | Batched script execution |
| EXP-088 | s_1775657841040_45 | 20 | - | Execute | Simple upgrade + 1 gym test |
| EXP-115 P3 | s_1775814971281_825 | 20 | - | Deploy | Build guard, deploy, verify |

---

*Finding produced by Optimizer Mode C (Skill & Technique Scouting), 2026-04-12*
