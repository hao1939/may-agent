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

## Revised Design: Convention + Metrics

The project system + metric system + heartbeat visibility IS the escalation system. No new handler, no new events, no promotion timer.

### How it works today

```
Agent stuck → finish(blocked) → caller retries (sync)
Caller gives up → project goes BLOCKED → visible in owner's heartbeat
Owner doesn't act → May sees blocked projects in her heartbeat → nudges owner
May can't fix → May messages human
```

All existing mechanisms. The convention (common-sense.md): "Chain: You → session owner → May → Hao."

### What's missing: metrics to close the loop

Without metrics we can't tell if blocked projects are getting attention. Add:

| Metric | What | Source | Owner |
|--------|------|--------|-------|
| `system.blocked-projects` | Count of projects with status=blocked | Project file scan | may |
| `system.blocked-duration-avg` | Average hours projects stay blocked | project.blocked → project.status-changed events | may |
| `system.blocked-unattended` | Projects blocked >24h with no activity (mtime stale) | Project file scan + mtime | may |

If `system.blocked-unattended` > 0, someone isn't doing their job. May investigates.

### May's accountability role

May's heartbeat already pre-loads ALL projects (including other agents'). Update May's heartbeat.md to explicitly say:

```
## Blocked Project Accountability
Check all blocked projects across all agents (shown above in "Your Projects").
For each blocked project older than 24h:
- Nudge the owner: "Your project X has been blocked for Nh. What's the plan?"
- If owner is unresponsive after 2 nudges: investigate yourself or escalate to Hao
```

### When to build more

If `system.blocked-unattended` stays >0 for a week despite May's nudges, THEN build:
- Time-based auto-promotion (1h → May, 2h → human)
- Dedicated escalation handler
- Escalation events

Evidence first (P5). Prove the convention fails before adding infrastructure.

## Implementation

| Change | LOC | File |
|--------|-----|------|
| Add 3 metrics to metrics table | ~10 | metrics-snapshot handler or manual INSERT |
| Update May's heartbeat.md with accountability section | ~5 | agents/may/heartbeat.md |
| May's heartbeat pre-loads ALL agents' blocked projects | ~10 | may-heartbeat.ts loadProjects to scan all agents |
| Total | ~25 | |

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
