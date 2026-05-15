# DESIGN: Guards as Workflow Demands + Cron-to-Workflow Migration

**Author:** May  
**Date:** 2026-04-14  
**Status:** SUPERSEDED — See canonical docs in agent workspaces

> **⚠️ This workspace doc is now historical.** The canonical design docs are:
> - **Guards:** `agents/may/workspace/DESIGN-workflow-guards.md` — reactive demand system
> - **Sensor-Judge Migration:** `agents/may/workspace/DESIGN-sensor-judge-migration.md` — cron handler conversion
> 
> These are two separate systems. Guards enforce workflow quality. Sensor-judge converts cron handlers into workflows.
> 
> Bob's earlier RFC (`agents/shared/may-agent-docs/design/guard-workflow-architecture.md`) is also superseded.

**Reviews incorporated:** Bob, Tech Lead, Coach, Optimizer (2026-04-14)

---

## User Requirements

1. Agents decide whether to use a workflow. No workflow → no guards → agent handles everything itself.
2. Guards interrupt execution and produce **demands** — some block (hard stop), some inject corrective steps.
3. Only care about the workflow case. Outside workflow, no guard system.
4. Cron jobs should eventually migrate to workflows (heartbeat migration deferred until mature).
5. Pure-JS handlers that already trigger LLM should become sensor-judge workflows. Pure-computation handlers stay as JS.

---

## Part 1: The Demand Model

### Core idea: guards are event listeners

Guards don't "run". Guards **listen** to workflow events and **react** with demands. The workflow runtime emits events at natural points (step started, step done, workflow started). Guards subscribe to events they care about and synchronously return demands.

This matches the existing `onEvent` callback in the workflow runtime — guards are just another subscriber on the same event channel, except their return value (demands) feeds back into the runtime.

### Events

```typescript
/** Events the workflow runtime emits. Guards subscribe to these. */
type WorkflowGuardEvent =
  | { type: "step_done"; source: "agent" | "function"; step: string; result: TaskResult; completedSteps: CompletedStep[]; task: string }
  | { type: "step_start"; source: "agent" | "function"; step: string; task: string; completedSteps: CompletedStep[] }
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "workflow_done"; workflow: string; summary: string; completedSteps: CompletedStep[] };
```

**Note:** The `source` field distinguishes `runAgent()` steps (LLM sessions) from `runFunction()` steps (pure JS). Guards can use this to decide what demand types make sense — e.g., `run_step` demands after a `source: "function"` event are unusual (see Part 2).

### Demands

A guard returns zero or more demands in response to an event:

```typescript
interface Demand {
  type: "run_step" | "block" | "warn";
  /** Human-readable reason. Included in logs, warnings, and block messages. */
  reason: string;
  /** Name of the guard that produced this demand. Auto-filled by runtime. */
  guardName?: string;
  /** For run_step: the step to inject. */
  step?: {
    agent: string;
    task: string;
    label?: string;  // Auto-prefixed with "guard:" if not already
  };
}
```

| Type | Behavior | Example |
|------|----------|---------|
| `block` | Hard stop. Workflow halts, returns escalation to caller. | Cross-edit violation, secret leak detected |
| `warn` | Informational. Appended to next step's task as a `## Guard Warnings` section. | "Consider adding error handling" |
| `run_step` | Inject a step NOW, before the workflow continues. | "Run tests", "Verify files exist", "Commit changes" |

### Guard interface

```typescript
/** A guard is a function: event in → demands out. */
interface WorkflowGuard {
  name: string;
  /** Which events this guard listens to. If omitted, listens to all. */
  events?: WorkflowGuardEvent["type"][];
  /** Expected cost tier of injected steps. For monitoring/alerting. */
  costTier?: "zero" | "low" | "medium";
  /** Receive an event, return demands (or empty array). Must be a pure function. */
  handle(event: WorkflowGuardEvent): Demand[];
}
```

**"Pure" means no side effects, not no computation.** Guards MAY do compute-heavy inspection of `TaskResult` (regex scanning, file list extraction, JSON parsing of `messages[]`). Guards MUST NOT do I/O: no filesystem reads, no database queries, no network calls, no state mutation. The constraint is about **side effects**, not computational cost. This keeps guards testable, fast, and deterministic.

### How it flows

```
[workflow runtime]
    │
    ├─ emit("step_done", { step, result, source: "agent", ... })
    │     │
    │     ├─ guard A: handle(event) → [{ type: "run_step", ... }]
    │     ├─ guard B: handle(event) → []
    │     └─ guard C: handle(event) → [{ type: "warn", ... }]
    │
    ├─ collect all demands
    ├─ process: blocks first → halt if any
    │           then run_steps → execute injected steps (deduplicated by label)
    │           then warns → collect for next step context
    ├─ execute injected steps (which emit their own events → guards react again, bounded by depth)
    │
    └─ continue to next planned step (with warnings in context)
```

### Relationship to existing `beforeToolCall` guards

The system has **two guard layers** that serve different purposes:

