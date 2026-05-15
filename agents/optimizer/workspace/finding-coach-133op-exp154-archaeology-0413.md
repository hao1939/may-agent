# Finding: Coach 133-op EXP-154 Design Session Archaeology

**Date**: 2026-04-13
**Session**: `s_1776117159825_421` (coach, 133 ops, interrupted)
**Duration**: 3,536 seconds (~59 minutes)
**Status**: Interrupted (Request was aborted)

## Executive Summary

The session was budgeted for **≤35 ops** but consumed **133 ops** (3.8x overrun) before being interrupted. The overrun was caused by **two dead-end scenario pivots** plus a **transcript-parsing debugging loop** and a **workspace path mismatch debugging loop**. The session produced excellent deliverables (EXP-154 design.md + results.md, 224 lines total) with a genuinely novel finding (selective compliance pattern, later becoming KE-176). The waste was not from low-quality work but from **exploration volatility** — the experiment design kept hitting obstacles that required pivoting.

## Phase Breakdown

### Phase 1: Scenario Selection (Ops 1–17, ~17 ops)
**Budget**: ≤8 ops | **Actual**: 17 ops | **Overrun**: 2.1x

- Ops 1-3: DB queries for scenario baselines, experiment history
- Ops 4-8: Deep-dive into candidate scenarios (read-before-edit, conflicting-evidence, etc.)
- Ops 9-14: Investigation of existing skills and lab forks for read-before-edit
- Ops 15-17: Detailed analysis of why read-before-edit fails

**Waste pattern**: 9 ops of exploration into read-before-edit before committing. The coach investigated existing skills, lab forks, and failure modes extensively before writing anything. The "lean heuristic" (write within 5 ops) was violated — first write at op 18.

### Phase 2: Design + Fork Creation (Ops 18–30, ~13 ops)
**Budget**: ≤5 ops | **Actual**: 13 ops | **Overrun**: 2.6x

- Ops 18-19: Write process skill and design.md
- Ops 20-24: Investigate lab fork structure (5 bash calls learning the system)
- Ops 25-29: Write skill, edit design.md multiple times
- Op 30: Checkpoint

**Waste pattern**: 5 ops learning how lab forks work. This is a repeating cost — each experiment session re-discovers fork mechanics.

### Phase 3: First Dead End — read-before-edit (Ops 31–59, ~29 ops)
**Budget**: ≤15 ops for full run | **Actual**: 29 ops of pure waste

- Ops 31-35: Run 5 treatment trials, all fail
- Ops 36-40: Investigate WHY they fail — environment files have no bugs
- Ops 41-48: Deep investigation of scenario files, discovery that env is already correct
- Ops 49-52: Fix the environment files (add actual bugs)
- Ops 53-58: Rerun baseline — now 100% pass (too easy)
- Op 59: Checkpoint, pivot decision

**This is the single biggest waste block**: 29 ops spent on a broken scenario. The scenario (`read-before-edit`) had environment files that didn't contain the bugs described in task.md. After fixing them, the scenario became trivially easy. All 29 ops were wasted exploration.

### Phase 4: Second Exploration — Scenario Hunt (Ops 60–86, ~27 ops)
**Budget**: N/A (unplanned) | **Actual**: 27 ops

