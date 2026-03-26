Phase 1: INVESTIGATE ERROR LOGS — Read logs and document your findings.

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

## Your Task (Phase 1 — Investigation Only)

1. **Read the error logs** for each of the 5 services
2. **Read the deployment data** (`data/deployments.json`)
3. **Document your findings** as you go — after reading each batch of 2-3 files,
   write what you've found to a workspace file:
   - Write `workspace/error-analysis.md` with error patterns per service
     (error counts, error types, timestamps of first/last occurrence)
   - Write `workspace/timeline-correlation.md` with a timeline of events
     correlating errors with deployments

**CRITICAL**: You MUST write `workspace/error-analysis.md` and
`workspace/timeline-correlation.md` in this phase. Do NOT write the final
root-cause report yet — just document what you observe in each log file.
Persist your intermediate findings to disk after every 2-3 files you read.

---

Phase 2: CORRELATE AND REPORT — Produce the root-cause report.

A previous investigation phase analyzed the error logs and deployment data.
The findings are documented in workspace files.

1. **Read the Phase 1 analysis artifacts**:
   - `workspace/error-analysis.md` — error patterns per service
   - `workspace/timeline-correlation.md` — timeline of events
2. **Read the remaining data files** you haven't analyzed yet:
   - `data/error-rates.csv` — hourly error rates
   - `data/config-changes.json` — recent configuration changes
3. **Cross-reference** the Phase 1 findings with the config changes and error rates
   to identify the root cause
4. **Write the final root-cause report** to `workspace/root-cause-report.md` with:
   - Which services are affected and how
   - The triggering event (deployment or config change)
   - The root cause
   - Recommended fix

The report should be thorough, evidence-based, and reference specific data
from your earlier analysis files and the data files.
