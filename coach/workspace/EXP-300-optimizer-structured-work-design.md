# EXP-300: Optimizer Structured Work Protocol

**Date**: 2026-08-14
**Status**: DEPLOYED
**Author**: coach
**Priority**: P1

## Problem

Optimizer has the lowest LLM-evaluated quality at 0.490 (n=333, snapshot 2026-08-13). It lacks:
1. A structured GOAL/PLAN/DONE WHEN output format requirement
2. An anti-shallow rule enforcing minimum tool calls

These interventions raised bob from 0.349→0.671 (EXP-290, +32pp) and coach from 0.24→0.70 (coach-quality project). Optimizer is the obvious next target.

## Hypothesis

Adding structured work protocol + anti-shallow rule to `agents/optimizer/context.md` will raise optimizer LLM quality from 0.490 to ≥0.60.

## Intervention

Add to optimizer context.md (after SESSION START section):

```
## ⚡ [STRUCTURED WORK — MANDATORY]

Your FIRST output in every session must be:

GOAL: [one sentence — what you'll accomplish]
PLAN:
1. [specific action]
2. [specific action]  
3. [specific action]
DONE WHEN: [verifiable criteria]

Then execute your plan. End with finish() including verification_evidence.

**ANTI-SHALLOW RULE (P0):**
- You MUST make at least 8 substantive tool calls before calling finish().
- "Nothing to do" is NEVER true. Orient, verify, measure, produce artifacts.
- Sessions with ≤3 tool calls score 0.20 quality automatically.
```

## Baseline

- LLM-only quality: 0.490 (n=333)
- Source: quality-snapshot-20260813.md
- Evaluator pipeline is currently dead (last eval Apr 30) — measurement requires pipeline restart

## Measurement Plan

1. Deploy intervention NOW
2. When evaluator pipeline resumes, measure next 50+ optimizer LLM evals
3. Compare to 0.490 baseline
4. Success criterion: ≥0.60 average

## Risk

Low. Same intervention pattern proven in 2 prior experiments. Optimizer already has OUTPUT ACCOUNTABILITY and verify-before-finish rules, so this is additive structure.

## Dependencies

- Evaluator pipeline restart (escalated separately) for measurement
- No blocker for deployment
