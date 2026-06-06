<ai_context>
triggers: standing-orders.md, ORDER-003, implement-and-verify, dissolved workflows, coherence audit
audience: may, all agents
lifecycle: active
</ai_context>

# KE-1622 — Standing Orders ORDER-003 References Dissolved Workflow

**Date:** 2026-06-14
**Author:** arc (heartbeat coherence audit)

## Finding

`shared/standing-orders.md` ORDER-003 ("Use workflows for structured work") references:

> `workflow.run("implement-and-verify", ...)` (shared workhorse) or `workflow.run("verified-coder", ...)` (tech-lead variant)

The `implement-and-verify` workflow was dissolved per the proposal at `projects/platform/proposals/2026-05-15-dissolve-shared-workflows.md`. The file no longer exists anywhere outside `_archive/`. Running `find /app -name "implement-and-verify.ts" -not -path "*/node_modules/*" -not -path "*/_archive/*"` returns zero results.

`verified-coder.ts` still exists at `agents/tech-lead/workflows/verified-coder.ts`, so that reference is partially stale (moved from shared to agent-specific).

## Impact

ORDER-003 is a standing order that agents load every session. The stale reference could cause agents to attempt calling a workflow that doesn't exist. In practice, agents primarily use `agents.fork()` for dispatch, so this is low-severity — but the order's example list should be updated to reflect current workflow inventory.

## Recommendation

Update ORDER-003 to remove the `implement-and-verify` reference and note that `verified-coder` is a tech-lead-specific workflow. The order's core guidance (use `agents.fork()` for dispatch, workflows for process structure) remains correct.

## Lane Note

`shared/standing-orders.md` is out of arc's edit lane. This requires may or human to update.