- Ops 60-63: Investigate conflicting-evidence (discovered it's judgment-scored, not criteria-scored)
- Ops 64-68: Look at exp144-hidden-dep-decoupled — promising 15% baseline
- Ops 69-76: Investigate wrong-fix-recovery (all runs timing out at 248ms — broken)
- Ops 77-80: Look at structured-multi-edit (8 files need updating — wrong type)
- Ops 81-86: Return to exp144-hidden-dep-decoupled, design investigation-before-fix skill

**Waste pattern**: 18 ops exploring 3 additional scenarios that didn't work out. Only exp144-hidden-dep-decoupled was viable. The coach tried wrong-fix-recovery (broken timeouts), conflicting-evidence (judgment-scored), and structured-multi-edit (wrong failure type) before settling.

### Phase 5: Treatment Run + Analysis (Ops 87–133, ~47 ops)
**Budget**: ≤5 ops for writeup | **Actual**: 47 ops

- Ops 87-91: Write new skill, update design
- Ops 92-97: Run 5 treatment trials, all fail (0/5)
- Ops 98-110: **Transcript parsing debugging loop** — 13 consecutive bash calls trying to parse gym run transcripts. Struggled with JSON format (`toolCall` vs `tool_use`, `arguments` vs `input`), output encoding issues.
- Ops 111-116: Discovered agent writes to `workspace/` but criteria checks root. 6 ops diagnosing path mismatch.
- Ops 117-129: Fixed skill to specify root path, ran 5 more trials, still failed. Discovered coder's context.md hardcodes `workspace/` path. Created context.md override.
- Ops 130-133: Ran final trials, 1/10 passed, started writing results — then interrupted.

**Waste patterns**:
- **13-op transcript parsing loop** (ops 98-110): Brute-force bash debugging of JSON structure. Classic "bash streak" violation — should have paused after 5 to write findings.
- **6-op path mismatch debugging** (ops 111-116): Investigation of why criteria doesn't see agent output.
- **10-op skill iteration** (ops 117-129): Three rounds of "fix skill → run → still fail" loop.

## Op Category Summary

| Category | Ops | % | Description |
|----------|-----|---|-------------|
| Productive exploration | 17 | 13% | Phase 1 scenario selection (necessary) |
| Productive writing | 22 | 17% | Design docs, skills, edits, checkpoints |
| Dead-end scenario | 29 | 22% | read-before-edit broken scenario investigation |
| Failed scenario hunt | 18 | 14% | 3 scenarios explored and rejected |
| Gym runs (treatment) | 15 | 11% | Running trials + checking results |
| Transcript parsing loop | 13 | 10% | Brute-force JSON debugging |
| Path mismatch debugging | 6 | 5% | workspace/ vs root path issue |
| Skill iteration cycle | 10 | 8% | Fix-run-fail loop |
| **Total waste** | **76** | **57%** | Ops that produced no lasting value |
| **Total productive** | **57** | **43%** | Ops that contributed to deliverables |

## Root Causes

### 1. Broken Scenario (29 ops wasted)
`read-before-edit` had environment files that didn't contain the bugs described in its task.md. The coach discovered this at op ~40 after running trials and investigating failures. This is a **pre-existing infrastructure bug**, not a coach design flaw.

**Systemic fix**: Scenario health check — a pre-run validation that confirms environment files match task.md expectations. Could be a gym scenario linter.

### 2. No Scenario Pre-Screening (18 ops wasted)
The coach explored 4+ scenarios sequentially, investigating each deeply before discovering deal-breakers (judgment-scored, broken timeouts, wrong failure type). This is serial exploration with high per-scenario investigation cost.

**Systemic fix**: Scenario metadata/tags in the gym. If scenarios had tags like `criteria-scored`, `process-failure`, `working-baseline: 15%`, the coach could filter without deep investigation.

### 3. Transcript Parsing Friction (13 ops wasted)
The coach needed to understand WHY treatment runs failed, which required parsing gym run transcripts. The JSON format was unfamiliar (`toolCall` vs `tool_use`, `arguments` vs `input`), leading to 13 consecutive bash calls of trial-and-error.

**Systemic fix**: A `gym-analyze` tool or script that extracts structured summaries from gym run transcripts. The coach shouldn't need to hand-parse JSON.

### 4. No Op Budget Enforcement (entire session)
The task specified `≤35 ops total` but no mechanism enforced this. The coach checkpointed at ops 30 and 59 (acknowledging phase boundaries) but never self-terminated at the budget limit.

**Systemic fix**: Op budget awareness in work session dispatch. The dispatcher could add a hard budget reminder, or sessions could have a soft-cap mechanism.

## Comparison to Typical Coach Sessions

| Metric | This Session | Typical Coach Work Session | Ratio |
|--------|-------------|--------------------------|-------|
| Op count | 133 | 82-98 (median ~88) | 1.5x |
| Bash calls | 128 (86%) | ~60% | High |
| Write calls | 9 (6%) | ~15% | Low |
| First write | Op 18 | Op 5-8 | Late |
| Pivots | 2 major | 0-1 | High |
| Status | Interrupted | Done | — |

The 133-op session is an outlier even for coach. The typical 82-98 op range already suggests coach work sessions run long, but this one was driven by two major pivots (broken scenario + scenario hunt).

## Deliverable Quality Assessment

Despite the overrun, the deliverables were **high quality**:
- **design.md** (81 lines): Clear hypothesis, well-structured design with scenario selection rationale, treatment description, predictions
- **results.md** (143 lines): Excellent analysis with the "selective compliance" insight — agents cherry-pick additive steps (100% compliance) while ignoring interruptive steps (10% compliance)
- **KE-176** was derived from this: a genuinely novel knowledge entry about skill compliance gradients

The findings were substantive enough to spawn a follow-up experiment (EXP-155). This is not a low-value session — it's a **high-value session with severe process waste**.

## Systemic Fix Recommendations

### Priority 1: Scenario Health Linter (saves ~29 ops per incident)
Create a `gym-validate-scenario` script that checks:
- Environment files contain the issues described in task.md
- Success criteria can actually be triggered (not always-pass/always-fail)
- Baseline isn't 0% or 100%
Run before any experiment design session.

### Priority 2: Scenario Metadata Tags (saves ~18 ops per experiment design)
Add structured metadata to each scenario:
```yaml
scoring: criteria  # vs judgment
baseline: 15%
failure_type: process  # vs product, knowledge, judgment
working: true  # environment validated
```
Experiment design sessions can filter by metadata instead of deep-diving.

### Priority 3: Gym Run Transcript Analyzer (saves ~13 ops per analysis)
A script like `gym-analyze-run <runId>` that outputs:
- What tools the agent called (in order)
- What files it created/edited
- Where it spent time
- Final score breakdown
Eliminates the JSON-parsing friction.

### Priority 4: Op Budget Soft Caps (systemic)
Work sessions with explicit budgets should have periodic budget checks. At 50% budget consumed, the session gets a reminder. At 100%, it gets a strong recommendation to wrap up.

## Key Insight

This session's 57% waste rate aligns with the previously-observed pattern (64% waste in top coach sessions). The waste is not random — it concentrates in **exploration dead-ends** (50% of waste) and **tooling friction** (28% of waste). Both are addressable through infrastructure improvements rather than prompt changes.

The coach's *judgment* was sound throughout — it correctly identified broken scenarios, pivoted appropriately, and produced genuinely novel findings. The overrun was caused by **environmental obstacles**, not decision-making failures. This means prompt-level interventions (budget reminders, fewer-ops instructions) would have limited effect. The real fix is **reducing the cost of exploration** through better scenario metadata and analysis tooling.
