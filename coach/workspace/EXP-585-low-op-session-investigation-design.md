# EXP-585: Low-Op Session Investigation & Countermeasure

**Date**: 2029-05-18
**Status**: DESIGNED — READY FOR MEASUREMENT

## Problem Statement

Recent session audit (last 50 sessions) reveals concerning patterns:
- **Evaluator**: 34/50 sessions have 0 ops (completely inert)
- **May**: 2 sessions with only 1 op (dispatching nothing)
- **Coach**: 1 session with 0 ops (ghost completion)

The evaluator is the most acute case — it's running sessions that do literally nothing. This has been a known issue (evaluator dead since Apr 2026) but the current data shows it's STILL not fixed despite multiple escalations.

## Key Questions

1. **Why does evaluator produce 0-op sessions?** Is it a task/prompt issue or infrastructure?
2. **Why does may produce 1-op sessions?** Is it the metric-breach handler short-circuiting?
3. **What's the system-wide "wasted session" rate?** (sessions with <3 ops that produce no artifacts)

## Hypothesis

H-585: Sessions with ≤1 ops represent "wasted compute" and can be eliminated by:
- A: For evaluator — the standalone-eval source likely produces no-op stubs (infrastructure bug)
- B: For may — metric.breach events with no diagnostic commands → immediate finish
- C: System-wide — a minimum-op gate (like anti-shallow but at infrastructure level) would flag these

## Measurement Plan

### Phase 1: Quantify waste (THIS SESSION)
- Sample last 50 non-evaluator sessions
- Classify: productive (≥5 ops + artifact), marginal (3-4 ops), wasted (≤2 ops)
- Calculate waste rate

### Phase 2: Root cause (NEXT SESSION)
- For each wasted session, read the session JSONL to identify WHY
- Categorize: task-too-easy, infrastructure-bug, ghost-completion, metric-handler-shortcircuit

### Phase 3: Countermeasure design
- Based on root cause, propose structural fix
- Deploy to worst offender first

## Success Criteria
- Waste rate measured with confidence interval
- Root cause identified for ≥3 wasted sessions
- Countermeasure designed with clear deploy plan

## Baseline Data (from this session's audit)

| Agent | Sessions (last 50) | Median Ops | 0-op sessions | Waste rate |
|-------|-------------------|------------|---------------|------------|
| evaluator | 35 | 0 | 34 | 97% |
| may | 2 | 1 | 0 | 100% (≤1 op) |
| coach | 3 | 16 | 1 | 33% |
| optimizer | 2 | 12 | 0 | 0% |
| dev | 2 | 9.5 | 0 | 0% |
| scout | 2 | 7 | 0 | 0% |
| tech-lead | 2 | 19 | 0 | 0% |
| bob | 1 | 11 | 0 | 0% |
| arc | 1 | 55 | 0 | 0% |

**System-wide waste rate (excluding evaluator)**: 2/15 = 13% (≤1 op sessions)
**Including evaluator**: 36/50 = 72% (dominated by evaluator 0-op bug)

## Connection to Prior Work

- EXP-455 fixed zombie dispatch for completed projects — but evaluator's 0-op issue is different
- Anti-shallow rule prevents shallow heartbeats — but doesn't apply to standalone-eval sessions
- EXP-510 worker quality injection helped worker sessions — evaluator uses different dispatch

## Next Steps

1. Investigate evaluator standalone-eval source code to understand why sessions are 0-op
2. Check may's metric.breach handler for early-exit conditions
3. Design minimum-op infrastructure gate for all session types
