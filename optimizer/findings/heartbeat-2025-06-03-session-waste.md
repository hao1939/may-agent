# Heartbeat Findings: Session Waste Analysis
**Date**: 2025-06-03
**Metric snapshot**: handler.success-rate=1.0 ✅ | handler.p95-duration=2162ms ✅

## Key Finding: 15.6% of Sessions Are Zero-Op Waste

**62 out of 398 sessions** (15.6%) were interrupted with 0 operations — started but did nothing.

### Zero-Op Waste by Agent
| Agent | 0-op Sessions | Severity |
|-------|--------------|----------|
| coach | 20 | 🔴 High |
| bob | 18 | 🔴 High |
| optimizer | 7 | 🟡 Medium |
| may | 6 | 🟡 Medium |
| tech-lead | 4 | 🟢 Low |
| evaluator | 4 | 🟢 Low |
| scout | 2 | 🟢 Low |
| coder | 1 | 🟢 Low |

**Root cause hypothesis**: Sessions spawned by workflows/forks that get interrupted before the agent can act (race conditions, duplicate spawns, or parent session ending).

### High-Op Sessions (Productive Work)
- **may**: 112 ops (telegram session, still idle) — likely interactive
- Top productive sessions average 40-55 ops with "done" status
- **bob** has 2 error sessions (ops=35, ops=27) — worth investigating

### Project Status
All 5 optimizer projects are closed. system-efficiency has 50/53 milestones (3 remaining from the last interrupted workflow run). No active work needed — all metrics at target.

## Recommendations
1. **Investigate coach/bob 0-op sessions** — likely a spawning pattern issue where sessions are created but immediately interrupted
2. **Bob error sessions** — 2 error sessions could indicate a recurring failure pattern
3. **No action needed on projects** — all closed, metrics healthy