| | Session-level (`beforeToolCall`) | Workflow-level (this proposal) |
|---|---|---|
| **Scope** | Individual tool calls within a session | Steps between sessions in a workflow |
| **Trigger** | Every `tool.execute()` call | Workflow events (step_done, step_start, etc.) |
| **Response** | Block/modify a single tool call | Demand: block workflow, inject step, or warn |
| **Interface** | `(toolName, params) → result \| undefined` | `(event) → Demand[]` |
| **Visibility** | Agent sees a tool-call result with the guard's message | Agent sees injected steps or warnings in task context |
| **State** | May be stateful (closures over agent config) | Pure functions — no state |
| **Examples** | finish-guard, commit-guard, path-hallucination-guard | auto-test, verify-files, no-secret-leak |

Both layers coexist. `beforeToolCall` guards handle tool-level enforcement (prevent bad tool arguments, verify finish calls). Workflow guards handle step-level process enforcement (run tests after code changes, block on secret leaks). They operate at different granularities and don't conflict.

**Future convergence:** Some `beforeToolCall` guards (like the verification-depth guard and completeness guard) are doing workflow-level work at the wrong layer. These can be migrated to workflow guards in a later phase, once the demand system is proven. This is explicitly Phase 3+ work — no rush.

---

## Part 2: Workflow Runtime Changes

### Current flow (workflow-tool.ts)

```
workflow.execute(ctx)
  → ctx.runAgent("coder", task)     // step 1
  → [check steering queue]
  → ctx.runAgent("reviewer", task)  // step 2
  → ctx.done(summary)
```

### New flow

```
workflow.execute(ctx)
  → emit("step_start") → guards react → process demands
  → ctx.runAgent("coder", task)
  → emit("step_done") → guards react → process demands → run injected steps
  → emit("step_start") → guards react → process demands
  → ctx.runAgent("reviewer", task + guard warnings)  // warnings appended
  → emit("step_done") → guards react → process demands → run injected steps
  → ctx.done(summary)
```

### Implementation: event emission + demand resolution in `executeWorkflow()`

The workflow runtime already emits `WorkflowEvent` via `onEvent()`. The change is:

1. After emitting, also pass the event to all discovered guards (with a **snapshot** of `completedSteps`)
2. Collect returned demands
3. Resolve demands before continuing

```typescript
// New function inside executeWorkflow():

function emitAndCollectDemands(event: WorkflowGuardEvent): Demand[] {
  // Also fire the existing onEvent callback (for UI, logging, etc.)
  onEvent?.(event);
  
  // Collect demands from guards
  const demands: Demand[] = [];
  for (const guard of guards) {
    // Skip if guard only listens to specific events
    if (guard.events && !guard.events.includes(event.type)) continue;
    
    // Pass snapshot of completedSteps — guards see a frozen view, not a live reference
    const snapshot = { ...event, completedSteps: [...event.completedSteps] };
    const guardDemands = guard.handle(snapshot);
    
    // Tag demands with guard name for observability
    for (const d of guardDemands) {
      d.guardName = guard.name;
    }
    demands.push(...guardDemands);
  }
  
  // Log all demands for observability
  for (const d of demands) {
    log("info", `[workflow:${runId}] guard "${d.guardName}" produced ${d.type}: ${d.reason}`);
  }
  
  return demands;
}

async function resolveDemands(demands: Demand[]): Promise<void> {
  // Blocks first — if any guard blocks, halt immediately
  const blocks = demands.filter(d => d.type === "block");
  if (blocks.length > 0) {
    // Collect ALL block reasons (don't short-circuit) for better diagnostics
    const reason = blocks.map(b => `[${b.guardName}] ${b.reason}`).join("; ");
    run.status = "blocked";
    run.result = { reason };
    if (persistDir) saveWorkflowRun(persistDir, run);
    throw new WorkflowBlocked(reason, completedSteps, runId);
  }
  
  // Warnings — collect for next step's context
  for (const d of demands.filter(d => d.type === "warn")) {
    warnings.push(`${d.reason} (from: ${d.guardName})`);
  }
  
  // Run-steps — deduplicate by label, then execute
  const runSteps = demands.filter(d => d.type === "run_step");
  const seenLabels = new Set<string>();
  const dedupedSteps = runSteps.filter(d => {
    const label = d.step?.label ?? d.reason;
    if (seenLabels.has(label)) return false;
    seenLabels.add(label);
    return true;
  });
  
  // For function-source events: skip run_step demands (log + downgrade to warn)
  // Function steps produce data, not artifacts — there's nothing for a guard to "fix" yet
  // (This is a type-level convention, not a hard restriction — revisit if needed)
  
  for (const d of dedupedSteps) {
    if (injectionDepth >= MAX_INJECTION_DEPTH) {
      // Include full demand details in the warning for debuggability
      warnings.push(`Demand skipped (depth limit ${MAX_INJECTION_DEPTH}): ${d.reason} [${d.guardName}] — would inject "${d.step?.label}"`);
      continue;
    }
    injectionDepth++;
    
    // Auto-prefix "guard:" on injected step labels
    const label = d.step!.label ?? `guard:${d.guardName}`;
    const prefixedLabel = label.startsWith("guard:") ? label : `guard:${label}`;
    
    const injResult = await manager.callAgent(d.step!.agent, d.step!.task, {
      parentSessionId,
      workflowRunId: runId,
      stepLabel: prefixedLabel,
      source: "workflow",
    });
    
    // Tag in DB for guard cost tracking
    tagSessionAsGuardInjected(injResult.sessionId, d.guardName!);
    
    const injStep: CompletedStep = {
      step: prefixedLabel,
      sessionId: injResult.sessionId,
      result: injResult,
    };
    localSteps.push(injStep);
    completedSteps.push(injStep);
    
    // Injected steps emit step_done → guards react again (bounded by depth)
    const subDemands = emitAndCollectDemands({
      type: "step_done",
      source: "agent",
      step: injStep.step,
      result: injResult,
      completedSteps: [...completedSteps],  // snapshot
      task,
    });
    await resolveDemands(subDemands);
  }
  
  injectionDepth = 0;  // Reset before next planned step
}
```

