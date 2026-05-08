# Closed-Loop Steward Audit Log

## Run: 2026-05-08

### Open Alerts Summary
| Alert | Metric | Owner | Status |
|-------|--------|-------|--------|
| #189 | capability.self-directed-iteration-rate-24h | may | No judgment. Nudged may. |
| #190 | capability.process-uptime-h | may | No judgment. Nudged may. |
| #191 | evaluator.low-quality-rate-24h | evaluator | Metric likely miscomputed (counts needs_improvement not low_quality). Re-routed lost evaluator finding to may. |
| #192 | v2.spec-coverage-rate | may | Prior judgment 13h ago; still breaching. Project v2-spec-coverage-buildout status=waiting. |

### Delivery Failures
| Event | From | Issue | Action |
|-------|------|-------|--------|
| #530687 | evaluator | Sent to functions.message | Content re-routed to may via message tool |
| #530208 | evaluator | Sent to functions.message (placeholder) | No action needed |

### Conclusion
- Evaluator context.md line 26 already prohibits functions.message usage; workflow line 335 has guardrail. Recurring issue is model compliance, not code gap.
- All alerts either have prior judgment or have been nudged to owner.
- Next validation: confirm may judges alerts #189/#190/#191 in next heartbeat cycle.

## Audit 2025-01-07T~current

| Issue | Owner | Judgment | Action | Next Signal |
|-------|-------|----------|--------|-------------|
| alert#189 iteration-rate=0.12 | may | self-healing (restart) | none | uptime >1h should resolve |
| alert#190 uptime=0.01h | may | expected post-restart | none | auto-clears at 1h |
| alert#191 low-quality-rate=0.35 | evaluator | actively owned | none | evaluator heartbeat judgment |
| alert#192 spec-coverage=0.27 | may | prior judgment 13h ago (waiting) | none | project pending-review resolves |
| delivery failures #530687/#530208 | evaluator | known-fixed bug (KE-009) | none | no new failures expected |
