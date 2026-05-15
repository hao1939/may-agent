# Finding: Coder Efficiency Techniques — Zero-Error Streak Deep Dive

**Date**: 2026-04-16 05:00 UTC | **Mode**: C (Skill & Technique Scouting)

## Summary

Analyzed 90 successful coder sessions from last 6h (0 errors). Efficiency varies 74x (1-74 ops) driven primarily by **task type and prompt structure**, not individual technique differences.

## Key Data

| Task Category | Sessions | Avg Ops | Range | Notes |
|---|---|---|---|---|
| product-search (full task) | 16 | 3.8 | 2-7 | Single-file fix, clear error msg |
| phase2-fix (pre-analyzed) | 20 | 6.0 | 1-31 | Has ANALYSIS.md + PLAN.md ready |
| other (misc fixes) | 22 | 8.3 | 2-15 | Various small tasks |
| grade-pipeline | 31 | 17.5 | 5-34 | Multi-file, complex data flow |
| reference-prompt | 1 | 74.0 | 74 | Bloated reference example in prompt |

## Findings

### 1. Task Complexity Dominates Efficiency (not technique)
The 74x efficiency gap is almost entirely explained by task type:
- **Simple single-file fixes** (product-search): 2-7 ops consistently
- **Multi-file pipeline bugs** (grade-pipeline): 5-34 ops, high variance
- Pre-analysis (PLAN.md) helps phase2-fix sessions start at 1 op but some still balloon to 31

### 2. Pre-Analysis Reduces But Doesn't Guarantee Efficiency
Phase2-fix sessions have ANALYSIS.md and PLAN.md available. Most complete in 1-5 ops, but outliers hit 28-31 ops — suggesting the plan quality matters more than its existence.

### 3. Reference Examples Can Backfire Massively
The 74-op outlier had a verbose "Reference: How a similar task was handled" block in its prompt. This is consistent with KE-133 (few-shot examples harm discovery tasks). Even for fix tasks, overly long reference text may cause the agent to over-analyze.

### 4. Op Distribution is Bimodal
- 52/90 sessions (58%) complete in ≤9 ops — these are the "clean" executions
- 38/90 sessions take 10+ ops — mostly grade-pipeline tasks requiring multi-file investigation

## Extractable Patterns

**What efficient sessions do** (2-7 ops range):
1. Task has clear error message → agent goes straight to the file
2. Single file to fix → no exploration overhead  
3. Tests provided → immediate verification loop

**What inefficient sessions face** (15+ ops):
1. Multi-file dependencies requiring investigation
2. No pre-existing analysis to guide fixes
3. Complex data transformations (grade calculations, edge cases)

## Actionable Insight

The biggest efficiency lever is **task decomposition** (breaking complex tasks into analyzed phases), not agent-level technique changes. The phase2-fix pattern (analyze first, then fix with plan) is already in use but could be applied more broadly. However, plan quality is the bottleneck — bad plans still lead to 30+ op sessions.

## Status
No new skills recommended — efficiency is task-driven, not technique-driven at this maturity level.
