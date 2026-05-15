# Session Archaeology — 6h Analysis (2026-04-16 08:00–14:00 UTC)

## Summary
315 sessions in window. Total ops: ~1,718 across 7 active agents. No major regressions detected. Key cost drivers are tech-lead volume (50 sessions, 498 ops) and a few high-op jobs.

## Agent Averages vs Baselines
| Agent | Sessions | Avg Ops | Baseline | Status |
|-------|----------|---------|----------|--------|
| bob | 27 | 6.6 | 7 | ✅ Excellent |
| coach | 31 | 9.5 | 9 | ✅ On track |
| optimizer | 32 | 8.6 | — | ✅ Normal |
| tech-lead | 50 | 10.0 | 10 | ✅ On track |
| coder | 7 | 20.1 | — | ⚠️ High (job work) |
| scout | 16 | 7.4 | — | ✅ Normal |
| qa | 12 | 8.6 | — | ✅ Normal |

## Top Cost Sessions (>30 ops)
1. **scout** 50 ops — M5 scenario creation (interrupted, but q=1.0) — legitimate complex job
2. **tech-lead** 47 ops — Fix error-log-scanner (q=0.55, e=0.45) — ⚠️ low quality for high cost
3. **coach** 45 ops — M3 fast loop pilot (q=1.0) — legitimate complex job
4. **may** 43 ops — chat session (no eval) — user-driven, not actionable
5. **coder** 43 ops — persistent task iteration 1 (q=0.92) — good quality, justified
6. **tech-lead** 43 ops — FM-3.3 reduction persistent task (q=0.9) — good quality, justified

## Needs-Improvement Sessions (waste patterns)
1. **tech-lead** 27 ops, q=0.18 — "Build auto-resume" interrupted, very low quality. Likely scope too large.
2. **coach** 19 ops, q=0.55 — EXP-171 experiment design. Moderate waste.
3. **tech-lead** 13 ops, q=0.30 — Persistent task iteration 2. Low quality continuation.
4. **coder** 13 ops, q=0.28 — Persistent task iteration 8. Late iteration, diminishing returns.
5. **tech-lead** 8 ops, q=0.22 — Fix evaluate-sessions handler. Failed at low cost.
6. Several 1-3 op sessions with needs_improvement — mostly review sessions or crashed heartbeats.

## Key Findings

### F1: Tech-lead is the dominant cost center
50 sessions / 498 ops = 29% of all ops. Mix of heartbeats and jobs. The 47-op error-log-scanner fix (q=0.55) is the worst cost/quality ratio in the window.

### F2: Coder avg ops (20.1) looks high but is all job work
Only 7 sessions, all persistent-task iterations. This is expected — coder does implementation work. No action needed.

### F3: No wasted-calls detected anywhere
Every session shows wastedCalls=0. Either the evaluator isn't tracking this metric, or waste manifests as low quality/efficiency scores instead.

### F4: Low-op crash/fail sessions are cheap
The 1-3 op needs_improvement sessions (bob, coach, may) are near-zero cost. Not worth optimizing.

### F5: No new anti-patterns detected
Known patterns hold: high-op jobs are legitimate complex work, low-quality sessions correlate with scope/interruption issues. No regression from recent changes.

## Recommendation
- **Monitor**: tech-lead error-log-scanner pattern (47 ops, q=0.55) — investigate if task was poorly scoped
- **No action needed**: baselines stable, no new waste patterns
