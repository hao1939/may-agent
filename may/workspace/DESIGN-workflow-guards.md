# DESIGN: Workflow Guards — Reactive Demand System

**Author:** May  
**Status:** Phase 1 COMPLETE (2026-04-14), Phase 2 in progress  
**Location:** This is the canonical guard doc. See also: [sensor-judge-migration.md](sensor-judge-migration.md) (separate system)

---

## What This Is

Guards are **reactive event listeners** for workflow execution. When a workflow runs, guards watch events (step started, step done, workflow done) and respond with **demands** — warn, inject a corrective step, or block execution.

Guards only apply to workflows. No workflow → no guards.

## Why It Exists

Before guards, quality enforcement was ad-hoc:
- `beforeToolCall` hooks checked individual tool calls (too granular)
- Workflow steps had to manually add verification steps (boilerplate)
- No way to automatically run tests after code changes across all workflows

Guards provide a uniform reactive layer between workflow steps.

---

## Core Concepts

### Events

The workflow runtime emits events at natural points:

```typescript
type WorkflowGuardEvent =
  | { type: "step_done"; source: "agent" | "function"; step: string; result: TaskResult; completedSteps: CompletedStep[]; task: string }
  | { type: "step_start"; source: "agent" | "function"; step: string; task: string; completedSteps: CompletedStep[] }
  | { type: "workflow_start"; workflow: string; task: string }
  | { type: "workflow_done"; workflow: string; summary: string; completedSteps: CompletedStep[] };
```

### Demands

Guards return zero or more demands per event:

| Type | Behavior | Example |
|------|----------|---------|
| `block` | Hard stop. Workflow halts with `WorkflowBlocked` error. | Secret leak detected |
| `warn` | Appended to next step's task as `## Guard Warnings`. | "Consider error handling" |
| `run_step` | Inject an agent step before the workflow continues. | "Run tests" |

### Guard Interface

```typescript
interface WorkflowGuard {
  name: string;
  events?: WorkflowGuardEvent["type"][];  // Filter; omit = all events
  costTier?: "zero" | "low" | "medium";
  handle(event: WorkflowGuardEvent): Demand[];  // Pure — no I/O
}
```

Guards are **pure functions** — no filesystem reads, no DB queries, no network calls. They inspect the event data only. This keeps them testable and fast.

---

## How It Works

```
[workflow step completes]
    │
    ├─ emit("step_done", { step, result, source, ... })
    │     ├─ auto-test guard → [{ type: "run_step", step: "run tests" }]
    │     ├─ build-check guard → [{ type: "warn", reason: "no build mentioned" }]
    │     └─ pivot-detector guard → []
    │
    ├─ Collect all demands
    ├─ Process: blocks first → halt if any
    │           run_steps → execute (deduplicated by label)
    │           warns → accumulate for next step
    │
    └─ Continue to next planned step (with warnings in context)
```

### Discovery — No Registration

Guards are auto-discovered from directories:
- `agents/shared/guards/` — applies to ALL agents' workflows
- `agents/<name>/guards/` — applies to that agent's workflows only

Just drop a `.ts` file exporting `guard: WorkflowGuard` and it works.

### Safety

- **Injection depth limit**: MAX_INJECTION_DEPTH = 3 (guard-injected steps can trigger guards, bounded)
- **Max injected steps**: Default 5 per workflow run, then `run_step` downgrades to `warn`
- **Label deduplication**: Same-label `run_step` demands run only once
- **`guard:` prefix**: Auto-applied to injected step labels; guards skip steps starting with `guard:` to avoid recursion
- **Disable mechanism**: Rename to `.disabled.ts` or set `DISABLED_GUARDS=name1,name2` env var

### Warning Delivery

Warnings accumulate in a `guardWarnings: string[]` array. Before each planned step executes, if warnings exist:
```
stepTask += "\n\n## Guard Warnings\n- warning 1\n- warning 2"
```
Cleared after delivery.

---

## What's Implemented (Phase 1 — COMPLETE)

**Runtime** (`src/lib/workflow-tool.ts`):
- `loadGuards()` — auto-discovery from shared + agent dirs, respects `.disabled.ts` and `DISABLED_GUARDS`
- `emitAndCollectDemands()` — fires events to all guards, collects demands
- `resolveDemands()` — processes blocks → run_steps → warns, with dedup and depth limits
- Warning delivery to next step's task context
- `runFunction()` — zero-LLM workflow steps (used by sensor-judge pattern, see separate doc)
- `WorkflowBlocked` error type

**Types** (`src/lib/workflow.ts`):
- `WorkflowGuard`, `Demand`, `WorkflowGuardEvent`, `WorkflowBlocked`

**Guards** (`agents/shared/guards/`):
- `build-check.ts` — warns if coding step doesn't mention build/test success
- `auto-test.ts` — injects test step when source files modified without test confirmation
- `pivot-detector.ts` — warns on create-test-fail loops (3+ consecutive failures)

**Tests**: 60+ unit tests in `src/lib/workflow-guards.test.ts`

## What's Next (Phase 2)

- More guards: verify-files, no-secret-leak
- `skipGuards` escape hatch for workflows
- Migrate `verify-wrap` to use auto-test guard (remove hardcoded verification step)
- Monitor guard cost, tune `maxInjectedSteps`

---

## Separate: Sensor-Judge Cron Migration

The cron-to-workflow migration (converting JS handlers into sensor-judge workflows) is a **separate initiative** documented in [sensor-judge-migration.md](sensor-judge-migration.md). It uses the workflow engine (and gets guard protection for free) but is not part of the guard system itself.

---

## Relationship to `beforeToolCall` Guards

These are **two different layers**:

| | Session-level (`beforeToolCall`) | Workflow-level (this system) |
|---|---|---|
| Scope | Individual tool calls within one session | Steps between sessions in a workflow |
| Trigger | Every `tool.execute()` call | Workflow events |
| Response | Block/modify a single tool call | Block workflow, inject step, or warn |
| Examples | finish-guard, commit-guard | auto-test, build-check, pivot-detector |

Both coexist. They don't conflict.

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/workflow.ts` | Types: WorkflowGuard, Demand, WorkflowGuardEvent, WorkflowBlocked |
| `src/lib/workflow-tool.ts` | Runtime: loadGuards, emitAndCollectDemands, resolveDemands |
| `src/lib/workflow-guards.test.ts` | 60+ unit tests |
| `agents/shared/guards/REGISTRY.md` | Guard inventory |
| `agents/shared/guards/*.ts` | Guard implementations |
