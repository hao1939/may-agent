# Operations Runbook

## Service Overview

The monitoring stack consists of:
- Health check service (polls endpoints every 30s)
- Alerting service (evaluates thresholds and sends notifications)
- Log aggregation (collects and indexes service logs)

## Common Issues

### High Latency Alerts
1. Check if the database connection pool is exhausted
2. Verify Redis cache is responding
3. Check for recent deployments that may have introduced regressions

### Memory Alerts
1. Check for memory leaks in long-running services
2. Verify garbage collection is working properly
3. Consider restarting the affected pod

## Deployment Procedures

1. Always deploy to staging first
2. Monitor error rates for 15 minutes post-deploy
3. Roll back if error rate exceeds 5%
