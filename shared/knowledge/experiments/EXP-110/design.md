# EXP-110: FM-3.3 Commit Guard Production Impact Analysis

**Status**: COMPLETE
**Created**: 2026-04-10
**Author**: Coach
**Type**: Retrospective observational study (before/after analysis)

---

## Objective

Measure whether the commit guard deployment (2026-04-07 16:32 UTC) actually reduced FM-3.3 (verification failure) rates in production sessions, using real evaluation data from may.db.

## Background

- The commit guard was deployed on **2026-04-07 16:32 UTC** (KE-094)
- In gym testing, it reduced auto-commit laziness from 58% to 1% (−57pp)
- The guard structurally blocks `finish()` when post-edit verification is missing
- EXP-109 found FM-3.3 is the #1 failure mode across all agents (292 instances)
- Question: Does the gym-measured effect translate to production?

## Hypotheses

| ID | Hypothesis | Prediction |
|----|-----------|-----------|
| H1 | FM-3.3 raw rate decreases post-guard | FM-3.3 rate drops by ≥10pp |
| H2 | FM-3.3 recovery rate increases post-guard | Recovery rate increases by ≥20pp |
| H3 | Quality improves alongside guard deployment | Avg quality increases ≥0.05 |
| H4 | No compensatory failure modes emerge | No new FM codes appear or increase ≥10pp |

## Methodology

### Data Source
- `.state/may.db` evaluations table (19,072 total evaluations)
- Non-heuristic evaluations with quality > 0 (N=1,473)
- Dates: 2026-02-28 to 2026-04-10

### Critical Confounds
1. **Evaluator capability drift**: FM detection started at 0% (W08-W09), rose to 90% (W12). Must control for this.
2. **Agent mix**: Post-guard data is 92% bob (81/88). Must do agent-matched comparisons.
3. **Task mix**: Different weeks may have different task difficulty.
4. **Other interventions**: Skills, few-shot pipeline deployed in same period.
5. **Small N post-guard**: Only 88 non-heuristic evals post-guard (3 days of data).

### Analysis Plan
1. Raw FM-3.3 rates: all agents, pre vs post guard
2. Controlled comparison: W11+ only (FM-capable evaluator) 
3. Agent-matched: Bob pre vs post (largest sample in both periods)
4. FM-3.3 recovery classification: recovered (guard-blocked) vs unrecovered
5. Compensatory failure analysis: all FM code rates pre vs post
6. Effect size (Cohen's h) and significance (χ²) testing
7. Quality correlation analysis

### Key Metrics
- **FM-3.3 raw rate**: sessions with FM-3.3 / total sessions
- **FM-3.3 recovery rate**: sessions where FM-3.3 was caught and corrected / total FM-3.3 sessions
- **Unrecovered FM-3.3 rate**: sessions where FM-3.3 persisted / total sessions
- **FM-3.3 share**: FM-3.3 / all FM codes (controls for evaluator capability)

### Recovery Classification
An FM-3.3 instance is classified as "recovered" if the issue text contains:
- "recovered" — explicitly recovered from the failure
- "blocked" — guard blocked the premature finish
- "caught" — the issue was caught and corrected
- "attempt" — classified as an attempt that was stopped

All other FM-3.3 instances are "unrecovered."