### Warning delivery to agents

When a step has accumulated warnings from guard demands, they're appended to the next step's task:

```typescript
// Inside the runAgent wrapper, before calling manager.callAgent():
let stepTask = originalTask;
if (warnings.length > 0) {
  stepTask += `\n\n## Guard Warnings\n${warnings.map(w => `- ${w}`).join("\n")}`;
  warnings.length = 0;  // Clear after delivery
}
```

This is simple string concatenation — no runtime changes, visible in the agent's task context, and doesn't affect the workflow structure.

### Agent visibility: what does the agent see?

When a guard fires, the agent experience is:

1. **Injected steps (`run_step`):** The workflow calls `manager.callAgent()` with the guard's task. The agent inside the injected step sees a task like: `[guard:auto-test] Run tests for: src/lib/manager.ts`. The `[guard:...]` prefix tells the agent why it's running this step. The agent in the *next planned step* sees the injected step's results in `completedSteps`.

2. **Warnings (`warn`):** The next planned step receives warnings appended to its task as a `## Guard Warnings` section. The agent sees them as context and can act on them (or not).

3. **Blocks (`block`):** The workflow halts. The agent that invoked the workflow (via the `workflow` tool) sees a `WorkflowBlocked` result with the block reason. The agent can escalate or report the issue.

4. **No guard fires:** The agent experiences nothing different — guards are invisible when they don't trigger. This is the common case.

**Why this matters for learning:** Visible guard interventions (the `[guard:...]` prefix, the `## Guard Warnings` section) serve as scaffolding. Over time, agents can learn to run tests proactively (because they see the guard always injects tests after code changes). The guard becomes internalized behavior. This is preferable to invisible guards that fix problems silently.

### Where this slots into existing code (workflow-tool.ts)

The existing `runAgent` closure inside `executeWorkflow()` already calls `onEvent?.({ type: "step_done", ... })`. We replace that with `emitAndCollectDemands()` + `resolveDemands()`:

```typescript
// Current (line ~319):
onEvent?.({ type: "step_done", step: agentName, sessionId: sid, result: taskResult });

// Becomes:
const demands = emitAndCollectDemands({
  type: "step_done",
  source: "agent",
  step: agentName,
  result: taskResult,
  completedSteps: [...completedSteps],
  task,
});
await resolveDemands(demands);
```

---

## Part 3: Guard Discovery — No Registration Needed

### The key insight: guards are event listeners, not registrations

Workflows are auto-discovered by scanning directories — guards work the same way.
No `agent.json` field. No `ctx.addGuard()`. No registration API.
Just put a guard file in the right directory and it listens automatically.

### Directory convention

```
agents/shared/guards/         → applies to ALL agents' workflows
agents/<name>/guards/         → applies to this agent's workflows only
```

### Guard file format

Each guard file exports a `WorkflowGuard` object:

```typescript
// agents/shared/guards/auto-test.ts
import type { WorkflowGuard } from "../../../src/lib/workflow.js";

export const guard: WorkflowGuard = {
  name: "auto-test",
  events: ["step_done"],
  costTier: "low",
  handle(event) {
    // Self-filtering: skip function-source events (no artifacts to test)
    if (event.source === "function") return [];
    // Self-filtering: skip guard-injected steps (avoid recursion)
    if (event.step.startsWith("guard:")) return [];
    
    const srcFiles = extractChangedFiles(event.result)
      .filter(f => f.endsWith(".ts") || f.endsWith(".js"));
    if (srcFiles.length === 0) return [];
    
    return [{
      type: "run_step",
      reason: `${srcFiles.length} source file(s) modified — running tests`,
      step: { agent: "bob", task: `Run tests for: ${srcFiles.join(", ")}`, label: "guard:auto-test" },
    }];
  },
};
```

### How the runtime loads guards

When a workflow starts, the runtime:

1. Scans `agents/shared/guards/*.ts` — loads all shared guards
2. Scans `agents/<agentName>/guards/*.ts` — loads agent-specific guards
3. All loaded guards listen to ALL workflow events for this execution

```typescript
// Inside executeWorkflow() — at startup:
const guards = await loadGuards(sharedGuardsDir, agentGuardsDir);
// That's it. No registration API needed.
```

### Guards self-filter — no external configuration

