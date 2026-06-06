# Proposal: Remove dissolved implement-and-verify references from standing-orders.md and common-sense.md

**Date:** 2026-06-08
**Author:** arc
**Backing KE:** KE-1622, KE-1628
**Approver:** May or Hao (both files are out of arc's edit lane)
**Priority:** P1

## Problem

`shared/standing-orders.md` ORDER-003 (line 19) and `shared/common-sense.md` (line 38) both recommend `workflow.run("implement-and-verify", ...)` for code changes. This workflow was dissolved per `projects/platform/proposals/2026-05-15-dissolve-shared-workflows.md`.

Verified 2026-06-08: `find /app -name "implement-and-verify*" -not -path "*/node_modules/*" -not -path "*/_archive/*"` returns zero results.

This is a separate issue from the prior typo fixes (`implement-and-review` → `implement-and-verify`) which were completed on 2026-06-06 (work-queue item marked done). The typo was fixed, but the workflow it was fixed *to* no longer exists.

## Proposed Changes

### Edit 1 — `shared/standing-orders.md` ORDER-003 lines 17-19

Replace:
```markdown
- **Projects** → project handler dispatches tasks or owner agent sessions
- **Heartbeats** → per-agent heartbeat workflow (launched by cron)
- **Code changes** → `workflow.run("implement-and-verify", ...)` (shared workhorse) or `workflow.run("verified-coder", ...)` (tech-lead variant)
```

With:
```markdown
- **Projects** → project handler dispatches tasks or owner agent sessions
- **Heartbeats** → per-agent heartbeat workflow (launched by cron)
- **Code changes** → `workflow.run("verified-coder", ...)` (tech-lead) or inline via `agents.fork()` to dev
```

### Edit 2 — `shared/common-sense.md` line 38

Replace:
```markdown
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-verify", ...)`.
```

With:
```markdown
**Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you.
```

Rationale: The `agents.fork()` recommendation is the correct and sufficient dispatch primitive per ORDER-003's own core guidance. The dissolved workflow example adds confusion.

## Evidence

- `find /app -name "implement-and-verify*" -not -path "*/node_modules/*" -not -path "*/_archive/*"` → 0 results
- Current workflow inventory shows `verified-coder.ts` exists only at `agents/tech-lead/workflows/verified-coder.ts` (agent-specific, not shared)
- KE-1622 and KE-1628 document these exact stale references

## Risks

- **Risk:** Removing the code-changes guidance leaves agents without workflow direction. **Mitigation:** ORDER-003 still names `verified-coder` and the core `agents.fork()` dispatch guidance remains. The project handler and task-worker pattern handle most code changes now.
- **Risk:** `implement-and-verify` is reintroduced. **Mitigation:** Add the reference back when/if it ships.

## Lane Note

Both files are out of arc's edit lane. This proposal follows the pattern from KE-450/KE-451.
