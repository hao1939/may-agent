# KE-1242 — escalation design claims "shipped (partial)" but only `escalation.created` + per-session router are live; promote/resolve/dismiss and the three metrics are aspirational

**Date:** 2026-05-12
**Author:** arc (coherence audit)
**Status:** drift / stale design doc — fixed in design lane

## Claim under audit

`agents/shared/may-agent-docs/design/escalation.md` (header: "shipped
(partial)"; date 2026-04-22) specifies:

1. Four event shapes: `escalation.created`, `escalation.promoted`,
   `escalation.resolved`, `escalation.dismissed`.
2. An **escalation handler** that every 30 min: queries open escalations,
   promotes Level 1 → 2 → 3 by age, and auto-resolves cleared conditions.
3. A **heartbeat injection** section that pre-loads open escalations into
   every agent's heartbeat context.
4. Three metrics owned by may: `system.open-escalations`,
   `system.escalation-resolve-time`, `system.blocked-unattended`.

## What is actually live (2026-05-12)

### Events (30d window via `query_db`)

```sql
SELECT event_type, COUNT(*) FROM events
WHERE event_type LIKE 'escalation.%'
  AND timestamp > strftime('%s','now')*1000 - 30*86400000
GROUP BY event_type;
```

Result: **`escalation.created` × 205, all other types × 0.** No
`escalation.promoted`, `escalation.resolved`, or `escalation.dismissed`
has ever fired in the audited 30-day window.

Reason distribution over the last 7 days: **205/205 with the identical
reason** `"Owner triage for capability.session-trace-completeness did
not produce a valid METRIC_ALERT_OPERATION"`. The created stream is one
unattended retry loop, not a lifecycle.

### Handler

`agents/may/handlers/escalation.ts` subscribes to `session.escalated`
(not `escalation.created`) and calls `ctx.sdk.escalate(agent, reason)`
for one session at a time. It does **not**:
- query open escalations,
- promote by age,
- emit `escalation.promoted` / `escalation.resolved` /
  `escalation.dismissed`,
- check whether conditions cleared.

The "every 30 min open-escalation sweep" described in the design is not
implemented in this file or any other handler under `agents/`.

### Metrics

```sql
SELECT id, status FROM metrics
WHERE id IN ('system.open-escalations',
             'system.escalation-resolve-time',
             'system.blocked-unattended');
```

Result: **0 rows.** None of the three metrics exist; nothing measures
the lifecycle today.

### Heartbeat injection

No agent's heartbeat prompt contains an "Open Escalations" section
populated from `escalation.created`. The design doc's `## Open
Escalations` block is not a live injection.

## Why this is drift, not just aspiration

The doc header says **"shipped (partial — `escalation.created` events
fire in production; full escalation chain not yet implemented)"**.
That hedging is honest for the chain, but the rest of the doc presents
the handler, the heartbeat injection, and the three metrics as if they
are implementation specs in flight. They have not moved in the ~3 weeks
since the doc landed (2026-04-22 → 2026-05-12) and there is no project
or open KE driving them. Meanwhile the **created** stream is leaking
identical retries (205/205 same reason), which is exactly the failure
mode `escalation.promoted`/`resolved` was supposed to surface.

This matters for:
- Agents reading the doc to understand how to react to escalations
  (they'll look for nonexistent metrics and a nonexistent handler).
- The closed-loop steward / aftermath agents that might assume a
  resolve path exists.
- Audit cadence: KE-1240 just fixed a similar drift in
  `agent-metrics.md`; same pattern.

## Action

1. Updated the design doc status to clearly distinguish what is shipped
   (`escalation.created` emission + per-session `session.escalated`
   router → human) from what is **unimplemented spec** (promote/resolve/
   dismiss lifecycle, the three metrics, heartbeat injection).
2. Filed this KE so the next coherence audit doesn't repeat the
   discovery work.
3. Did **not** start a project. The design is unimplemented but no
   downstream consumer is currently blocked on the lifecycle (the
   identical-reason retry loop is a separate metric-alert-reactor
   issue, not an escalation-handler issue). If someone wants the
   lifecycle, they should propose it explicitly.

## Falsifiers

- F1: An `escalation.promoted` event appears in the events table in any
  window after 2026-05-12 → handler shipped, reopen the doc.
- F2: A metric with id `system.open-escalations` / `system.escalation-
  resolve-time` / `system.blocked-unattended` appears in `metrics`
  status='active' → metrics shipped, reopen the doc.
- F3: The 205-and-counting identical-reason retry loop is reduced by
  any mechanism (dedup, cooldown, or resolve) without these events
  firing → mechanism is doing the job under a different name; document
  it in the design doc instead.

## Related

- KE-1031 (false-good with only queued escalation — same lifecycle gap
  from the evaluator side).
- KE-1240 (today's prior coherence-audit fix on agent-metrics.md).
- KE-905, KE-906 (prior escalation-loop probes).
