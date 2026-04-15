# DESIGN: May-as-Gatekeeper (v3 — Workflow IS the Process)

**Status:** REVISED — awaiting Hao approval  
**Date:** 2026-04-15  
**Revision:** v3 per Hao feedback. The gatekeeper is not a system — it's one judgment call inside the persistent-task owner review step.

---

## Core Insight

Persistent-task already has a structural review loop: worker does work → output persisted to project file → owner reviews → decides CONTINUE / DONE / BLOCKED. The loop can't proceed without owner review — it's structural, not optional.

The gatekeeper is May adding one question during her owner review: **"Did this iteration change system behavior?"** If yes → `pending-review` → Hao decides. The workflow handles pause/resume. No new process to remember.

## Changes (3 items)

### 1. `persistent-task.ts`: Add `pending-review` status (~8 LOC)

```typescript
// In the iteration loop status check:
if (state.status === "pending-review") {
  return ctx.done(`Paused for human review. See ${config.projectPath}.`);
}
```

Same mechanism as `paused`/`cancelled` — workflow exits, resumes on next cron cycle when status changes back to `active`.

### 2. May's owner review prompt: Add system-scope check

In the persistent-task owner review step (the prompt that asks May to evaluate the iteration), add:

> If this iteration changed shared workflows, other agents' configs, guards, or core runtime code, respond with PENDING_REVIEW instead of CONTINUE. Add a note explaining what needs human approval.

**System-scope** = affects other agents: shared workflows, guards, manager code, another agent's heartbeat/context/SOUL, cross-agent protocols.  
**Agent-scope** = own workspace, own knowledge entries, code on review branches. Proceed normally.

### 3. Telegram: `/approve` and `/reject` flow naturally

Hao sends `/approve` or `/reject` → reaches May as natural language → May reads the pending project file, updates Status from `pending-review` to `active` (or `cancelled`). No command parser needed.

## What's NOT needed

- ~~Git diff polling~~ — workflow brings results to May structurally
- ~~REVIEW_REQUEST protocol~~ — owner review IS the review request
- ~~Approval ledger~~ — project file tracks status
- ~~Protected path lists~~ — May's judgment, not file rules
- ~~Heartbeat instructions for agents~~ — agents don't gate themselves; the owner (May) gates them
- ~~Separate review step in May's heartbeat~~ — persistent-task owner review IS the review step

## Implementation Cost

| Change | Where | LOC |
|--------|-------|-----|
| `pending-review` status handling | persistent-task.ts | ~8 |
| System-scope check in owner review prompt | persistent-task.ts (owner prompt template) | ~2 |
| **Total** | | **~10 lines of code** |

Zero behavioral/context changes. The workflow encodes the process.
