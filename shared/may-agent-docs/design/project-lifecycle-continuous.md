# Design: Project Lifecycle — Continuous, Escalated, Immediate

**Status:** Proposal
**Date:** 2026-04-23
**References:** [project-system.md](project-system.md), [escalation-system.md](escalation-system.md)

## Goal

Projects should:
1. Keep working until blocked or done (no idle time)
2. When blocked, escalate through the chain until someone fixes it
3. When unblocked, resume immediately (not wait for timer)

## Current Gaps

| Phase | Works | Broken |
|-------|-------|--------|
| **Working** | Workflow runs continuously, no delay between iterations | Handler runs projects sequentially — project B waits for A |
| **Blocked** | escalation.created event emitted | Nobody subscribes. No escalation handler. Project sits. |
| **Resume** | Handler detects mtime changes every 5 min | No event on unblock. No immediate resume. |

## Fix 1: Parallel project execution

Today the handler runs `await wfMod.execute(ctx)` sequentially for each project. Project B waits for A.

Change to: launch workflows in parallel (fire-and-forget with inflight tracking).

```
// Current (sequential):
for (const project of projects) {
  await wfMod.execute(ctx);  // blocks until done
}

// Proposed (parallel):
for (const project of projects) {
  wfMod.execute(ctx).then(...).catch(...);  // fire and forget
}
```

We had this before and reverted to sequential because of session flooding. The fix: the inflight set prevents re-launching the same project. The zombie cleanup handles stuck sessions. Parallel is safe now.

## Fix 2: Escalation routing

The project handler already subscribes to `metric.breach`. Add `escalation.created` to its `on` list.

When the handler receives `escalation.created`:
1. Find the project (from event data `projectId`)
2. If blocked with no recent activity → add a comment nudging the owner
3. If blocked >2h → May gets notified (handler emits escalation.promoted)
4. If blocked >24h → human gets notified via Telegram

This is just the project handler doing what it already does — scan projects, diagnose, act. The escalation event triggers it immediately instead of waiting for the timer.

```json
{
  "name": "project",
  "handler": "project",
  "intervalMs": 300000,
  "on": ["project.completed", "project.blocked", "metric.breach", "escalation.created"]
}
```

## Fix 3: Immediate resume on comment

When the project workflow processes a comment and sets status to active, it should emit an event:

```typescript
// In project workflow, after comment iteration sets status=active:
emitProjectEvent(ctx, config, "project.resumed", { from: "blocked", trigger: "comment" });
```

The project handler subscribes to `project.resumed`:

```json
"on": ["project.completed", "project.blocked", "metric.breach", "escalation.created", "project.resumed"]
```

Handler fires → sees active project → launches workflow → work continues immediately.

But this only helps when the workflow is already running (processing a comment). For external comments (human edits the file directly), the 5-min timer is the detection mechanism. The `--emit project.commented` CLI is the immediate trigger for humans.

## The Complete Flow

```
Project created (active)
  → Handler detects (timer or event) → launches workflow
  → Workflow runs: worker → reviewer → worker → ... (continuous, parallel)
  → DONE: evaluator PASS → project.completed event → done
  → BLOCKED: 
      → escalation.created event → handler fires immediately
      → Handler nudges owner
      → 2h no fix → escalation.promoted (level 2, May)
      → 24h no fix → escalation.promoted (level 3, human via Telegram)
  → UNBLOCKED (comment added):
      → If workflow running: comment iteration → sets active → project.resumed event
      → If external: mtime change → handler picks up ≤5 min (or --emit for instant)
      → Handler launches workflow → work continues
```

No idle time. No orphaned blocks. No waiting.

## Implementation

| Change | LOC | File |
|--------|-----|------|
| Parallel workflow execution | ~5 | agents/may/handlers/project.ts (remove await) |
| Add escalation.created + project.resumed to handler `on` list | ~2 | agents/may/cron.json |
| Emit project.resumed in workflow | ~3 | agents/shared/workflows/project.ts |
| Escalation promotion logic in handler | ~20 | agents/may/handlers/project.ts or agents/src/lib/project-health.ts |
| Total | ~30 | |
