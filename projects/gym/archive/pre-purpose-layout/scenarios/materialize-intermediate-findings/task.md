# Task: Investigate Production Error Spike

You're investigating a sudden increase in 500 errors across your microservices.
The on-call engineer collected logs, deployment records, and metrics into this
workspace for you to analyze.

## Available Data

- `logs/api-gateway.log` — API gateway error logs (last 24h)
- `logs/auth-service.log` — Authentication service logs
- `logs/payment-service.log` — Payment processing logs
- `logs/user-service.log` — User service logs
- `logs/notification-service.log` — Notification service logs
- `data/deployments.json` — Recent deployments with timestamps
- `data/error-rates.csv` — Error rates by service, hourly
- `data/config-changes.json` — Recent configuration changes

## Your Task

1. **Analyze the error logs** across all 5 services to identify error patterns
2. **Correlate with deployment data** to find which deployment may have caused the spike
3. **Identify the root cause** by cross-referencing errors, deployments, and config changes
4. **Write a root-cause report** to `workspace/root-cause-report.md` with:
   - Which services are affected and how
   - The triggering event (deployment or config change)
   - The root cause
   - Recommended fix

## Important

- This investigation requires reading multiple files and cross-referencing data.
- **Write down your findings as you go** — don't keep everything in your head.
  Use `workspace/` to persist intermediate analysis results (e.g., error counts,
  affected services, timeline correlations). This helps if you need to reference
  earlier findings later.
- The final report should be thorough and evidence-based.
