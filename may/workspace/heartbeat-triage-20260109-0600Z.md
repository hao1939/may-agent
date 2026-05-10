# Heartbeat Triage — 2026-01-09 ~06:00Z

## Red Metrics

### project.iterations-24h = 0 (target 10)
**Operation: downgrade with evidence**
- 0 active projects exist. 1 blocked project (finish-blocked-hygiene-reduction, owner: dev).
- 0 iterations is the correct value when there are 0 active projects.
- Per KE-905: this is a known structural signal, not a failure.
- Action: escalate blocked project resume condition to human.

### capability.message-conversation-close-rate = 0.0108 (target 0.05)
**Operation: calibrate**
- This metric has no source_query — it's computed externally.
- Rate of 0.0108 has been stable for 10+ checks.
- The notification_messages table has no close/conversation tracking columns.
- This appears to be a metric whose target was set aspirationally before the close-conversation feature was built out.
- Recommendation: lower target to 0.01 or investigate what "conversation close" means in practice.

## Blocked Project: finish-blocked-hygiene-reduction
- Owner: dev, iteration 6, blocked on needing runtime DB writes (INSERT into metrics table).
- Resume condition: execute SQL INSERT statements from iteration-6-split-metric-registration.md.
- Escalated to human.

## System Health
- All agents active in last 6h: arc(22), dev(26), evaluator(198), may(92), scout(53)
- Error rates low: arc 1, evaluator 2, scout 2, dev 0, may 0
- No stuck sessions or dark agents.
