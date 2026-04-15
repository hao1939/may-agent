# Finding: Bob 187-op "Scenario Gap-Fill" Session

**Date**: 2026-04-14  
**Session**: `s_1776147757363_26`  
**Agent**: Bob  
**OpCount**: 187 (12.5× median Bob work session of 15 ops)  
**Duration**: 64.6 minutes  
**Status**: interrupted ("Request was aborted.")  
**Outcome**: No deliverable written (verify-wrap escalated: "1 file(s) missing or empty")  
**Retry**: `s_1776153174909_68` (93 ops, "done") — same objective, narrower scope  
**Total cost**: 280 ops across 2 sessions for one gap-fill analysis  

---

## Root Cause: Create-Test-Fail-Pivot Loop

The session's task was to find gym scenarios with 30-70% baseline pass rates. Bob's approach was:

1. **Phase 1 (ops ~1-50)**: Cataloged existing baselines, tested 2 untested scenarios (hidden-second-bug 3/3, misdiagnosed-regression 3/3). Both ceiling. Checkpoint 1.
2. **Phase 2 (ops ~50-120)**: Created 3 NEW coding scenarios (incomplete-test-coverage, wrong-file-diagnosis, unsafe-optimization). Tested each with 4-6 gym runs. All ceiling (100%). Checkpoint 2.
3. **Phase 3 (ops ~120-187)**: Key insight: "Only JUDGMENT scenarios produce non-ceiling baselines." Pivoted to creating more scenarios and running more baselines. Last message before interruption: testing hex-encoding scenario. Never wrote the deliverable file.

The pattern is **create → test → ceiling → pivot → repeat** — a serial exploration loop where each cycle burns ~20-30 ops (scenario creation: 5-10 ops, gym runs: 3-6 ops × 3-5 trials, analysis: 2-3 ops).

## Gym Run Breakdown

During the 187-op session's time window (06:22–07:27 UTC), gym records show:

| Scenario | Runs | Pass Rate | Verdict |
|---|---|---|---|
| hidden-second-bug | 3 | 3/3 (100%) | Ceiling |
| misdiagnosed-regression | 3 | 3/3 (100%) | Ceiling |
| incomplete-test-coverage | 5 | 5/5 (100%) | Ceiling |
| wrong-file-diagnosis | 4 | 4/4 (100%) | Ceiling |
| unsafe-optimization | 6 | 6/6 (100%) | Ceiling |
| silent-data-corruption | 25 | 5/25 (20%) | **Found non-ceiling!** |
| tangled-inventory | 11 | 5/11 (45%) | **Found non-ceiling!** |
| **Total** | **57** | — | — |

**Key observation**: Bob ran **57 gym trials** in a single session. Each gym run costs 2-4 ops (invoke bash, wait, check result). That accounts for ~115-228 ops just from gym runs — nearly the entire session budget.

The excessive silent-data-corruption runs (25!) suggest Bob was iterating on the scenario design itself — creating it, testing, finding issues, editing, re-testing — within the session.

## Why This Session Bloated

### 1. Task was inherently open-ended (unbounded exploration)
The task said "identify OR design" scenarios — no cap on iterations. Bob could keep creating and testing indefinitely. Per KE-013, unbounded tasks are the primary driver of session bloat.

### 2. Serial gym runs without batching
57 individual gym-run.sh calls at 2-4 ops each. gym-batch.sh exists but has zero adoption (known issue). Each run adds orchestration overhead.

### 3. No pivot threshold defined
After the first 2 scenarios hit ceiling (by op ~50), there was no signal to stop and write partial results. Instead Bob doubled down, creating 3 more coding scenarios. After THOSE hit ceiling (op ~120), he pivoted to judgment scenarios but kept iterating.

### 4. Scenario design iteration within the session
The 25 silent-data-corruption runs suggest Bob was editing and re-testing the scenario repeatedly. This is design + QA + testing all in one context, which compounds cost.

## Comparison: Original vs Retry

| Metric | Original (187-op) | Retry (93-op) |
|---|---|---|
| Session ID | s_1776147757363_26 | s_1776153174909_68 |
| Status | interrupted, no deliverable | done |
| Gym runs | ~57 | ~37 (from later gym records) |
| Scenarios created | 6+ (all ceiling except 2) | 3 (test-passes-wrong-behavior, false-green-deploy, premature-abstraction-trap) — all ceiling |
| Key output | Baseline catalog (partial) | scenario-gap-fill-results.md |
| Scope | "Identify or design" (open-ended) | "Design Pure Judgment Scenarios" (narrower) |

The retry was 50% smaller but still high (93 ops, 6.2× median). The narrower scope helped — it started from the checkpoint insight that only judgment scenarios work — but still ran 37+ gym trials.

## Is This Systemic?

**Partially.** The create-test-fail-pivot pattern is specific to scenario design tasks, which are inherently exploratory. Bob's other high-op sessions have different root causes:
- 123 ops: Knowledge base integration (many files to edit)
- 118 ops: Knowledge application audit (large-scope analysis)
- 113 ops: Research synthesis (workflow thread)
- 111 ops: EXP-124 v2 KB correction (6 files to update)

The **gym run proliferation** pattern IS systemic — it appeared in coach sessions too (EXP-144 Pilot: 145 ops, 54 gym runs). This is the same pattern identified in `finding-coach-experiment-cost-scouting-0412.md`.

## Waste Breakdown (estimated)

| Category | Ops (est.) | % of Total |
|---|---|---|
| Gym runs (57 trials × 2-3 ops) | ~115-170 | 61-91% |
| Scenario creation (6 scenarios) | ~30-50 | 16-27% |
| Context reading & orientation | ~10-15 | 5-8% |
| Catalog writing | ~5-8 | 3-4% |
| **Total** | **187** | |

**~80% of ops were gym runs.** The core analytical work (cataloging baselines, identifying the judgment-vs-coding insight) was probably complete by op 50-60.

## Fix Recommendations

### 1. Task-level: Cap gym runs per session (HIGH IMPACT)
Add to scenario design task templates: "Budget: max 15 gym runs. After 3 consecutive ceiling results, stop testing and write partial results." This would have capped the session at ~60-80 ops.

### 2. Structural: Gym batch runner adoption (MEDIUM IMPACT)
gym-batch.sh would collapse 57 individual runs into ~3-5 batch invocations. But adoption is already confirmed dead at the prompt level — needs code-level integration.

### 3. Process: Split explore vs design tasks (MEDIUM IMPACT)
"Survey existing baselines" and "Design new scenarios" are different tasks. The survey can be done in 20-30 ops (catalog + read experiment results). Only after identifying what's needed should a second session do scenario creation + testing.

### 4. Workflow: Add checkpoint-and-exit signal after N gym runs (LOW IMPACT)
A workflow step could count gym invocations and force a checkpoint + deliverable write after 15 runs. This prevents the endless iteration loop.

## Bottom Line

**Root cause**: Unbounded exploratory task + serial gym runs. Bob ran 57 gym trials in a single session, spending ~80% of ops on testing rather than analysis. The create-test-fail-pivot loop is rational behavior for an open-ended task with no stopping criterion — the fix is to bound the task or cap the exploration.

**Cost**: 280 ops (187 + 93 retry) ≈ $13-14 for one gap-fill analysis. Bob's median work session is 15 ops ≈ $0.70.

**Systemic risk**: Moderate. Only affects scenario design tasks (~2-3/week), but each can blow out to 100-200 ops without bounds. Same pattern as coach gym proliferation.

**Actionable?**: Yes — add gym run budget to task prompts and split survey/design phases. No infra change needed.
