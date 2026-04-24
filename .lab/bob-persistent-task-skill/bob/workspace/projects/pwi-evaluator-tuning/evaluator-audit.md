# Evaluator Scoring Audit — PWI Evaluator Tuning

**Date:** 2026-04-22  
**Milestone:** MS1 — Audit evaluator scoring patterns

## Dataset

- **Total scored evaluations:** 24,014
- **Period:** Full system history through 2026-04-22

## Verdict Distribution

| Verdict | Count | Avg Quality | Notes |
|---------|-------|-------------|-------|
| good | 15,638 (65%) | 0.88 | Healthy |
| acceptable | 6,917 (29%) | 0.55 | Middle band — many of these are borderline |
| needs_improvement | 1,196 (5%) | 0.25 | Mostly session_error / shallow_session (outages) |
| parse_error | 263 (1%) | 0.61 | **Misnamed** — these are real quality issues, not parse failures |

## Key Finding 1: `parse_error` Verdict is Misleading

263 evaluations labeled `parse_error` are actually substantive quality assessments with detailed issue descriptions. Examples:
- "Did not perform the requested task"
- "Gave guidance that directly violated the session constraint"
- "Did not complete the iteration's required concrete output"

These are real evaluator judgments with avg quality 0.61, not parsing failures. The verdict name creates confusion about what happened.

## Key Finding 2: Rejection Loops Are Real

In the last 20h alone:
- **coach**: 15 low scores in one 1-hour window (10:21-10:58)
- **amy**: 5 low scores in 48 minutes
- **tech-lead**: 4 low scores in 31 minutes (scores: 0.05, 0.05, 0.2, 0.2)
- **bob**: 3 low scores in 9 minutes (the pwi-smart-context rejection loop)

Pattern: agents get stuck in rapid succession of low-quality sessions, each trying to fix the previous one's rejection.

## Key Finding 3: Session Errors Dominate `needs_improvement`

At 11:56 UTC, mass `session_error`/`shallow_session` entries hit every agent simultaneously. These are outage artifacts, not real quality problems. They inflate the needs_improvement count significantly.

## Key Finding 4: Low Quality by Agent

| Agent | Total Evals | Low Quality (<0.7) | % Low |
|-------|------------|-------------------|-------|
| coach | 3,772 | 1,004 | 26.6% |
| amy | 1,026 | 291 | 28.4% |
| bob | 3,683 | 882 | 23.9% |
| may | 4,842 | 962 | 19.9% |
| coder | 512 | 190 | 37.1% |
| tech-lead | 3,222 | 586 | 18.2% |
| optimizer | 2,682 | 570 | 21.3% |

Coder has highest low-quality rate (37%), but low N. Among high-volume agents, coach (26.6%) and amy (28.4%) are most rejection-prone.

## Root Cause Analysis

The rejection loops in pwi-smart-context were caused by:
1. **Evaluator scored <7 on work the reviewer marked DONE** — mismatch between evaluator rigor and milestone scope
2. **Each rejection triggered a new iteration** that tried to "fix" things, often making them worse
3. **The circularity critique** (scored 6/10 for self-referential experiment) was _valid criticism_ but shouldn't have blocked the project for 3 iterations

## Recommendation: Treatment Option C + D Hybrid

Based on the data:
- **Option C (Good-enough rubric)**: Evaluator should assess "does the deliverable exist and address the milestone?" not "is this publication-quality research?"
- **Option D (2-attempt cap)**: After 2 rejections on the same milestone, auto-advance with a caveat flag instead of infinite loop

This addresses the core problem: rejection loops waste more iterations than accepting imperfect work.

## Next Step

Design the specific intervention (MS3) and implement it (MS4).
