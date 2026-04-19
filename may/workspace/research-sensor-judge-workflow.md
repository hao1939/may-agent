# Research: Unify Sensor→Judge into Workflow System

**Date**: 2025-01-12  
**Status**: Research / Proposal  
**Requested by**: Hao

## Problem Statement

We have two separate execution systems:
1. **Workflows** — LLM-centric multi-step pipelines (`runAgent()` → `runAgent()`)
2. **Handlers** — JS-native cron jobs with optional LLM spawn (sensor→judge pattern)

The handler system (`HandlerModule.create()`) is a separate runtime from workflows (`WorkflowModule.execute()`). They share no infrastructure for:
- Step tracking / persistence
- Steering / interruption
- Composition (handlers can't call workflows, workflows can't call handlers)
- Observability (different tracing models)

**Hao's insight**: What if workflows could include no-LLM steps for data collection, then conditionally invoke LLM steps for judgment? This would unify both patterns into one runtime.

## Current Architecture

### Workflows
```
WorkflowModule {
  name: string
  description: string
  execute(ctx: WorkflowContext): Promise<WorkflowResult>
}

WorkflowContext {
  task: string
  runAgent(name, task): Promise<TaskResult>    // LLM step
  runWorkflow(name, task): Promise<WorkflowResult>  // sub-workflow
  emit(event): void
  summarize(result): string
  done(summary): WorkflowResult
  escalate(reason): WorkflowResult
}
```

Key property: **Every step is an LLM session** via `runAgent()`. No concept of "compute-only" steps.

### Handlers
```
HandlerModule {
  create(ctx: HandlerContext, entry: CronEntry): () => Promise<void>
}

HandlerContext {
  manager: SubagentManager
  getDb(): SqliteDb
  log(msg): void
  notify(msg): void
  triggerNow(entry): boolean
  emit(event): void
  // ... more runtime APIs
}
```

Key property: **JS runs first**, LLM is optional/conditional. But no step tracking, no steering, no composition.

### The priority-drift Handler (Example)
```
Sensor phase (JS, 0 LLM ops):
  1. Read human-inputs.jsonl → extract topics
  2. Query sessions DB → extract agent activity
  3. Compute alignment score

Decision gate (JS, 0 LLM ops):
  - if alignment >= threshold → return (done)
  - if cooldown active → return (done)

Judge phase (LLM, ~8 ops, conditional):
  - manager.run("may", judgePrompt, { source: "handler" })
```

## Proposed: Unified Workflow with Compute Steps

### Core Idea

Add `ctx.runStep()` alongside `ctx.runAgent()`:

```typescript
interface WorkflowContext {
  // Existing — spawns LLM session
  runAgent(name: string, task: string): Promise<TaskResult>;
  
  // NEW — runs a JS function as a tracked workflow step (no LLM)
  runStep<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  
  // NEW — conditional LLM step (only runs if predicate is true)
  runAgentIf(
    predicate: boolean | (() => boolean),
    name: string, 
    task: string
  ): Promise<TaskResult | null>;
}
```

### Example: priority-drift as a Workflow

```typescript
export const name = "priority-drift";
export const description = "Detect alignment drift between human priorities and agent activity";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // Step 1: Collect human messages (JS, 0 LLM ops)
  const humanData = await ctx.runStep("collect-human-topics", () => {
    return collectHumanMessages(ctx.projectRoot, 48 * 60 * 60 * 1000);
  });
  
  if (humanData.length < 3) {
    return ctx.done("Too few human messages to assess drift");
  }
  
  // Step 2: Collect agent activity (JS, 0 LLM ops)
  const agentData = await ctx.runStep("collect-agent-activity", () => {
    return collectAgentActivity(ctx, 12 * 60 * 60 * 1000);
  });
  
  // Step 3: Compute drift (JS, 0 LLM ops)
  const report = await ctx.runStep("compute-drift", () => {
    return computeDrift(humanData, agentData);
  });
  
  // Step 4: Write report (JS, 0 LLM ops)
  await ctx.runStep("write-report", () => {
    writeFileSync(REPORT_PATH, formatReport(report));
  });
  
  // Step 5: Judge — ONLY if drift detected (LLM, ~8 ops, conditional)
  if (report.alignmentScore < 0.3 && report.driftedTopics.length >= 2) {
    const judgment = await ctx.runAgent("may", buildJudgePrompt(report));
    return ctx.done(`Drift detected, judge invoked: ${judgment.lastAssistantText}`);
  }
  
  return ctx.done(`Alignment ${(report.alignmentScore * 100).toFixed(0)}% — no drift`);
}
```

### What runStep Needs

```typescript
async runStep<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  // 1. Check steering queue (same as runAgent)
  const steering = steeringQueue.shift();
  if (steering) throw new WorkflowInterrupted(steering, completedSteps, runId);
  
  // 2. Emit step_start
  onEvent?.({ type: "step_start", step: name });
  
  // 3. Execute the function
  const startTime = Date.now();
  const result = await fn();
  const duration = Date.now() - startTime;
  
  // 4. Record as a completed step (with synthetic TaskResult)
  const syntheticResult: TaskResult = {
    status: "done",
    sessionId: `compute_${runId}_${name}`,
    lastAssistantText: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 500),
    messages: [],
    duration: `${duration}ms`,
    error: null,
  };
  
  const step: CompletedStep = { step: name, result: syntheticResult };
  completedSteps.push(step);
  
  // 5. Persist step to workflow run
  run.steps.push({
    sessionId: syntheticResult.sessionId,
    agent: `compute:${name}`,
    task: `(compute step)`,
    status: "done",
    startedAt: startTime,
    endedAt: Date.now(),
    lastAssistantText: syntheticResult.lastAssistantText,
  });
  if (persistDir) saveWorkflowRun(persistDir, run);
  
  // 6. Emit step_done
  onEvent?.({ type: "step_done", step: name, result: syntheticResult });
  
  return result;
}
```

