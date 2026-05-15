# Closed-Loop Steward Audit — 2026-05-09T19:56Z

## Executive Summary
System is operationally healthy (97% success rate, all health checks PASS) but quality metrics reveal a persistent evaluation gap: **72.1% of evaluated sessions score needs_improvement or worse** across all agents.

## Key Findings

### 1. Quality Crisis Across All Agents (24h evaluations)
| Agent | needs_improvement | good | other | NI rate |
|-------|------------------|------|-------|---------|
| may   | 267              | 98   | 8     | 71.6%   |
| scout | 86               | 37   | 0     | 69.9%   |
| dev   | 60               | 23   | 5     | 68.2%   |
| arc   | 53               | 18   | 1     | 73.6%   |

**All agents have ~70% needs_improvement rate.** This is either:
- (a) A genuine quality problem across the board, or
- (b) Evaluator calibration is too strict (supported by KE-1014, KE-907)

The "Reviewed good sessions overturned" metric at 24.6% suggests evaluator is re-grading ~1 in 4 good sessions to needs_improvement on second pass, supporting (b).

### 2. Scout Persistent Breaches (10+ consecutive alerts)
- **good-session-rate**: 0.31 vs 0.85 target — known false signal per KE-907/KE-1014
- **operational-friction-rate**: 0.83 vs 0.10 target — same root cause
- Both documented as evaluation calibration issues, not scout behavioral problems
- **Action**: These metrics need threshold recalibration or the evaluator scoring rubric needs adjustment

### 3. Zero Active Project Iterations (24h)
- Current: 0, Target: 10, Threshold: 1
- No projects are actively iterating despite system running ~99 sessions/3hrs
- All work is reactive (cron-driven heartbeats, explore tasks) not project-driven
- **This is the #1 strategic concern**: high throughput, no directed progress

### 4. Session Volume & Health
- 67 handler fires/hour, 440 completions/6h — very active
- 5 agents with heartbeats in 2h — adequate coverage
- DB at 1.12GB (threshold 2GB) — growing but not urgent
- Error rate 5.25% — within tolerance

## Recommendations
1. **Recalibrate evaluator** — 72% NI rate system-wide means the bar is miscalibrated or agents genuinely need quality improvements. Either way, this needs a targeted investigation.
2. **Restart project iterations** — 0 active project iterations means no strategic progress. May should identify 2-3 high-value projects and kick off iterations.
3. **Adjust scout metric thresholds** — Per existing KEs, the good-session-rate and friction-rate thresholds don't account for evaluator strictness. Raise thresholds or fix evaluator first.
