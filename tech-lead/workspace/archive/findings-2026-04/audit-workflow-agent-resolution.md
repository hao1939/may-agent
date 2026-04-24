# Lens B: Workflow Agent Resolution Bug

**Date**: 2026-04-14
**Target**: `src/lib/workflow-tool.ts`, `src/app/agent-loader.ts`, `agents/tech-lead/workflows/lens-analysis.ts`
**Symptom**: `workflow.run("lens-analysis", ...)` fails with `Agent "undefined" not registered`

## Root Cause

**Deployment gap — the fix exists in source but the running binary predates it.**

### Timeline
1. `lens-analysis.ts` workflow uses `ctx.runAgent(ctx.agent, phasedTask)` to spawn a child session as the calling agent
2. `ctx.agent` was added to `WorkflowContext` in commit `fc29e7e` (2026-04-13 10:17 UTC)
3. Before that commit, `WorkflowContext` had no `agent` field
4. The running binary was compiled before `fc29e7e` — `ctx.agent` resolves to `undefined` (missing property)
5. `manager.callAgent(undefined, ...)` produces `Agent "undefined" not registered`

### Evidence
- `git show fc29e7e^:src/app/agent-loader.ts` — no `agentName` option passed to `createWorkflowTool()`
- `git show fc29e7e^:src/lib/workflow-tool.ts` — no `agent` field on `WorkflowContext`
- Current source (post-fc29e7e) correctly passes `agentName: config.name` and sets `ctx.agent = opts.agentName ?? "unknown"`
- Defensive guard added in `48488e6` catches undefined agent names with clear error message

## Fix

**Restart the process.** The code fix is already on main. No source changes needed.

Alternatively, if restart is not possible soon, the workaround is to hardcode the agent name in the workflow call:
```typescript
// Instead of: ctx.runAgent(ctx.agent, phasedTask)
// Temporarily: ctx.runAgent("tech-lead", phasedTask)  
```
But this defeats the purpose of shared workflows. Restart is the proper fix.

## Severity: MEDIUM
- Blocks all `workflow.run("lens-analysis", ...)` calls
- Workaround exists (use `agents.call()` instead, which works)
- Many other undeployed features also waiting for restart

## Related
- Todo.md note: "Deploy recent merges... needs process restart. 14 commits undeployed since Apr 6."
- This is one of many features blocked by the deployment gap