## What This Enables

### 1. Handlers become workflows
Every handler can be expressed as a workflow with compute steps. The cron system just triggers `workflow.run("priority-drift", "periodic check")` instead of calling a handler function.

### 2. Unified observability
All steps (compute + LLM) appear in `workflow.trace()`. No more invisible handler work.

### 3. Composition
A workflow can include compute steps that prepare data for LLM steps. An LLM step can be skipped based on compute results. Workflows can call sub-workflows that are pure-compute.

### 4. Steering works everywhere
Even compute-heavy workflows can be interrupted mid-stream.

### 5. Conditional LLM invocation
The natural pattern becomes: compute → gate → LLM (maybe). This is exactly the sensor→judge pattern, but inside the workflow runtime.

## Migration Path

### Phase 1: Add `runStep()` to WorkflowContext (small change)
- ~50 lines in `workflow-tool.ts`
- Update `WorkflowContext` interface  
- Update `workflow-defs.d.ts` for workflow authors
- Backward compatible — existing workflows unchanged

### Phase 2: Add `ctx.db()` and `ctx.projectRoot` to WorkflowContext
- Compute steps need data access
- Could be a `WorkflowComputeContext` subset passed to `runStep`
- Or just add `getDb()` and `projectRoot` to `WorkflowContext`

### Phase 3: Migrate handlers to workflows
- Start with priority-drift as proof-of-concept
- Handler authors write workflows instead of handlers
- Cron entries get `"type": "workflow"` alongside `"type": "handler"`

### Phase 4: (Optional) Deprecate handler system
- Only if all handlers migrate cleanly
- Keep HandlerModule for backward compat, but encourage workflow pattern

## Key Design Decisions

### Q: Should `runStep()` have access to `ctx`?
**Yes, but limited**. The step function should receive a `ComputeContext` with:
- `db()` — database access
- `projectRoot` — filesystem
- `agentName` — who's running
- `log()` — diagnostics
- NOT `runAgent()` — that should go through the workflow level

```typescript
interface ComputeContext {
  db(): SqliteDb;
  projectRoot: string;
  agentName: string;
  log(msg: string): void;
}

// Usage:
await ctx.runStep("collect-data", (c) => {
  const rows = c.db().prepare("SELECT * FROM sessions").all();
  return processRows(rows);
});
```

### Q: Should compute steps be resumable?
**No, not initially**. Compute steps are fast (ms-seconds). LLM steps are slow (minutes). Resume logic should focus on skipping completed LLM steps, not compute steps. If a workflow is resumed, re-run all compute steps (they're cheap) and skip completed LLM steps (existing behavior).

### Q: How does this interact with cron?
Cron entries would gain a new type:

```json
{
  "name": "priority-drift",
  "type": "workflow",
  "workflow": "priority-drift",
  "task": "periodic alignment check",
  "intervalMs": 7200000
}
```

The cron runner calls `workflowTool.execute("run", "priority-drift", "periodic alignment check")` instead of calling a handler function.

### Q: What about handler state (cooldowns, counters)?
Workflows would use the same pattern — read/write state files or DB rows in compute steps. No special state mechanism needed.

## Complexity Assessment

| Change | Effort | Risk |
|--------|--------|------|
| Add `runStep()` to WorkflowContext | Small (50 LOC) | Low |
| Add `ComputeContext` | Small (30 LOC) | Low |
| Update type definitions | Small (10 LOC) | Low |
| Cron "workflow" type | Medium (100 LOC) | Low |
| Migrate priority-drift | Medium (refactor) | Low |
| Migrate all handlers | Large (varies) | Medium |
| Deprecate handlers | Large | High |

**Recommended**: Do Phase 1-2 now (~80 LOC), Phase 3 as proof with priority-drift, defer Phase 4.

## Risks & Mitigations

1. **Compute step errors** — A `runStep()` function could throw. Need try/catch with proper step recording (status: "error"). Same pattern as `runAgent()` error handling.

2. **Blocking compute** — A compute step that takes 30s would block the workflow thread. Mitigation: timeout parameter on `runStep()`.

3. **Handler feature gap** — Handlers have `triggerNow()`, `notify()`, `emit()`. These would need to be available in compute context or at workflow level.

4. **Backward compatibility** — Existing handlers must continue working during migration. Both systems run in parallel.

## Conclusion

This is a clean, incremental unification. The key insight is that `runStep()` is a tiny addition to the workflow runtime that eliminates the need for a separate handler system. It makes the workflow system the **universal execution primitive** for both compute-heavy and LLM-heavy tasks.

The sensor→judge pattern isn't a special pattern requiring special infrastructure — it's just a workflow where the first N steps are compute and the last step is a conditional LLM call. Once `runStep()` exists, this becomes obvious.

**Recommendation**: Implement Phase 1 (`runStep()` + types) as a small PR, port priority-drift as proof, evaluate before broader migration.
