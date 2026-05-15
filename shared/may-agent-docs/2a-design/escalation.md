# Design: Escalation System

**Status:** partial — basic routing shipped, lifecycle not implemented
**Date:** 2026-04-22 (audited 2026-05-12)
**References:** [core-principles.md](../1-principles/core-principles.md) (P1, P2, P3); KE-1242

## Problem

Blocked projects and stuck agents need outside help. Today: project goes BLOCKED, sits there. Nobody knows why, nobody acts. No context, no follow-up.

## Principle

Escalation is an event with rich context. Someone reading it should understand the problem and be able to act — no journal diving.

## What Shipped

### escalation.created emission

The project workflow emits `escalation.created` when the reviewer says BLOCKED:

```typescript
emitProjectEvent(ctx, config, "escalation.created", {
  id: `esc_${Date.now()}`,
  level: 1,
  reason: decision.detail.slice(0, 300),
  whatWasTried: workerSummary.slice(0, 300),
  blockers: decision.detail,
  suggestedFix: extractSuggestion(decision.detail),
  iteration,
  health: `${score}/10`,
});
```

205 events in last 30d (most with the same reason — a retry loop, not a real lifecycle).

### Basic routing handler

`agents/may/handlers/escalation.ts` routes `session.escalated` events to the human via Telegram. This is a simple forwarder, not the lifecycle manager described in the proposal below.

---

## Proposed Design (not implemented)

Everything below is a proposal. None of these events, handlers, or metrics exist.

### Lifecycle events

- `escalation.promoted` — current level didn't resolve within timeout, escalate to next level
- `escalation.resolved` — problem fixed
- `escalation.dismissed` — decided not worth fixing

### Escalation handler (lifecycle manager)

Every 30 min:
1. Query open escalations: `escalation.created` without matching `resolved`/`dismissed`
2. Level 1 older than 2h → promote to level 2 (routes to May)
3. Level 2 older than 2h → promote to level 3 (Telegram to human)
4. Check if condition cleared (project no longer blocked) → auto-resolve

### Heartbeat injection

Inject open escalations into agent heartbeats so they can act on them.

### Proposed metrics

| Metric | What |
|--------|------|
| `system.open-escalations` | Count unresolved escalations |
| `system.escalation-resolve-time` | Avg duration created → resolved |
| `system.blocked-unattended` | Level 1 escalations older than 2h |
