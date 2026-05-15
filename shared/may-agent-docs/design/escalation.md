# Design: Escalation System

**Status:** **mostly unimplemented spec** as of 2026-05-12 (audit: KE-1242).
What is live: per-session `session.escalated` → human router in
`agents/may/handlers/escalation.ts`, and `escalation.created` emission
from the project workflow (205 events in the last 30d, all with the
same reason — i.e. a retry loop, not a lifecycle).
What is **not** implemented despite appearing as a spec below:
`escalation.promoted` / `escalation.resolved` / `escalation.dismissed`
emission, the every-30-min open-escalation sweep + promote/auto-resolve
handler, the heartbeat "Open Escalations" injection, and the three
`system.*-escalation*` metrics. Treat those sections as a **proposal**,
not a description of running behavior. See KE-1242 for falsifiers.
**Date:** 2026-04-22 (audited 2026-05-12)
**References:** [core-principles.md](../principles/core-principles.md) (P1, P2, P3); KE-1242

## Problem

Blocked projects and stuck agents need outside help. Today: project goes BLOCKED, sits there. Nobody knows why, nobody acts. No context, no follow-up.

## Principle

Escalation is an event with rich context. Someone reading it should understand the problem and be able to act — no journal diving.

## Escalation Events

### escalation.created

Emitted when the system exhausts its ability to fix and needs outside help.

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

Sources:
- Project workflow: reviewer says BLOCKED or stall detected
- Agent finish(blocked): session can't continue
- Metric breach unresolved >24h: nobody acted on auto-fork

### escalation.promoted

When current level doesn't resolve within timeout.

```typescript
ctx.emit({ type: "escalation.promoted",
  id: "esc_xxx",              // same id as created
  from: 1, to: 2,            // owner → may
  age: "4h",
  reason: "Owner did not resolve within timeout",
});
```

### escalation.resolved

When the problem is fixed.

```typescript
ctx.emit({ type: "escalation.resolved",
  id: "esc_xxx",
  resolvedBy: "coach",
  resolution: "Switched to file-based approach instead of DB queries",
  duration: "4h",
});
```

### escalation.dismissed

When decided it's not worth fixing.

```typescript
ctx.emit({ type: "escalation.dismissed",
  id: "esc_xxx",
  dismissedBy: "may",
  reason: "Project scope changed, blocker no longer relevant",
});
```

## How Context Gets Into the Event

The project workflow already has the context:

```
Worker fails → reviewer analyzes why → reviewer says BLOCKED with reason
  → Evaluator scores with assessment
  → Workflow packages both into escalation.created
```

```typescript
// In project workflow, when reviewer says BLOCKED:
emitProjectEvent(ctx, config, "escalation.created", {
  id: `esc_${Date.now()}`,
  level: 1,
  reason: decision.detail.slice(0, 300),        // reviewer's BLOCKED reason
  whatWasTried: workerSummary.slice(0, 300),     // what the worker did
  blockers: decision.detail,                      // full blocker text
  suggestedFix: extractSuggestion(decision.detail), // if reviewer suggested anything
  iteration,
  health: `${score}/10`,
});
```

## Escalation Handler

One handler manages lifecycle:

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

## Visibility

### Events tab
All escalation events visible with full context. Filter by `escalation.*`.

### Heartbeat injection
```
## Open Escalations
⚠️ [4h, level 2] coach/prove-the-loop: "5 iterations without progress"
   Tried: DB queries failed 3x due to path issues
   Suggested: Use file-based approach or fix DB path
```

Agent sees the FULL context in their heartbeat. Can act immediately.

### Metrics

| Metric | Query | Owner |
|--------|-------|-------|
| `system.open-escalations` | Count escalation.created without resolved/dismissed | may |
| `system.escalation-resolve-time` | Avg duration between created and resolved | may |
| `system.blocked-unattended` | Escalations at level 1 older than 2h (owner not acting) | may |

## Implementation

| Change | LOC | File |
|--------|-----|------|
| Emit escalation.created in project workflow | ~15 | project.ts |
| Escalation handler (promote, auto-resolve) | ~50 | agents/may/handlers/escalation.ts |
| Heartbeat: pre-load open escalations | ~15 | per-agent heartbeat workflows |
| Metrics registration | ~10 | metrics table INSERT |
| Total | ~90 | |

No new schema. Events table handles everything.
