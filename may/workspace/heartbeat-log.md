# Heartbeat Log — 2025-05-08 22:42 UTC

## System Health Summary
- **Throughput**: 50 sessions/hr, 100% success rate
- **Handler fires**: 66/hr (healthy)
- **Health checks**: All PASS (no zombies, no stale sessions)

## Metrics Needing Attention
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Scout good session rate (24h) | 0.36 | 0.85 | ⚠️ RED |
| Scout operational friction rate (24h) | 0.64 | 0.10 | ⚠️ RED |
| Reviewed good sessions overturned (24h) | 0.50 | 0.05 | ⚠️ RED |
| Broad needs-improvement sessions (24h) | 0.61 | 0.10 | ⚠️ RED |

## Key Observations
- Scout has high operational friction — 64% of sessions hit friction. Needs investigation.
- Evaluator overturning 50% of good sessions suggests calibration issues.
- 4 active projects, 2 blocked/waiting >6h.
