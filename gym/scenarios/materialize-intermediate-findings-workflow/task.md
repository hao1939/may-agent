Phase 1: ANALYZE FIRST BATCH OF LOGS — Read 3 logs, write initial findings.

You're investigating a sudden increase in 500 errors across your microservices.
The on-call engineer collected logs, deployment records, and metrics into this
workspace for you to analyze.

## Available Data (across all phases)

- `logs/api-gateway.log` — API gateway error logs (last 24h)
- `logs/auth-service.log` — Authentication service logs
- `logs/payment-service.log` — Payment processing logs
- `logs/user-service.log` — User service logs
- `logs/notification-service.log` — Notification service logs
- `data/deployments.json` — Recent deployments with timestamps
- `data/error-rates.csv` — Error rates by service, hourly
- `data/config-changes.json` — Recent configuration changes

## Your Task (Phase 1 — First 3 Logs Only)

1. Read these 3 log files:
   - `logs/api-gateway.log`
   - `logs/auth-service.log`
   - `logs/payment-service.log`
2. After reading them, **immediately write** `workspace/error-analysis.md` with
   your findings so far: error counts per service, error types, timestamps of
   first/last occurrence for each service analyzed.

**RULES:**
- Do NOT read the remaining logs or data files — leave those for later phases.
- You MUST write `workspace/error-analysis.md` before finishing this phase.
- Keep your output focused: read 3 files, write 1 findings file, done.

---

Phase 2: ANALYZE REMAINING LOGS + DEPLOYMENTS — Update findings, write timeline.

Phase 1 analyzed the first 3 service logs. Findings are in `workspace/error-analysis.md`.

## Your Task (Phase 2 — Remaining Logs + Deployment Data)

1. Read `workspace/error-analysis.md` (Phase 1 findings)
2. Read the remaining 2 log files:
   - `logs/user-service.log`
   - `logs/notification-service.log`
3. Read `data/deployments.json` for deployment timeline
4. **Update** `workspace/error-analysis.md` — add findings for user-service and
   notification-service to the existing analysis
5. **Write** `workspace/timeline-correlation.md` — create a timeline correlating
   error start times with deployment timestamps

**RULES:**
- Do NOT read `data/error-rates.csv` or `data/config-changes.json` — leave those for Phase 3.
- You MUST update `workspace/error-analysis.md` AND write `workspace/timeline-correlation.md`.
- Read → Analyze → Write. Don't skip the writing step.

---

Phase 3: CORRELATE AND PRODUCE FINAL REPORT — Cross-reference and write root-cause report.

Phases 1-2 analyzed all error logs and deployment data. Findings are documented in:
- `workspace/error-analysis.md` — error patterns per service (all 5 services)
- `workspace/timeline-correlation.md` — timeline of events vs deployments

## Your Task (Phase 3 — Final Correlation and Report)

1. Read `workspace/error-analysis.md` and `workspace/timeline-correlation.md`
2. Read the remaining data files:
   - `data/error-rates.csv` — hourly error rates
   - `data/config-changes.json` — recent configuration changes
3. Cross-reference all findings to identify the root cause
4. **Write** `workspace/root-cause-report.md` with:
   - Which services are affected and how
   - The triggering event (deployment or config change)
   - The root cause (identify the specific config/deployment that caused it)
   - Recommended fix

The report should reference specific data from your analysis files. Be thorough
and evidence-based — cite error counts, timestamps, and correlation points.

When you call `finish()`, include all workspace files as deliverables:
- `workspace/error-analysis.md`
- `workspace/timeline-correlation.md`
- `workspace/root-cause-report.md`
