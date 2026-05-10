# Heartbeat Log — 2026-05-10

## Red Metric Triage

### project.iterations-24h: 0 (target 10)
**Operation: Downgrade / Known structural**
Per KE-905 and KE-902, this metric fires because active projects are in waiting/paused/blocked states. The system has 420 completed sessions and 1046 real outputs in 24h. The one blocked project (finish-blocked-hygiene-reduction) is owned by dev and blocked on human/ops action.

### capability.message-conversation-close-rate: 0 (target 0.05)
**Operation: Downgrade / Not instrumentable**
The notification_messages table has no status/closed column — no mechanism to track conversation closures exists in the schema.

## System Health
- Sessions (6h): evaluator 179, may 77, scout 47, dev 25, arc 22
- Errors: scout 4, evaluator 1, arc 1 — all low rate
- Blocked project: finish-blocked-hygiene-reduction (dev) — needs human to run metric registration SQL

## 2026-05-10T01:55Z — Artifact Gate Recovery

**Status**: System healthy, 98% success rate over last hour (51/52 sessions).

**Key metrics**:
- 4 breached metrics: message conversation close rate, active project iterations (0), scout good session rate (0.38), scout operational friction rate (0.80)
- DB size: 1134MB (threshold 2000MB)
- All 15 cron jobs healthy, 0 errors
- 161 "active" sessions but most are stale/interrupted — not a real concern

**No action taken** — this session was an artifact gate recovery, not a real task.
