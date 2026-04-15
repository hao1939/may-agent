# DESIGN: Workflow-Level Guard Integration

**Status:** Design Complete — Ready for Implementation  
**Author:** May  
**Date:** 2025-07-12  

## Problem Statement

Currently, guards and workflows are two independent systems that both enforce quality:

- **Guards** (`compose-guards.ts`) — `beforeToolCall` hooks that intercept tool calls (mainly `finish()`) and block if quality criteria aren't met. They run at the *tool level*.
- **Workflows** (`workflow-tool.ts`) — orchestrate multi-step agent sequences. They run at the *task level*.

The disconnect: when a guard blocks `finish()` because an agent didn't verify their work, the guard can only *block and lecture*. The agent has to figure out what to do next. With the Phase 1 `redirect` feature (now implemented), guards can *suggest* a workflow, but the agent still has to manually invoke it.

Hao's question: **"What about unifying guards into workflows?"** — i.e., make the workflow engine itself the enforcement layer, eliminating the need for guards to lecture about verification because the workflow *structure* guarantees it.

## Current Architecture

```
┌─────────────────────────────────────────────────┐
│  Agent Session                                   │
│                                                  │
│  tool call ──► composeGuards ──► tool.execute()  │
│                 │                                │
│                 ├── commitGuard                   │
│                 ├── finishGuard                   │
│                 ├── completenessGuard             │
│                 ├── verificationDepthGuard        │
│                 └── ...                           │
│                                                  │
│  workflow("verify-wrap", task) ──► runAgent()     │
│                                    runAgent()     │
└─────────────────────────────────────────────────┘
```

Guards and workflows are *parallel*: both exist in the same session but don't coordinate. A guard might block `finish()` saying "no verification evidence" while the agent is already *inside* a verify-wrap workflow that provides exactly that evidence.

## Design Options

### Option A: Guards as Workflow Middleware (Rejected)

Inject guard checks between workflow steps — e.g., after each `runAgent()`, a guard layer checks the result before proceeding.

**Why rejected:** Workflows already have structural verification (Phase 2 in verify-wrap is literally a verification step). Adding guard checks *between* steps would be redundant and would slow things down. The whole point of workflows is that their *structure* is the guard.

### Option B: Workflow-Aware Guards (Current — Phase 1)

Guards detect when they're running inside a workflow context and adjust their behavior. The `redirect` field on `BeforeToolCallResult` nudges agents toward workflows.

**What exists:**
- `BeforeToolCallResult.redirect` — guard suggests a workflow when blocking
- `BeforeToolCallResult.steer` — guard injects non-blocking guidance
- Both implemented in `manager-receipts.ts`, tested in `test/guard-redirect.test.ts`

**Limitation:** Still advisory. The agent has to actually follow the redirect.

### Option C: Workflow as Default Execution Mode (Proposed — Phase 2)

The key insight: **guards shouldn't need to exist for things workflows already handle.** Instead of making guards smarter, make workflows the *default path* and eliminate guards that duplicate workflow structure.

## Proposed Design: "Workflows as Structure, Guards as Safety Nets"

### Principle

Split concerns clearly:

| Concern | Owner | Example |
|---------|-------|---------|
| Task execution structure | **Workflow** | "Write code, then verify files" |
| Output quality | **Workflow** | verify-wrap Phase 2 checks |
| Safety invariants | **Guard** | "Don't edit other agents' SOUL.md" |
| Resource limits | **Guard** | Read dedup, scrape dedup |
| Process compliance | **Guard** | Commit before finish |

Guards should only enforce things that are *invariant across all tasks*. Task-specific quality checks belong in workflows.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Agent Session                                           │
│                                                          │
│  ┌── Safety Guards (always active) ──────────────────┐  │
│  │  crossEditGuard     — protect SOUL.md, agent.json  │  │
│  │  readDedupGuard     — prevent infinite read loops   │  │
│  │  commitGuard        — enforce git hygiene           │  │
│  │  emptyArgsGuard     — catch malformed tool calls    │  │
│  │  toolSchemaGuard    — validate tool parameters      │  │
│  │  pathHallucinationGuard — catch nonexistent paths   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌── Workflow-Replaceable Guards (Phase 2 removal) ──┐  │
│  │  ❌ verificationDepthGuard — verify-wrap replaces   │  │
│  │  ❌ completenessGuard — workflow structure replaces  │  │
│  │  ⚠️  finishGuard — partially replaceable            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌── Workflow Engine ────────────────────────────────┐  │
│  │  verify-wrap    — execute + verify files           │  │
│  │  investigate    — diagnose + fix + verify          │  │
│  │  auto-loop      — iterative refinement            │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Phase 2 Implementation Plan

#### Step 1: Workflow Context in Guards (Low-hanging fruit)

Add a `workflowContext` field to `BeforeToolCallContext`:

