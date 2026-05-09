# May Heartbeat Log

## 2026-05-09T17:25 UTC — Steward Audit

### System Health Summary
- **Active sessions**: 2 (healthy)
- **Handler success rate**: 99.6% (excellent)
- **Session error rate**: 3.96% (within target)
- **Real output (24h)**: 1,036 (strong)
- **DB size**: 1,113 MB (monitor — 2GB threshold)

### Metrics Requiring Attention
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Active project iterations (24h) | 0 | 1 | ⚠️ Below threshold |
| Scout good session rate | 24.8% | 65% | ⚠️ Critical |
| Scout operational friction | 83.8% | 30% | ⚠️ Critical |

### Key Observations
- 160 sessions listed as "active" but most are stale/interrupted from days ago
- Scout metrics are the primary area of concern
- All health checks passing (zombies, stale sessions, delivery all PASS)
- Evaluator pipeline healthy: 23 LLM-evaluated sessions in 24h, 0.88h eval lag
