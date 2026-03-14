# System Metrics

## Response Time Targets

| Endpoint    | P50  | P95   | P99   |
|-------------|------|-------|-------|
| /health     | 5ms  | 15ms  | 50ms  |
| /api/query  | 80ms | 200ms | 500ms |
| /api/submit | 50ms | 150ms | 400ms |

## Alert Thresholds

- Error rate > 3% over 5 minutes → page on-call
- P95 latency > 300ms for 10 minutes → warning
- Memory usage > 80% → warning
- CPU usage > 90% for 5 minutes → page on-call
