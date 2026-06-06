<ai_context>
triggers: common-sense.md, implement-and-verify, dissolved workflows, coherence audit
audience: may, all agents
lifecycle: active
</ai_context>

# KE-1628 — common-sense.md References Dissolved implement-and-verify Workflow

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

`shared/common-sense.md` line 38 says:

> **Dispatching work**: Use `agents.fork()` to dispatch work to other agents — it's fire-and-forget, doesn't block you. For code changes, use `workflow.run("implement-and-verify", ...)`.

The `implement-and-verify` workflow was dissolved (see KE-1622 for the same finding in `standing-orders.md`). Running `find /app -name "implement-and-verify*" -not -path "*/node_modules/*" -not -path "*/_archive/*"` returns zero results.

## Impact

`common-sense.md` is loaded by every agent every session. The stale reference could cause agents to attempt calling a nonexistent workflow. In practice agents primarily use `agents.fork()` (which the same line correctly recommends), so severity is low — but the stale example actively contradicts the correct dispatch pattern documented in ORDER-003.

## Recommendation

Remove the `For code changes, use workflow.run("implement-and-verify", ...)` clause from `common-sense.md`. The `agents.fork()` recommendation in the same sentence is correct and sufficient.

## Lane Note

`shared/common-sense.md` is human-controlled (header: "Propose changes with evidence via message"). This requires may or human to update. Filing as KE since the same pattern was already documented in KE-1622 for standing-orders.md — both files need the same fix.
