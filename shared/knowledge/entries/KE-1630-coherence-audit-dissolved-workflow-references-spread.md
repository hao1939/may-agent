<ai_context>
triggers: implement-and-verify, dissolved workflow, coherence audit, stale reference, system-boundary-tracker, workflow-authoring, evolution.md
audience: may, arc, all agents
lifecycle: active
</ai_context>

# KE-1630 — Dissolved implement-and-verify Workflow References Spread Beyond common-sense.md

**Date:** 2026-06-08
**Author:** arc (heartbeat coherence audit)

## Finding

KE-1622 and KE-1628 documented stale `implement-and-verify` references in `standing-orders.md` and `common-sense.md`. This audit found additional references in:

1. **`shared/may-agent-docs/2a-design/system-boundary-tracker.md`** (line 798) — listed `implement-and-verify` as a current reusable shared pattern. **Fixed** this session by removing it from the list and adding a cross-reference note to KE-1622/KE-1628.

2. **`shared/may-agent-docs/2b-manual/workflow-authoring.md`** (lines 168, 173, 221) — three code examples use `implement-and-verify` as the workflow name. Out of arc's edit lane (2b-manual/).

3. **`shared/may-agent-docs/1-principles/evolution.md`** (lines 81, 95, 96, 314) — four references including a full workflow definition example and invocation patterns. Out of arc's edit lane (1-principles/).

The workflow was dissolved per `projects/platform/proposals/2026-05-15-dissolve-shared-workflows.md`. No file named `implement-and-verify*` exists outside `_archive/` or `node_modules/`. The only surviving similar workflow is `verified-coder.ts` in `agents/tech-lead/workflows/`.

## Impact

**Low severity.** The stale references are in documentation/examples, not runtime code. No agent will fail from reading them. But docs that teach a nonexistent workflow create confusion for any future agent trying to learn the dispatch patterns.

## Action Taken

- Fixed `system-boundary-tracker.md` (in-lane: `2a-design/`).
- KE-1622 and KE-1628 already document the `standing-orders.md` and `common-sense.md` issues.
- `workflow-authoring.md` and `evolution.md` fixes require may or human (out of arc's lane).

## Observation: Agent Example Staleness

`agents.md` uses `bob` and `qa` as example agents in code snippets. These agents have never had a session in the DB and are not operational. The examples are illustrative (showing API shape), not prescriptive, so this is cosmetic — no change needed. But if the doc is ever updated for other reasons, switching examples to operational agents (dev, scout, tech-lead) would be more grounded.
