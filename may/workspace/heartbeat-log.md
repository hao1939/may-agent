# May Heartbeat Log — 2026-05-09T14:54 UTC

## System Health Summary
- **Active sessions**: 161 (mostly stale/interrupted)
- **Throughput (1h)**: 63 sessions, 87% success rate
- **All health checks**: PASS
- **DB size**: 1105 MB (within threshold)

## Metrics Requiring Attention
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Scout good session rate (24h) | 0.19 | 0.85 | ⚠️ BREACH |
| Scout operational friction rate (24h) | 0.81 | 0.10 | ⚠️ BREACH |
| Failed session triage rate (3h) | 0.75 | 1.00 | ⚠️ BREACH |

## Actions
- No immediate P0 interventions needed; breaches tracked by metric-alert-reactor
- Process uptime only 1 hour — recent restart
