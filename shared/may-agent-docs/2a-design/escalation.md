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
// In project workflow, when reviewer says BLOCKED:
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

Sources:
- Project workflow: reviewer says BLOCKED or stall detected
- Agent finish(blocked): session can't continue
- Metric breach unresolved >24h: nobody acted on auto-fork

### Basic routing handler

`agents/may/handlers/escalation.ts` routes `session.escalated` events to the human via Telegram. This is a simple forwarder, not the lifecycle manager described in the proposal below.

---

## Proposed Design (not implemented)

Everything below is a proposal. These events, handlers, and metrics do not exist yet. See KE-1242 for falsifiers.

### Lifecycle Events

**escalation.created** — already shipped (see above). Full payload:

```typescript
ctx.emit({ type: "escalation.created",
  id: `esc_${Date.now()}`,
  projectId: "coach/prove-the-loop",
  agent: "coach",
  level: 1,                    // 1=owner, 2=may, 3=human
  owner: "coach",
  reason: "5 iterations without milestone progress",
  whatWasTried: reviewerDetail, // reviewer's analysis of what failed
  blockers: evaluatorDetail,    // evaluator's assessment
  suggestedFix: "...",          // reviewer's suggestion if any
  iteration: 25,
  health: "3/10",
});
```

**escalation.promoted** — when current level doesn't resolve within timeout:

```typescript
ctx.emit({ type: "escalation.promoted",
  id: "esc_xxx",              // same id as created
  from: 1, to: 2,            // owner → may
  age: "4h",
  reason: "Owner did not resolve within timeout",
});
```

**escalation.resolved** — when the problem is fixed:

```typescript
ctx.emit({ type: "escalation.resolved",
  id: "esc_xxx",
  resolvedBy: "coach",
  resolution: "Switched to file-based approach instead of DB queries",
  duration: "4h",
});
```

**escalation.dismissed** — when decided it's not worth fixing:

```typescript
ctx.emit({ type: "escalation.dismissed",
  id: "esc_xxx",
  dismissedBy: "may",
  reason: "Project scope changed, blocker no longer relevant",
});
```

### Escalation Handler (lifecycle manager)

One handler manages the full lifecycle:

```json
{
  "name": "escalation",
  "handler": "escalation",
  "intervalMs": 1800000,
  "on": ["escalation.created"],
  "description": "Promote unresolved escalations, auto-resolve cleared conditions."
}
```

Every 30 min:
1. Query open escalations: `escalation.created` without matching `resolved`/`dismissed`
2. Level 1 older than 2h → emit `escalation.promoted { to: 2 }` (routes to May)
3. Level 2 older than 2h → emit `escalation.promoted { to: 3 }` (Telegram to human)
4. Check if condition cleared (project no longer blocked) → emit `escalation.resolved`

### Visibility

**Events tab:** All escalation events visible with full context. Filter by `escalation.*`.

**Heartbeat injection:**
```
## Open Escalations
⚠️ [4h, level 2] coach/prove-the-loop: "5 iterations without progress"
   Tried: DB queries failed 3x due to path issues
   Suggested: Use file-based approach or fix DB path
```

Agent sees the FULL context in their heartbeat. Can act immediately.

### Proposed Metrics

| Metric | Query | Owner |
|--------|-------|-------|
| `system.open-escalations` | Count escalation.created without resolved/dismissed | may |
| `system.escalation-resolve-time` | Avg duration between created and resolved | may |
| `system.blocked-unattended` | Escalations at level 1 older than 2h (owner not acting) | may |

### Implementation Estimate

| Change | LOC | File |
|--------|-----|------|
| Emit escalation.created in project workflow | ~15 | project.ts |
| Escalation handler (promote, auto-resolve) | ~50 | agents/may/handlers/escalation.ts |
| Heartbeat: pre-load open escalations | ~15 | per-agent heartbeat workflows |
| Metrics registration | ~10 | metrics table INSERT |
| Total | ~90 | |

No new schema. Events table handles everything.
