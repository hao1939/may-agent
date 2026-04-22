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

### Escalation Table

```sql
CREATE TABLE IF NOT EXISTS escalations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId   TEXT,           -- originating session
  projectId   TEXT,           -- project if applicable
  agent       TEXT NOT NULL,  -- who escalated
  level       INTEGER DEFAULT 1,  -- 1=owner, 2=may, 3=human
  reason      TEXT NOT NULL,
  status      TEXT DEFAULT 'open',  -- open, resolved, dismissed
  resolution  TEXT,           -- how it was resolved/why dismissed
  resolvedBy  TEXT,           -- who resolved it
  createdAt   INTEGER NOT NULL,
  resolvedAt  INTEGER,
  escalatedAt INTEGER         -- when it moved to next level
);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_agent ON escalations(agent);
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
  "on": ["session.escalated", "project.blocked"],
  "description": "Manage escalation lifecycle: create, promote, auto-resolve."
}
```

Every 30 min (and on escalation events):
1. Check for new escalations from events → insert into table
2. Check open escalations at level 1 older than 1h → promote to level 2
3. Check open escalations at level 2 older than 1h → promote to level 3 (notify human)
4. Check if conditions cleared → auto-resolve (project unblocked, metric recovered)

### Heartbeat Integration

Heartbeat pre-loads open escalations for the agent:

```
## Your Escalations
⚠️ [OPEN 2h] prove-the-loop blocked: "5 iterations without progress" — you own this, investigate or escalate
```

Agents see their escalations every heartbeat. Can't miss them.

### Resolution

Agents resolve by adding a comment or taking action that clears the condition. The escalation handler auto-detects:
- Project status changed from blocked → active: auto-resolve
- Metric recovered above threshold: auto-resolve
- Agent explicitly resolves: `finish(escalation_resolved: "reason")`

For dismissal: May or human marks dismissed with reason in the table.

### Metrics

| Metric | Query | Owner |
|--------|-------|-------|
| `system.open-escalations` | `SELECT COUNT(*) FROM escalations WHERE status='open'` | may |
| `system.escalation-rate` | New escalations per day | may |
| `system.escalation-resolve-time` | `AVG(resolvedAt - createdAt) WHERE status='resolved'` | may |
| `agent.escalations` | Open escalations per agent | each agent |

### Dashboard

Escalations tab or section showing:
- Open escalations by level (1/2/3)
- Time at current level
- Agent, project, reason
- Resolution history

## Migration

1. Create escalations table (schema migration in requests.ts)
2. Create escalation handler (agents/may/handlers/escalation.ts)
3. Update project workflow: insert escalation on BLOCKED (instead of just emitting event)
4. Update heartbeat workflows: pre-load open escalations
5. Add metrics
6. Migrate existing escalations.jsonl → table (one-time)
7. Remove escalations.jsonl writes from RuntimeCtx

## Total: ~100 LOC

- Schema: ~15 LOC
- Handler: ~60 LOC  
- Heartbeat integration: ~15 LOC
- Metrics: ~10 LOC