```typescript
export interface BeforeToolCallContext {
  toolCall: { name: string; id: string };
  args: Record<string, unknown>;
  context: {
    messages: Array<{ role: string; content: unknown }>;
  };
  /** Present when the session is a workflow step. */
  workflowContext?: {
    workflowName: string;
    workflowRunId: string;
    stepLabel: string;
    depth: number;
  };
}
```

This lets guards skip checks that the workflow already handles:
- `verificationDepthGuard` → skip if inside `verify-wrap` (the workflow IS the verification)
- `completenessGuard` → skip if inside any workflow (the orchestrator checks completeness)

**How to populate:** The `callAgent()` call in `workflow-tool.ts` already passes `workflowRunId` and `stepLabel` via `HandoffOptions`. These are available in the session metadata. Wire them into the guard context.

#### Step 2: Auto-Wrap with verify-wrap (Medium effort)

For agents that don't explicitly use workflows, the system auto-wraps their task in `verify-wrap`:

```typescript
// In SubagentManager.callAgent():
async callAgent(agentName: string, task: string, opts?: CallOptions): Promise<TaskResult> {
  const def = this.registry.get(agentName);
  
  // Auto-wrap: if agent has verify-wrap and task isn't already in a workflow
  if (!opts?.workflowRunId && def.autoVerify !== false) {
    // Run via verify-wrap workflow instead of direct execution
    return this.runWorkflow("verify-wrap", agentName, task);
  }
  
  // Direct execution for workflow steps or opted-out agents
  return this._callAgentDirect(agentName, task, opts);
}
```

This means `verificationDepthGuard` becomes completely unnecessary — every task either:
1. Runs inside a workflow (which has its own verification), or
2. Gets auto-wrapped in verify-wrap

#### Step 3: Workflow-Level afterStep Hook (Future)

Add optional `afterStep` callbacks to workflow definitions for custom quality checks between steps:

```typescript
export interface WorkflowModule {
  name: string;
  description: string;
  execute(ctx: WorkflowContext): Promise<WorkflowResult>;
  /** Optional: called after each runAgent() completes. */
  afterStep?(step: string, result: TaskResult): {
    proceed: boolean;
    feedback?: string;
  };
}
```

This replaces what `finishGuard` does today — checking evidence at the workflow level instead of the tool level.

### Guard Retirement Schedule

| Guard | Phase 2 Status | Replacement |
|-------|---------------|-------------|
| `verificationDepthGuard` | **Retire** | verify-wrap auto-wrapping |
| `completenessGuard` | **Retire** | Workflow completeness is structural |
| `finishGuard` (evidence check) | **Simplify** | Keep basic evidence check, remove verbose lecturing |
| `commitGuard` | **Keep** | Safety invariant, not task-specific |
| `crossEditGuard` | **Keep** | Safety invariant |
| `readDedupGuard` | **Keep** | Resource limit |
| `scrapeDedupGuard` | **Keep** | Resource limit |
| `emptyArgsGuard` | **Keep** | Safety invariant |
| `toolSchemaGuard` | **Keep** | Safety invariant |
| `pathHallucinationGuard` | **Keep** | Safety invariant |

### Evidence: Guard Overhead

From EXP-142 data:
- Bob's quality *dropped* 6.1pp when verificationDepthGuard was active (N=438)
- His deliver-or-report workflow already provides better verification than the guard
- This is the canonical example of "workflow replaces guard"

From session data:
- Guards fire ~3-5x per session on average, mostly on `finish()` calls
- ~70% of guard blocks are "re-runs" where the agent does the same thing it was going to do anyway
- Workflow-based agents (optimizer, bob) have the highest quality scores despite (because of?) fewer guard interventions

## What Already Works (Phase 1 — Complete)

1. ✅ `BeforeToolCallResult.redirect` — guards suggest workflows
2. ✅ `BeforeToolCallResult.steer` — guards inject non-blocking guidance  
3. ✅ `manager-receipts.ts` integration — redirect triggers `agent.steer()`
4. ✅ Tests passing in `test/guard-redirect.test.ts`
5. ✅ Bob exemption from verification guard (EXP-142 evidence)

## Phase 2 Implementation Priority

1. **workflowContext in guards** — 2-3 hours, lowest risk, immediate value
2. **Auto-wrap with verify-wrap** — 4-6 hours, medium risk, high value
3. **afterStep hook** — 2-3 hours, low risk, future-proofing
4. **Guard retirement** — 1 hour per guard, done incrementally with A/B testing

## Open Questions

1. **Should auto-wrap be opt-in or opt-out?** Current proposal: opt-out (`autoVerify: false` in agent.json). Most agents benefit from verification.

2. **What about latency?** verify-wrap adds a JS verification step (no LLM cost since Phase 2 rewrite). Latency impact is <100ms per file checked. Acceptable.

3. **How do we measure success?** Compare quality scores before/after guard retirement. If quality stays the same or improves with fewer guards, the design is validated.

4. **Workflow-in-workflow nesting depth?** Currently maxDepth=3. Auto-wrapping adds 1 layer. Need to ensure this doesn't hit the limit for complex workflows. May need maxDepth=4.