A guard decides for itself whether to fire. The event carries all the context:

```typescript
handle(event) {
  // Skip function-source events:
  if (event.source === "function") return [];
  
  // Skip certain workflows:
  if (event.task.includes("[no-guard]")) return [];
  
  // Skip guard-injected steps (avoid recursion):
  if (event.step.startsWith("guard:")) return [];
  
  // Only fire if source files changed:
  const srcFiles = extractChangedFiles(event.result);
  if (srcFiles.length === 0) return [];
  
  return [{ type: "run_step", ... }];
}
```

This is the same pattern as the existing `beforeToolCall` guards — `createVerificationDepthGuard` 
checks `exemptAgents`, `createCompletenessGuard` checks `targetAgents`. The guard owns its own 
applicability logic.

### Escape hatch: workflow-level opt-out

```typescript
workflow({ action: "run", name: "quick-research", task: "...", skipGuards: true })
```

### Why NOT registration?

| Registration model | Problem |
|-------------------|---------|
| `agent.json: { guards: [...] }` | Agents must know guard names. Adding a new guard requires editing every agent.json. |
| `ctx.addGuard(...)` in workflow | Workflow authors must import and wire guards. Adding a new guard requires editing every workflow. |
| Dynamic (guard returns a demand to register another guard) | Unnecessary indirection. |
| **Auto-discovery (this proposal)** | Add a file → it works. Remove a file → it stops. No wiring needed. |

### Guard discoverability

Create `agents/shared/guards/REGISTRY.md` documenting all shared guards:

```markdown
# Shared Guards

| Guard | Events | Demand type | Description |
|-------|--------|-------------|-------------|
| auto-test | step_done | run_step | Run tests when source files are modified |
| verify-files | step_done | run_step | Verify written files exist and are non-empty |
| no-secret-leak | step_done | block | Block workflow if sensitive files are written |
```

This file is auto-generated from guard metadata (name, events, costTier) by a maintenance handler, similar to how `workflows/REGISTRY.md` works.

### `WorkflowContext` additions

```typescript
interface WorkflowContext {
  // ... existing fields ...
  
  /** Warnings collected from guard demands (available to workflow code). */
  readonly warnings: readonly string[];
}
```

Note: no `addGuard()` method. Guards are discovered, not registered.

### New error type

```typescript
/** Thrown when a guard blocks a workflow with a hard-stop demand. */
class WorkflowBlocked extends Error {
  constructor(
    public readonly reason: string,
    public readonly completedSteps: CompletedStep[],
    public readonly workflowRunId: string,
  ) {
    super(`Workflow blocked by guard: ${reason}`);
    this.name = "WorkflowBlocked";
  }
}
```

This gets caught in `runOrResume()` the same way `WorkflowInterrupted` is, producing a `{ type: "blocked", ... }` tool result.

---

## Part 4: Loop Protection

Guards that produce `run_step` demands create injected steps. Those injected steps also trigger guards. Without protection this loops infinitely.

**Solution: injection depth limit + auto-prefixed labels + step-label awareness.**

```typescript
const MAX_INJECTION_DEPTH = 3;
let injectionDepth = 0;
```

### Structural enforcement: auto-prefix `guard:` on labels

The runtime **automatically prefixes** `guard:` on all injected step labels if not already present. This makes the convention structural — guard authors don't need to remember it, and self-filtering via `event.step.startsWith("guard:")` always works.

```typescript
// In resolveDemands():
const label = d.step!.label ?? `guard:${d.guardName}`;
const prefixedLabel = label.startsWith("guard:") ? label : `guard:${label}`;
```

### Guards SHOULD check `completedSteps` to avoid re-demanding

```typescript
// In auto-test guard:
handle(event) {
  if (event.type !== "step_done") return [];
  if (event.step.startsWith("guard:")) return [];
  
  const hasTests = event.completedSteps.some(s => s.step.includes("auto-test"));
  if (hasTests) return [];  // Already ran tests this cycle
  
  // ... check for source file changes, return run_step demand ...
}
```

### Depth limit warnings include full context

When a demand is skipped due to depth limit, the warning includes the full demand details:

```
"Demand skipped (depth limit 3): 2 source file(s) modified — running tests [auto-test] — would inject "guard:auto-test""
```

### `run_step` demand deduplication

If two guards both demand `run_step` with the same label (e.g., both want "guard:auto-test"), the runtime deduplicates by label and runs the step only once.

### `injectionDepth` reset timing

`injectionDepth` resets to 0 at the start of each **planned** step iteration — not after `resolveDemands()`. This gives each planned step a fresh budget for guard-injected work.

### Cost guardrail: `maxInjectedSteps`

The workflow context accepts an optional `maxInjectedSteps` (default: 5). After this many guard-injected steps in a single workflow run, further `run_step` demands downgrade to `warn`:

```typescript
if (totalInjectedSteps >= maxInjectedSteps) {
  warnings.push(`Guard "${d.guardName}" demand downgraded to warn (${totalInjectedSteps} injected steps reached limit): ${d.reason}`);
  continue;
}
```

---

## Part 5: Example Guards

### auto-test

