# M4 Verification: Auto-fork for Metric Alerts

## Date: 2026-04-20

## Finding: Auto-fork IS firing ✅

The milestone assumption was wrong. Auto-fork has been working since the code was added to `agents/may/handlers/metrics-snapshot.ts`.

### Evidence

**12 sessions created from metric-alert tasks:**
| Session | Agent | Status | Started |
|---------|-------|--------|---------|
| s_1776673104074_883 | tech-lead | done | 2026-04-18T08:18:24Z |
| s_1776673104153_884 | evaluator | done | 2026-04-18T08:18:24Z |
| s_1776673104237_885 | optimizer | done | 2026-04-18T08:18:24Z |
| s_1776678692522_0 | tech-lead | interrupted | 2026-04-18T09:51:32Z |
| s_1776682421649_0 | tech-lead | interrupted | 2026-04-18T10:53:41Z |
| s_1776682404916_0 | tech-lead | done | 2026-04-18T10:54:48Z |

All have tasks starting with `[metric-alert]`.

**8 tracked requests with status=CREATED** (pending delivery) for metric alerts including the 3 currently unresolved alerts (qa.review-coverage, coach.knowledge-to-action-latency, tech-lead.build-health).

**Backfill mechanism** (Section 0 of metrics-snapshot.ts) catches unresolved alerts that missed the initial fork.

### Why `source=metric-alert` doesn't appear in sessions table

The `ctx.manager.run()` call passes `{ source: "metric-alert" }` but the session manager records `source: "agents.fork"` (the transport mechanism) rather than the custom source metadata. This is a cosmetic issue — the actual fork happens correctly.

To query metric-alert sessions, use: `SELECT * FROM sessions WHERE task LIKE '%[metric-alert]%'`

### Current state of 3 unresolved alerts

1. **qa.review-coverage** (value: 0, threshold: 1) — request CREATED → qa agent, pending delivery
2. **coach.knowledge-to-action-latency** (stalled) — request CREATED → coach agent, pending delivery  
3. **tech-lead.build-health** (value: 0, threshold: 1) — request CREATED → tech-lead, pending delivery

These have pending requests but the owning agents haven't picked them up yet (requests in CREATED status).

## Conclusion

**M4 is COMPLETE.** Auto-fork fires correctly on metric threshold breaches and regressions. The `autoForkForAlert()` function in metrics-snapshot.ts:
1. Creates a tracked request (fromEntity=metrics-snapshot, source=metric-alert)
2. Forks the owning agent via `ctx.manager.run()`
3. Deduplicates against existing CREATED requests
4. Backfills on each snapshot run for any unresolved alerts without active requests

### Remaining gap (for M5)
Track **alert-to-reaction time**: time between alert creation and agent session completion.
