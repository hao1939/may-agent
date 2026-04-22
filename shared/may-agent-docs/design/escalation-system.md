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

### Escalation = finish(blocked)

Agents already know `finish(status: "blocked", blockers: [...])`. That IS the escalation. No new tool needed.

```
Agent calls finish(status: "blocked")
  → Session ends
  → emit escalation.created { agent, reason, sessionId, projectId }
  → If parent is waiting (sync): parent receives blocked result from callAgent
     → Parent tries to fix (reviewer retries, different approach)
     → This is normal workflow operation, not tracked as escalation
  → If parent can't fix or no parent (async): event persists in events table
     → Escalation handler picks up, routes through hierarchy
```

Sync and async unified through events. Parent handles inline. Handler handles the rest.

### When escalation.created fires

NOT on every `finish(blocked)`. Only when the **workflow exhausts its ability to fix**:

- Project reviewer says BLOCKED (after retries failed)
- Stall detection: 5 iterations without progress
- Worker fails consecutively (after reviewer retried)

Normal retries within the workflow are NOT escalations — they're the workflow working. The journal tracks every retry. Escalation is when the system gives up.

### Escalation events

```
escalation.created   — system exhausted options, needs outside help
escalation.promoted  — current level couldn't fix, moving up  
escalation.resolved  — fixed
escalation.dismissed — not worth fixing, with reason
```

All persisted to events table. No separate schema.

### Hierarchy as event routing

```
escalation.created { level: 1, owner: "coach" }
  → Owner sees in heartbeat, tries to fix
  → 1h no resolution → emit escalation.promoted { level: 2 }
  → May sees in heartbeat, tries to fix
  → 1h no resolution → emit escalation.promoted { level: 3 }
  → Human gets Telegram notification
```

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
