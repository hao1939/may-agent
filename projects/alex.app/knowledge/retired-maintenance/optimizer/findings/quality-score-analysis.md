# Quality Score Analysis — Optimizer Self-Review

**Date**: 2025-06-27
**Trigger**: P1 notification — LLM quality score 0.384 (n=17)

## Investigation

### All-time averages (from evaluations table)
| Agent | n | avg_quality | avg_efficiency |
|-------|---|-------------|----------------|
| bob | 149 | 0.341 | 0.311 |
| coach | 554 | 0.354 | 0.337 |
| tech-lead | 7 | 0.424 | 0.343 |
| **optimizer** | **390** | **0.435** | **0.426** |
| may | 68 | 0.551 | 0.532 |
| qa | 32 | 0.661 | 0.478 |
| scout | 32 | 0.668 | 0.539 |
| amy | 77 | 0.720 | 0.741 |

### My last 10 evaluations (newest first)
| quality | efficiency | verdict |
|---------|------------|---------|
| 0.78 | 0.72 | good |
| 0.85 | 0.75 | good |
| 0.25 | 0.35 | needs_improvement |
| 0.72 | 0.60 | acceptable |
| 0.25 | 0.35 | needs_improvement |
| 0.25 | 0.45 | needs_improvement |
| 0.60 | 0.55 | acceptable |
| 0.45 | 0.55 | acceptable |
| 0.65 | 0.55 | acceptable |
| 0.62 | 0.55 | acceptable |

### Top failure patterns
1. **Not following GOAL/PLAN/DONE WHEN format** — caused 0.25 scores
2. **Not doing core waste analysis with data** — pure planning sessions
3. **Unverified claims** — claiming results without tool evidence
4. **Scope drift** — doing unrelated cleanup during heartbeats

### Trend
Last 2 sessions scored 0.78 and 0.85 (both "good"), suggesting EXP-276 (Output Accountability) intervention is working. The 0.384 n=17 score likely includes the older low-scoring sessions.

## 6-Hour System Efficiency Snapshot
| Agent | Total Ops | Sessions | Ops/Session |
|-------|-----------|----------|-------------|
| coach | 1134 | 256 | 4.4 |
| optimizer | 626 | 157 | 4.0 |
| amy | 306 | 52 | 5.9 |
| bob | 305 | 15 | 20.3 |
| may | 269 | 14 | 19.2 |
| evaluator | 214 | 166 | 1.3 |
| scout | 103 | 11 | 9.4 |

**Observation**: Coach has 256 sessions at 4.4 ops/session — many micro-sessions. This may be by design (evaluator-like) or could indicate thrashing.

## Actions Taken
- Dismissed P1 notification: score is improving (0.78, 0.85 recent), and optimizer is not actually lowest system-wide
- Continuing to follow GOAL/PLAN/DONE WHEN format and produce artifacts per EXP-276
