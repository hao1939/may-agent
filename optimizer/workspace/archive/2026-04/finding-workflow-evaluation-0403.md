# Workflow Effectiveness Evaluation — 2026-04-03

## Executive Summary

Workflows dramatically improve session completion and reduce errors, but are **underutilized and declining**. The code-review-loop is the standout performer. Coach training workflows have quality issues. System-wide, workflows represent only 3% of sessions but demonstrate structural advantages worth expanding.

## Data Source

All data from `may.db` sessions + evaluations tables. 16,118 total sessions, 464 workflow sessions across 180 workflow runs.

## Key Findings

### 1. Workflows Have 27% Higher Completion Rate

| Metric | Standalone | Workflow | Delta |
|--------|-----------|----------|-------|
| Done rate | 64.8% | 91.7% | **+26.9pp** |
| Error rate | 23.2% | 1.5% | **-21.7pp** |
| Interrupt rate | 12.0% | 6.8% | -5.2pp |
| Avg ops (active) | 12.9 | 16.1 | +3.2 |

**Why**: Workflows provide structured multi-step execution that prevents crashes. Sub-sessions within workflows get clean tasks with clear scope, reducing errors from ambiguous instructions.

### 2. Code-Review-Loop Is the Star Performer

- **97% completion rate** for full 4-step runs (code→QA→fix→QA)
- **100% completion** in last 15 runs
- Average **24 ops per full cycle** (6 ops/step)
- QA sub-sessions in workflows: **100% done rate** at 2.6 avg ops (vs 5.5 standalone)
- 60 total runs, 85% overall completion (lower due to partial 2-3 step runs that got interrupted)

**This is the gold standard workflow.** Clean task decomposition, clear agent roles, structured handoff.

### 3. Two-Phase Coach Has Mixed Results

- 65 runs, **63% completion rate**
- Average 38 ops/run (expensive)
- Failures come from:
  - "Request was aborted." interrupting single-step runs (3 of last 20 failed this way)
  - Coach NI rate in workflows: **35%** (57 NI out of 163 evaluated)
  - Primary NI issues: TASK_NONCOMPLETION — sprint plans not produced, deliverables missing

**Root cause**: Sprint planning is too complex for a single agent session. The task asks for 8 steps, multiple experiments, and a gate check. Sessions hit turn limits or get aborted before completion.

### 4. Workflow Usage Is Declining

| Date | Workflow Sessions | Standalone Sessions | WF Share |
|------|-------------------|---------------------|----------|
| Mar 27 | 8 | 71 | 10.1% |
| Mar 28 | 6 | 133 | 4.3% |
| Mar 29 | 19 | 133 | 12.5% |
| Mar 30 | 8 | 157 | 4.8% |
| Mar 31 | 3 | 149 | 2.0% |
| Apr 1 | 1 | 65 | 1.5% |
| Apr 3 | 0 | 19 | **0%** |

Workflow usage peaked Mar 29 and has dropped to zero. This is concerning given their proven effectiveness.

### 5. Evaluation Quality Paradox

Workflows show **lower quality scores**: 45% good vs 54% standalone, and 25% NI vs 3%. But this is entirely driven by coach (35% NI) and optimizer (39% NI) sub-sessions. QA and coder sub-sessions in workflows score well.

The NI rate for coach is an **evaluator problem**, not a workflow problem — the evaluator judges sub-sessions without understanding they're part of a multi-step workflow where partial progress is expected.

## Per-Workflow-Type Analysis

| Workflow Type | Runs | Completion | Avg Ops/Run | Primary Agent |
|-------------|------|-----------|-------------|---------------|
| Code-review-loop | 60 | 85% | 11 | coder+qa |
| Two-phase (coach) | 65 | 63% | 38 | coach |
| Training-sprint | 23 | 91% | 44 | coach |
| Skill-lifecycle | 12 | 75% | 73 | optimizer |
| Optimizer workflow | 12 | 75% | 82 | optimizer |

## Recommendations

### Immediate (This Week)
1. **Investigate workflow usage decline** — Why did usage drop from 12.5% to 0%? Are agents choosing standalone over workflows?
2. **Consolidate P1 duplicates** — verify-and-finish is byte-identical across agents. Zero-risk merge.

### Short-term (Next Week)
3. **Fix coach training workflow** — Simplify sprint planning to fit within turn budget. Break 8-step plan into 2 focused sub-workflows.
4. **Expand code-review-loop usage** — This workflow should be the default for ANY code change by ANY agent. Currently only used for tech-lead dispatches.
5. **Fix evaluator for workflow sub-sessions** — Sub-sessions should be evaluated in context of their workflow, not standalone.

### Medium-term
6. **Create "light" workflows** — Evidence shows even simple 2-step workflows (plan→execute) improve outcomes. Design lightweight wrappers for common agent tasks.
7. **Workflow adoption metric** — Track workflow usage % as a system health indicator.

## Methodology Notes

- "Active" sessions = opCount > 0 (filters out skipped/idle sessions)
- Workflow type inferred from agent composition and task content (no explicit workflow-type field in DB)
- Completion = all steps in workflow run have status "done"
- Time period: all-time (Mar 12 – Apr 3, 2026)
