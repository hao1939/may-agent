# Design: Escalation System

**Status:** Proposal
**Date:** 2026-04-22
**References:** [core-principles.md](core-principles.md) (P2, P3), [closing-the-loop.md](closing-the-loop.md)

## Problem

Escalations are scattered, don't follow hierarchy, and never close. 155 entries in jsonl, 34 in requests, all unresolved. Nobody follows up.

## Rules

1. **Tracked** — every escalation in one table, easily reviewed
2. **Hierarchy** — agent → owner/caller → May → human. Each level tries to fix before escalating up
3. **Closed loop** — must be resolved or dismissed with reason
4. **Metrics** — open count, time to resolve, rate per agent

## Design

### Escalation is an event

No separate table. Escalations are events — tracked, persisted, routable through the existing event system.

```
Agent blocked → emit escalation.created { agent, owner, reason, projectId, level: 1 }
Owner timeout → emit escalation.promoted { id, level: 2 }
May timeout   → emit escalation.promoted { id, level: 3 } + Telegram notify
Fixed         → emit escalation.resolved { id, resolvedBy, resolution }
Dismissed     → emit escalation.dismissed { id, dismissedBy, reason }
```

Query all escalations:
```sql
SELECT * FROM events WHERE event_type LIKE 'escalation.%' ORDER BY timestamp DESC
```

Query open escalations (created but not resolved/dismissed):
```sql
SELECT e.* FROM events e
WHERE e.event_type = 'escalation.created'
AND NOT EXISTS (
  SELECT 1 FROM events r 
  WHERE r.event_type IN ('escalation.resolved', 'escalation.dismissed')
  AND json_extract(r.data, '$.id') = json_extract(e.data, '$.id')
)
ORDER BY e.timestamp DESC
```

The events table IS the escalation log. No new schema.

### Hierarchy

```
Agent hits a problem
  → Level 1: notify owner/caller via request
  → Owner gets it in heartbeat, tries to fix
  → If unresolved after 2 heartbeat cycles (~1h):
      → Level 2: escalate to May
  → May gets it in heartbeat, tries to fix
  → If unresolved after 2 heartbeat cycles (~1h):
      → Level 3: escalate to human (Telegram)
```

Each level change updates `level` and `escalatedAt` in the table.

### Who resolves

- **Owner**: can resolve by fixing the issue and marking resolved
- **May**: can resolve, redirect to another agent, or escalate to human
- **Human**: resolves or dismisses with reason
- **System**: auto-resolves if the condition clears (e.g., project unblocks, metric recovers)

### Sources of escalation

| Source | When | Level starts at |
|--------|------|----------------|
| Project workflow blocked | Evaluator says BLOCKED | 1 (owner) |
| Project workflow stalled | 5 iterations without progress | 1 (owner) |
| Session finish(status: blocked) | Agent declares blocked | 1 (caller) |
| Guard blocks repeatedly | Same guard blocks same agent 3x | 1 (owner) |
| Metric breach unresolved >24h | Alert still open | 2 (May — owner already tried) |

### How it flows in the project workflow

```
Project workflow: evaluator says BLOCKED
  → Insert escalation (level=1, agent=owner)
  → Emit project.blocked event (already done)
  → Owner sees in next heartbeat: "You have 1 open escalation"
  → Owner acts or ignores
  → After 1h: escalation handler promotes to level=2 (May)
  → May sees in heartbeat: "1 escalation needs your attention"
  → May acts or escalates
  → After 1h: promotes to level=3 (human, Telegram)
```

### Escalation Handler

One handler that manages the escalation lifecycle:

```json
{
  "name": "escalation",
  "handler": "escalation",
  "intervalMs": 1800000,
  "on": ["escalation.created", "project.blocked", "session.escalated"],
  "description": "Manage escalation lifecycle: route, promote, auto-resolve."
}
```

Every 30 min (and on escalation events):
1. Query open escalations from events table
2. For each: check current level and age
3. Level 1 older than 1h → emit `escalation.promoted { level: 2 }` (routes to May)
4. Level 2 older than 1h → emit `escalation.promoted { level: 3 }` (notify human)
5. Check if conditions cleared (project unblocked, metric recovered) → emit `escalation.resolved`

### Heartbeat Integration

Heartbeat pre-loads open escalations for the agent:

```
## Your Escalations
⚠️ [OPEN 2h] prove-the-loop blocked: "5 iterations without progress" — you own this, investigate or escalate
```

Agents see their escalations every heartbeat. Can't miss them.

### Resolution

Conditions that auto-resolve (escalation handler detects and emits `escalation.resolved`):
- Project status changed from blocked → active
- Metric recovered above threshold
- Session retry succeeded

Manual resolution:
- Agent finishes work that addresses the blocker
- May dismisses with reason
- Human dismisses via Telegram or dashboard

### Metrics

All derived from events table queries — no separate tracking:

| Metric | Query | Owner |
|--------|-------|-------|
| `system.open-escalations` | Count of `escalation.created` without matching resolved/dismissed | may |
| `system.escalation-rate` | `escalation.created` events per day | may |
| `system.escalation-resolve-time` | Avg time between created and resolved events | may |
| `agent.escalations` | Open per agent from event data | each agent |

## Migration

1. Create escalation handler (agents/may/handlers/escalation.ts) — ~60 LOC
2. Update project workflow: emit `escalation.created` on BLOCKED (instead of just `project.blocked`)
3. Update heartbeat workflows: query open escalations from events table, inject into prompt
4. Register metrics
5. Migrate existing escalations.jsonl → emit as events (one-time script)
6. Remove escalations.jsonl writes from RuntimeCtx

## Total: ~80 LOC

- Handler: ~60 LOC
- Heartbeat integration: ~10 LOC
- Project workflow emit: ~10 LOC
- No new schema — uses events table