```typescript
export const guard: WorkflowGuard = {
  name: "auto-test",
  events: ["step_done"],
  costTier: "low",
  
  handle(event) {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];
    if (event.step.startsWith("guard:")) return [];
    
    const changedFiles = extractChangedFiles(event.result);
    const srcFiles = changedFiles.filter(f => f.endsWith(".ts") || f.endsWith(".js"));
    if (srcFiles.length === 0) return [];
    
    return [{
      type: "run_step",
      reason: `${srcFiles.length} source file(s) modified — running tests`,
      step: {
        agent: "bob",
        task: `[guard:auto-test] Run tests. Focus on: ${srcFiles.join(", ")}. Report pass/fail only.`,
        label: "guard:auto-test",
      },
    }];
  },
};
```

### verify-files

```typescript
export const guard: WorkflowGuard = {
  name: "verify-files",
  events: ["step_done"],
  costTier: "low",
  
  handle(event) {
    if (event.type !== "step_done") return [];
    if (event.source === "function") return [];
    if (event.step.startsWith("guard:")) return [];
    
    const written = extractWrittenFiles(event.result);
    if (written.length === 0) return [];
    
    return [{
      type: "run_step",
      reason: `${written.length} file(s) written — verifying`,
      step: {
        agent: "bob",
        task: `[guard:verify-files] Verify files exist and are non-empty:\n${written.map(f => `- ${f}`).join("\n")}`,
        label: "guard:verify-files",
      },
    }];
  },
};
```

### no-secret-leak (block type)

```typescript
export const guard: WorkflowGuard = {
  name: "no-secret-leak",
  events: ["step_done"],
  costTier: "zero",
  
  handle(event) {
    if (event.type !== "step_done") return [];
    const written = extractWrittenFiles(event.result);
    for (const f of written) {
      if (f.includes(".env") || f.includes("secret")) {
        return [{ type: "block", reason: `Wrote to sensitive file: ${f}` }];
      }
    }
    return [];
  },
};
```

### Shared utility: `extractChangedFiles` / `extractWrittenFiles`

The existing `verify-wrap.ts` workflow already has `extractWrittenFiles()` (lines 35-88). This logic is needed by multiple guards and workflows. Extract it into a shared utility:

```typescript
// src/lib/workflow-utils.ts
export function extractChangedFiles(result: TaskResult): string[] { ... }
export function extractWrittenFiles(result: TaskResult): string[] { ... }
```

**Note on `TaskResult` inspection:** Guards extract file information from `TaskResult.messages[]` (tool call results) or from the `finish()` tool's `deliverables` array. A future improvement is to add a structured `deliverables?: { path: string; action: string }[]` field directly on `TaskResult` (populated from the agent's `finish()` call). This would make `extractChangedFiles()` a simple property access instead of message parsing. For v1, parsing `messages[]` is acceptable — it's the same approach `verify-wrap` uses today.

---

## Part 6: Cron-to-Workflow Migration

### The Problem: Disconnect Between Collection and Decision

Today many JS handler files follow this pattern:

```
[cron fires] → JS collects data → writes report.md → [nobody reads it, or reads it stale]
[later heartbeat fires] → agent reads report.md → makes decision with stale context
```

### The Right Pattern: Sensor → Judge Workflow (Where LLM Adds Value)

JS code collects and prepares data. LLM makes decisions based on that data. These should be **one atomic unit** — a workflow:

```
[cron fires] → workflow:
  step 1: JS function collects data, returns structured context (zero LLM cost)
  step 2: agent reads context, decides what to do, acts (LLM cost only when needed)
  guards ensure quality of any code changes
```

### Three-Tier Migration (per Optimizer review)

Not all handlers benefit from LLM judgment. The migration uses three tiers:

#### Tier 1 — Stay as JS handlers (zero LLM cost)

These are pure computation: deterministic, numeric, no judgment required.

| Handler | Why it stays JS |
|---------|----------------|
| `analyze-failures` | Intentionally de-LLM'd (saved 78 ops/week). Output consumed by downstream handlers. Math, not judgment. |
| `daily-brief` | Metrics aggregation. No decisions to make. |
| `coaching-report` | Score computation. Threshold-based, not judgment-based. |
| `system-status` | Health check math. Alert thresholds are numeric. |
| `tool-quality-scan` | Pattern matching + aggregation. Regression detection is numeric. |
| `health-trend` | Week-over-week comparison. Threshold alerts. |
| `daily-digest` | Aggregation for human review. LLM paraphrasing adds cost with no value. |
| `lessons-graduation` | Rule-based promotion logic. |
| All infrastructure handlers | watchdog, zombie-cleanup, audit-requests, memory-trimmer, workspace-compaction, agents-auto-commit, session-sync, evaluation-sync, research-sync |

**Criteria:** Output is deterministic/numeric, no judgment required, no existing LLM cost.

#### Tier 2 — Convert to sensor-judge workflows

These handlers **already incur LLM cost** (via spawned sessions or agent requests). Converting to workflows makes the existing cost more efficient by keeping context together.

