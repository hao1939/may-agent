# DESIGN: May-as-Gatekeeper (v2 — Simplified)

**Status:** REVISED — awaiting Hao approval  
**Date:** 2026-04-15  
**Revision:** Simplified per Hao feedback. Dropped git polling, REVIEW_REQUEST protocol, approval ledger, protected path lists.

---

## Approach

May is already the supervisor. The gatekeeper is not a new system — it's May doing her existing job with one additional question: **"does this need Hao's approval?"**

Three changes:

### 1. Agents write plans before acting

Every agent documents intent before executing substantive work: goal, approach, files it will change. This happens naturally in persistent-task projects (worker writes, owner reviews). For non-persistent work, agents write a brief plan in their workspace before forking implementation.

**Heartbeat addition for all agents:**
> Before dispatching substantive work, write a brief plan: what you'll change, why, and which files. For persistent-task projects, the project file IS the plan. For forked sessions, add a 2-3 line intent section to the fork task description.

### 2. May reviews plans during regular supervision

May already reads agent workspace files, project files, and session results during her heartbeat. She adds one judgment step:

**May heartbeat addition:**
> When reviewing agent work, ask: "Would this change how OTHER agents or sessions behave?" If yes — hold for Hao. Set project status to `pending-review` (for persistent tasks) or don't dispatch the next step (for regular work). Notify Hao via telegram: "🔒 Review needed: [agent] plans [change]. See [file path]."

**System-scope signals** (things that affect other agents):
- Changes to shared workflows, guards, or manager code
- Edits to another agent's heartbeat, context.md, or SOUL.md
- New cross-agent protocols or conventions
- Deletion of shared infrastructure

**Agent-scope** (proceed without review):
- Own workspace files, own heartbeat/context
- Knowledge base content (hypotheses, experiments, deep dives)
- Code on review branches (already gated by tsc + tests)

### 3. persistent-task.ts: add `pending-review` status (~8 LOC)

When May sets a project file's status to `pending-review`, the workflow pauses on next iteration check — same as `paused`/`cancelled`. Hao approves via telegram → May sets status back to `active` → next cron cycle resumes the loop.

```typescript
// In the iteration loop status check (~line 357):
if (state.status === "pending-review") {
  return ctx.done(`Paused for human review. See ${config.projectPath}.`);
}
```

---

## What was dropped (and why)

| Original proposal | Why dropped |
|---|---|
| Git diff polling | Too expensive, too late — change already happened |
| REVIEW_REQUEST messages | Voluntary tagging fails exactly when most needed |
| Approval ledger file | May tracks this naturally in her workspace |
| Protected path lists | File-based rules are brittle; judgment is better |
| Telegram command handlers | Natural language already works (/approve → May understands) |

---

## Implementation

| Change | Where | LOC |
|--------|-------|-----|
| "Write plan before acting" instruction | All agent heartbeats | ~2 lines each |
| "Check for system-scope plans" instruction | May's heartbeat | ~3 lines |
| `pending-review` status support | persistent-task.ts | ~8 lines |
| **Total** | | **~20 context + ~8 code** |
