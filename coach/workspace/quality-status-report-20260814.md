# Quality Status Report — Aug 14 2026

## Summary
Evaluator is alive with fresh data (1364 evals in 48h). Two key findings:

### 1. Heuristic Eval Bug Still Active
261 coach sessions scored 0.20 by heuristic eval — same bug from EXP-270. This makes combined averages misleading.
All heuristic evals return quality=0.20 regardless of actual session quality.

**Recommendation**: Escalate to evaluator team — heuristic evals should be excluded from quality metrics or fixed.

### 2. JS-Only Agent Quality Rankings (48h)
| Agent | Avg Q | N | Min | Max |
|-------|-------|---|-----|-----|
| optimizer | 0.487 | 356 | 0.05 | 0.93 |
| coach | 0.493 | 343 | 0.00 | 0.95 |
| may | 0.554 | 80 | 0.10 | 0.90 |
| scout | 0.629 | 45 | 0.20 | 0.86 |
| tech-lead | 0.644 | 5 | 0.20 | 0.85 |
| qa | 0.648 | 45 | 0.20 | 0.85 |
| bob | 0.666 | 61 | 0.10 | 0.90 |
| amy | 0.741 | 90 | 0.20 | 1.00 |

### Key Observations
- **Optimizer** is now worst (0.487, n=356). Previously coach was worst. EXP-275 treatment may not be working.
- **Coach** at 0.493 — slightly below 0.50 target. Last 20 JS evals avg 0.540. Still has variance (some 0.20-0.35 sessions).
- **Bob** improved significantly (0.666) — EXP-290 anti-shallow treatment working.
- **Amy** best (0.741) — stable.

### Proposed EXP-310: Optimizer Quality Improvement
- **Problem**: Optimizer worst JS quality at 0.487 (n=356). Was supposed to be 0.606 baseline but has degraded.
- **Hypothesis**: Same anti-shallow + execution rules pattern that fixed coach (EXP-270/275) needs reinforcement.
- **Plan**: 
  1. Audit 10 low-quality optimizer sessions to identify patterns
  2. Deploy targeted fix
  3. Measure after 48h