| Handler | Current behavior | Why workflow helps |
|---------|-----------------|-------------------|
| `error-log-scanner` | JS scans → spawns coach via request | Atomic: scan + coach response in one workflow. Context stays together. |
| `coaching-feedback` | JS groups violations → sends to coach | Coach sees raw data in-context instead of reading a stale file. |
| `priority-drift` | Already spawns LLM session | Formalizing as workflow adds guard protection for any code changes. |
| `active-nudge` | JS checks staleness → may trigger action | Judge step can make smarter decisions than threshold-based nudging. |

**Criteria:** Already incurs LLM cost; workflow makes it atomic and guarded. Net cost change: ~zero (replacing existing LLM cost, not adding new).

#### Tier 3 — Future: Heartbeat workflow

See Phase 4+ in the implementation plan. Deferred until the demand system is proven stable.

**Estimated cost impact of this migration plan: +0 ops/day** (Tier 1 stays zero-LLM; Tier 2 replaces existing LLM cost, doesn't add new).

### How This Works: `runFunction()` — Workflow Steps Can Be Functions

Today `ctx.runAgent()` always spawns an LLM session. We add `ctx.runFunction()` for pure-JS data collection:

```typescript
interface WorkflowContext {
  // ... existing ...
  
  /** Run a JS function as a workflow step. No LLM cost.
   *  Returns a TaskResult-like object with the function's output. */
  runFunction(label: string, fn: () => Promise<string>): Promise<TaskResult>;
}
```

Implementation includes error handling, timeout, and output truncation:

```typescript
runFunction: async (label: string, fn: () => Promise<string>): Promise<TaskResult> => {
  stepCounter++;
  onEvent?.({ type: "step_start", step: label });
  const start = Date.now();
  
  let output: string;
  try {
    // Timeout: 30 seconds for function steps
    output = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`runFunction "${label}" timed out (30s)`)), 30_000)
      ),
    ]);
    // Truncate output to 50KB to prevent context explosion
    if (output.length > 50_000) {
      output = output.slice(0, 50_000) + `\n...[truncated at 50KB]`;
    }
  } catch (err) {
    // Return error result instead of crashing the workflow
    output = `Error in function "${label}": ${err instanceof Error ? err.message : String(err)}`;
    const errorResult: TaskResult = {
      status: "error",
      sessionId: `fn_${runId}_${stepCounter}`,
      lastAssistantText: output,
      messages: [],
      duration: `${((Date.now() - start) / 1000).toFixed(1)}s`,
    };
    const step: CompletedStep = { step: label, result: errorResult };
    localSteps.push(step);
    completedSteps.push(step);
    onEvent?.({ type: "step_done", step: label, result: errorResult });
    return errorResult;
  }
  
  const result: TaskResult = {
    status: "done",
    sessionId: `fn_${runId}_${stepCounter}`,
    lastAssistantText: output,
    messages: [],
    duration: `${((Date.now() - start) / 1000).toFixed(1)}s`,
  };
  
  const step: CompletedStep = { step: label, result };
  localSteps.push(step);
  completedSteps.push(step);
  
  // Emit step_done — guards CAN react, but run_step demands are skipped for function sources
  const demands = emitAndCollectDemands({
    type: "step_done",
    source: "function",
    step: label,
    result,
    completedSteps: [...completedSteps],
    task,
  });
  // Only process block and warn demands from function step events
  const filtered = demands.filter(d => d.type !== "run_step");
  if (filtered.length < demands.length) {
    log("info", `[workflow:${runId}] Skipped ${demands.length - filtered.length} run_step demands from function step "${label}"`);
  }
  await resolveDemands(filtered);
  
  return result;
},
```

### Example: error-log-scanner as a workflow

**Before (JS handler — disconnected):**
```typescript
export const create = (ctx, entry) => async () => {
  const patterns = scanErrorLogs(ctx);
  if (patterns.length >= THRESHOLD) {
    ctx.manager.run("coach", growthTask);  // spawn disconnected LLM session
  }
};
```

**After (workflow — atomic sensor-judge):**
```typescript
export const name = "error-scan";
export const description = "Scan error logs and address recurring patterns";

export async function execute(ctx: WorkflowContext) {
  // Step 1: JS collects data (zero LLM cost)
  const scan = await ctx.runFunction("scan-errors", async () => {
    return scanErrorLogs(ctx.persistDir, ctx.agentsRoot);
  });
  
  // If no patterns found, done — no LLM cost at all
  const patterns = JSON.parse(scan.lastAssistantText ?? "[]");
  if (patterns.length === 0) {
    return ctx.done("No recurring error patterns found.");
  }
  
  // Step 2: Agent analyzes patterns and takes action (LLM cost only when needed)
  // Guards auto-discovered — no registration needed
  const analysis = await ctx.runAgent("coach", 
    `Analyze these recurring error patterns and suggest fixes:\n${scan.lastAssistantText}`
  );
  
  return ctx.done(analysis.lastAssistantText ?? "done");
}
```

### Cron's New Role

After migration, cron becomes a **simple scheduler**:

```
[cron.ts]
  Every 30min → heartbeat (keep as-is for now)
  Every 60min → workflow("error-scan")
  Every 24h  → workflow("daily-brief")   // only if Tier 2 migration proves value
  
  // Stay as JS handlers (Tier 1):
  Every 10min → watchdog()
  Every 30min → zombie-cleanup()
  Every 60min → session-sync()
  Every 24h  → analyze-failures()         // stays JS — intentionally de-LLM'd
```

New `"workflow"` cron entry type:

```jsonc
// cron.json
{
  "name": "error-scan",
  "type": "workflow",
  "workflow": "error-scan",
  "agent": "coach",
  "intervalMs": 3600000,
  "message": "Scan for recurring error patterns"
}
```

---

## Part 7: Observability & Testing

### Logging

Every guard interaction is logged:

```
[workflow:run_abc] Loaded 3 guards: auto-test, verify-files, no-secret-leak
[workflow:run_abc] guard "auto-test" produced run_step: 2 source file(s) modified — running tests
[workflow:run_abc] guard "no-secret-leak" produced block: Wrote to sensitive file: .env
[workflow:run_abc] Demand skipped (depth limit 3): ... [auto-test] — would inject "guard:auto-test"
```

### Guard cost tracking

Guard-injected sessions are tagged in the DB with `source: "guard"` and the guard name. This enables:

- Per-guard cost reporting (how many ops does auto-test add?)
- Guard overhead ratio (guard-injected ops / planned step ops)
- Detection of guards that trigger too often

```sql
SELECT guard_name, COUNT(*), SUM(op_count)
FROM sessions WHERE source = 'guard'
GROUP BY guard_name;
```

### Guard disable mechanism

If a guard misbehaves in production, it can be disabled without code changes:

```bash
# Move it out of the guards directory
mv agents/shared/guards/auto-test.ts agents/shared/guards/auto-test.ts.disabled
```

Or add a runtime check via environment variable:

```typescript
const disabledGuards = (process.env.DISABLED_GUARDS ?? "").split(",").filter(Boolean);
const guards = allGuards.filter(g => !disabledGuards.includes(g.name));
```

### Testing strategy

Phase 1 must include unit tests for:

1. **Guard evaluation:** Given an event, guard returns expected demands
2. **Demand resolution order:** Blocks halt before run_steps execute
3. **Injection depth limit:** Depth > MAX produces warnings, not infinite loops
4. **`run_step` deduplication:** Same-label demands run once
5. **`WorkflowBlocked` propagation:** Caught by `runOrResume()`, produces correct tool result
6. **`runFunction()` step counting:** Increments `stepCounter`, persists to `run.steps[]`
7. **`runFunction()` error handling:** Timeout, throw, and truncation all produce error TaskResult
8. **`completedSteps` snapshot:** Guards receive frozen array, not live reference

---

## Part 8: What Changes (Summary)

| Component | Change |
|-----------|--------|
| `src/lib/workflow.ts` | Add `WorkflowGuard`, `Demand`, `WorkflowGuardEvent`, `WorkflowBlocked` types |
| `src/lib/workflow-tool.ts` | Auto-discover guards, demand resolution in `runAgent()`, `runFunction()` method, `WorkflowBlocked` handling |
| `src/lib/workflow-utils.ts` (new) | Shared `extractChangedFiles()`, `extractWrittenFiles()` utilities (extracted from verify-wrap) |
| `agents/shared/guards/` (new) | Guard implementations: auto-test, verify-files, no-secret-leak |
| `agents/shared/guards/REGISTRY.md` (new) | Auto-generated guard documentation |
| `src/app/cron.ts` | New `"workflow"` entry type (Phase 3) |
| Existing `beforeToolCall` guards | **No change** — different layer, different purpose (see Part 1 table) |

### What does NOT change

- Agent sessions without workflow — no guards, agent handles everything
- `beforeToolCall` hooks — continue working as-is inside individual sessions
- Infrastructure JS handlers (watchdog, sync, cleanup) — stay as cron handlers (Tier 1)
- Pure-computation JS handlers (analyze-failures, daily-brief, etc.) — stay as JS (Tier 1)
- Workflow `resume` — works unchanged, injected steps are just more completed steps
- Heartbeat — stays as-is until Phase 4+ (when system is proven mature)

---

## Part 9: Implementation Plan

### Phase 0: Audit & prep (1 day)
- Complete inventory of all 28 JS handlers with fire frequency, LLM cost, and consumer chain
- Identify the 3-5 highest-impact Tier 2 migration targets
- Extract `extractChangedFiles()` / `extractWrittenFiles()` from verify-wrap into `src/lib/workflow-utils.ts`

### Phase 1: Core demand system + guard discovery (2-3 days)
- Add types to `workflow.ts`: `WorkflowGuard`, `Demand`, `WorkflowGuardEvent`, `WorkflowBlocked`
- Add guard auto-discovery (`loadGuards()` scanning shared/ and agent/ dirs) to `workflow-tool.ts`
- Add demand resolution loop (emit events → collect demands → resolve) to `workflow-tool.ts`
- Add `runFunction()` to `WorkflowContext` (with timeout, error handling, truncation)
- Add observability: demand logging, guard cost tagging
- Ship with one guard (auto-test) in `agents/shared/guards/`
- **Unit tests** for all 8 test cases listed in Part 7
- Test: run a workflow that modifies source files, verify the guard auto-fires

### Phase 2: Guard library + hardening (2-3 days)
- Build more guards: verify-files, no-secret-leak
- Add `skipGuards` escape hatch to workflow tool
- Migrate `verify-wrap` workflow to use auto-test guard (remove its hardcoded verification step)
- Create `agents/shared/guards/REGISTRY.md`
- Monitor guard cost and tune `maxInjectedSteps` if needed

### Phase 3: Sensor-judge migrations (3-5 days)
- Migrate Tier 2 handlers (error-log-scanner, coaching-feedback, priority-drift) to workflows
- Add `"workflow"` cron entry type
- Validate: same functionality, same or lower LLM cost, better context cohesion

### Phase 4+ (future, when system is mature): Heartbeat workflow
- Only after Phases 1-3 are stable and proven for ≥2 weeks
- Write detailed migration checklist mapping every feature of `fireHeartbeat()` to workflow equivalent
- Migrate ONE agent's heartbeat first (non-critical agent like scout or evaluator)
- Run for 1 week in parallel, compare session quality, op counts, and evaluation scores
- Only then consider broader rollout

---

## Resolved Questions (from team review)

### Q1: Guard ordering
**Answer: Blocks always win, regardless of load order.** Scan all guards, collect all demands, then process. If any demand is a `block`, halt immediately — don't execute any `run_step` demands first. Guard evaluation order doesn't matter for correctness. When multiple guards produce `block` demands, all block reasons are concatenated in the `WorkflowBlocked` error.

### Q2: Injected step failures
**Answer: Let the guard decide (option C).** The injected step's completion emits `step_done` → guards react. The auto-test guard can check the test step's `result.status` and return a `block` if tests failed. This keeps decision-making in the guard, not in the runtime. The injected step's task instructs the agent to include failure details in `finish()` so the guard can inspect `result.status` / `lastAssistantText`.

### Q3: `runFunction()` and guards
**Answer: Events fire, but `run_step` demands are skipped for function-source events.** Function steps produce data, not artifacts — there's nothing for a guard to "fix" yet. `warn` and `block` demands are still processed (a function that detects a dangerous condition should be blockable). The `source: "agent" | "function"` field on events makes this explicit. If we find legitimate cases where `run_step` after a function is needed, we can relax this restriction with evidence.

### Q4: Guard visibility
**Answer: Guards are visible scaffolding.** Injected step tasks include `[guard:name]` prefix. Warnings are appended as a `## Guard Warnings` section to the next step's task. Block reasons are surfaced in the `WorkflowBlocked` result. This visibility serves as scaffolding — agents can learn to internalize guard behavior over time.

---

## Appendix: Review Change Log

Changes incorporated from team review (2026-04-14):

| # | Source | Change |
|---|--------|--------|
| 1 | Bob C1, TL C1 | Added shared `extractChangedFiles`/`extractWrittenFiles` utility + note on future `deliverables` field on TaskResult |
| 2 | Bob C3 | Documented "pure" means no I/O, not no computation |
| 3 | Bob C4, Coach | Specified warning delivery: appended to next step's task as `## Guard Warnings` section |
| 4 | Bob C4 | Added `run_step` demand deduplication by label |
| 5 | Bob C6 | Auto-prefix `guard:` on injected step labels (structural enforcement) |
| 6 | Bob C7 | Extract file-extraction utilities from verify-wrap to shared module |
| 7 | Bob C10, TL | Added "Relationship to existing `beforeToolCall` guards" section |
| 8 | Bob C8 | Cron migration is Part 6 (kept in same doc) but heartbeat migration deferred to Phase 4+ |
| 9 | TL C4 | Pass `[...completedSteps]` snapshot to guards, not live reference |
| 10 | TL | Added `source: "agent" \| "function"` to events |
| 11 | TL, Coach | Added testing strategy with 8 specific test cases |
| 12 | TL | Added observability section with demand logging format |
| 13 | TL | Added guard disable mechanism (file rename + env var) |
| 14 | Coach #1 | Added "Agent Visibility" section explaining what agents see |
| 15 | Coach #3 | Added error handling, timeout (30s), and output truncation (50KB) to `runFunction()` |
| 16 | Coach #5 | Added `agents/shared/guards/REGISTRY.md` for guard discoverability |
| 17 | Optimizer | Rewrote migration to three-tier system (Tier 1: stay JS, Tier 2: workflow, Tier 3: future) |
| 18 | Optimizer | Added guard cost tracking (`source: "guard"` tags in DB) |
| 19 | Optimizer | Added `costTier` field to `WorkflowGuard` interface |
| 20 | Optimizer | Added `maxInjectedSteps` cost guardrail |
| 21 | Optimizer | Protected `analyze-failures` from migration (intentionally de-LLM'd) |
| 22 | User | No manual registration — guards auto-discovered from directories |
| 23 | User | Event-driven `handle(event)` interface (guards self-filter) |
| 24 | User | Heartbeat migration deferred to Phase 4+ (when mature) |
| 25 | User | Three-tier migration: don't add LLM to pure-computation handlers |
