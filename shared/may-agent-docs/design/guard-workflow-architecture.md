# Event-Native Guard-Workflow Architecture

**Status**: RFC Draft  
**Author**: Bob (design), per Hao directive 2026-04-13  
**Date**: 2026-04-13  
**Supersedes**: May's `DESIGN-session-event-flow.md` (session-level design — this elevates to workflow-level)

---

## Hao's Directive: The 5-Step Pattern

Hao described this pattern on 2026-04-13 (17:16–17:37 UTC):

> 1. Agent is in a workflow  
> 2. Guard triggers on one step of the workflow  
> 3. Optional or mandatory actions are injected into the workflow  
> 4. The agent on the step or orchestrator agent gets a chance to react to the action (which may be an inner workflow, escalation, etc.)  
> 5. The action executes and then returns to where it was interrupted  

**Critical correction**: May's initial design operated at session level — guards intercepting *tool calls within a session*. Hao's vision operates at **workflow level** — guards observing *workflow step completion* and injecting *new steps into the workflow DAG*. This is orchestration, not session steering.

The distinction matters because:
- **Session-level**: Guard fires on `finish()` tool call → blocks call → agent sees error → agent decides what to do. The guard operates *within* a single session's tool loop.
- **Workflow-level**: Guard fires on step_done event → injects a new step *into the workflow sequence* → the workflow engine executes it → control returns to where it was. The guard operates *above* any individual session.

Session-level guards are useful (and already exist). But Hao's vision is about a higher level of control — where the workflow DAG itself is the thing being monitored and modified.

---

## 1. The Event Model

### Current Event Streams (already exist)

We have three separate event systems that don't compose:

| System | Events | Scope | Observability |
|--------|--------|-------|---------------|
| **EventBus** (event-system.md) | `session_start`, `text`, `tool_call`, `tool_result`, `turn_end`, `session_end` | Cross-session, systemwide | Full — subscribers see everything |
| **WorkflowEvents** (workflow.ts) | `workflow_start`, `step_start`, `step_done`, `workflow_done`, `workflow_escalate` | Per-workflow, via `onEvent` callback | Limited — only the workflow tool's callback sees them |
| **GuardResults** (compose-guards.ts) | `{block, reason, redirect?, steer?}` | Per-tool-call, synchronous return | None — results consumed immediately by wrapToolsWithReceipts |

### Proposed: Unified Event Stream

All three become events on the same bus:

```typescript
// ── Workflow-Level Events (NEW — elevated from onEvent callback) ────────
type WorkflowBusEvent =
  | { type: "workflow_start"; workflowRunId: string; workflow: string; task: string; parentSessionId?: string }
  | { type: "workflow_step_start"; workflowRunId: string; step: string; sessionId?: string }
  | { type: "workflow_step_done"; workflowRunId: string; step: string; sessionId?: string; result: StepResult }
  | { type: "workflow_done"; workflowRunId: string; summary: string }
  | { type: "workflow_escalate"; workflowRunId: string; reason: string }
  | { type: "workflow_interrupted"; workflowRunId: string; steeringMessage: string };

// ── Guard Events (NEW — elevated from synchronous returns) ─────────────
type GuardBusEvent =
  | { type: "guard_fired"; guardName: string; sessionId: string; toolName: string;
      severity: "info" | "warning" | "critical"; blocked: boolean;
      recommendation?: GuardRecommendation }
  | { type: "guard_action_injected"; workflowRunId: string; guardName: string;
      action: InjectedAction; mandatory: boolean }
  | { type: "guard_action_completed"; workflowRunId: string; guardName: string;
      result: StepResult };

// StepResult is a simplified view of TaskResult
interface StepResult {
  status: "done" | "error";
  summary: string;
  sessionId?: string;
}
```

**Why unify?** Because the 5-step pattern requires guard events to affect workflow execution. If they live in separate systems, step 3 ("inject into the workflow") requires ad-hoc bridging. On a unified bus, a guard event is just another event that workflow middleware can subscribe to.

---

## 2. Workflow as Inspectable Event Sequence

### The Problem: Opaque `execute()` Functions

Today, workflows are opaque async functions:

```typescript
// verify-wrap.ts
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const phase1 = await ctx.runAgent(ctx.agent, ctx.task);  // step 1
  // ... pure JS verification ...                          // step 2
  return ctx.done(summary);
}
```

The workflow engine (workflow-tool.ts) can observe steps via the `onEvent` callback but cannot *modify the step sequence*. There's no way to say "after step 1 completes, insert step 1.5 before step 2" — the sequence is hardcoded in `execute()`.

### The Solution: Step Registration + Middleware

Instead of opaque async functions, workflows register their steps as a sequence that the engine can inspect and modify before execution:

```typescript
// ── Workflow Step Definition ───────────────────────────────────────────
interface WorkflowStepDef {
  /** Unique step name (e.g., "execute", "verify", "review") */
  name: string;
  /** Human description for observability */
  description?: string;
  /** The step's execution logic */
  run: (ctx: StepContext) => Promise<StepResult>;
  /** Tags for guard matching (e.g., ["code-change", "verification"]) */
  tags?: string[];
}

// ── Workflow Definition (replaces bare execute function) ────────────────
interface WorkflowDef {
  name: string;
  description: string;
  /** Register steps. The engine calls this once to get the step sequence. */
  steps: (ctx: WorkflowContext) => WorkflowStepDef[];
}
```

A workflow definition becomes declarative:

```typescript
// verify-wrap.ts (new style)
export const name = "verify-wrap";
export const description = "Minimal 2-phase verification wrapper.";

export function steps(ctx: WorkflowContext): WorkflowStepDef[] {
  return [
    {
      name: "execute",
      tags: ["code-change"],
      run: async (stepCtx) => {
        const result = await ctx.runAgent(ctx.agent, ctx.task);
        stepCtx.set("writtenFiles", extractWrittenFiles(result.messages));
        return { status: result.status, summary: result.lastAssistantText ?? "" };
      },
    },
    {
      name: "verify",
      tags: ["verification"],
      run: async (stepCtx) => {
        const files = stepCtx.get("writtenFiles") ?? [];
        const results = files.map(verifyFile);
        // ... build report ...
        return { status: "done", summary: verificationReport };
      },
    },
  ];
}
```

**Backward compatibility**: The engine detects whether a workflow exports `steps` (new) or `execute` (old). Old-style workflows work unchanged — they're treated as a single opaque step.

```typescript
// In workflow-tool.ts
async function loadWorkflow(filePath: string): Promise<WorkflowModule> {
  const mod = await import(filePath);
  if (typeof mod.steps === "function") {
    // New-style: inspectable step sequence
    return { name: mod.name, description: mod.description, steps: mod.steps, style: "declarative" };
  }
  if (typeof mod.execute === "function") {
    // Old-style: wrap entire execute() as single step
    return { name: mod.name, description: mod.description, 
      steps: (ctx) => [{ name: "execute", run: () => mod.execute(ctx) }],
      style: "opaque" };
  }
  throw new Error(`Workflow ${filePath} must export 'steps' or 'execute'`);
}
```

---

## 3. Guard Hook Points: Workflow Step Boundaries

### Current: Guards at Tool-Call Level

```
Agent session
  └─ tool call: finish()
       └─ beforeToolCall → composeGuards() → [guard₁, guard₂, ...guardₙ]
            └─ Returns: { block: true, reason: "..." }
```

Guards see individual tool calls within a single session. They have no visibility into which workflow step the session belongs to or what other steps exist.

### Proposed: Guards at Workflow Step Boundaries

```
Workflow engine
  └─ Step sequence: [execute, verify, ...]
       └─ BEFORE each step → onBeforeStep middleware → [guard₁, guard₂, ...]
       └─ AFTER each step  → onAfterStep middleware  → [guard₁, guard₂, ...]
            └─ Returns: { inject?: InjectedAction[], abort?: string }
```

Guards at this level see:
- **Which step just completed** (name, tags, result)
- **The full step sequence** (what's been done, what's coming)
- **The workflow context** (task, agent, prior step results)
- **Cumulative step data** (files written, errors encountered)

This maps directly to Hao's step 2: *"Guard triggers on one step of the workflow."*

### The WorkflowGuard Interface

```typescript
interface WorkflowGuardContext {
  /** The workflow being executed */
  workflowName: string;
  workflowRunId: string;
  
  /** The step that just completed (for afterStep guards) */
  completedStep?: {
    name: string;
    tags: string[];
    result: StepResult;
  };
  
  /** The step about to run (for beforeStep guards) */
  nextStep?: {
    name: string;
    tags: string[];
  };
  
  /** All steps completed so far */
  completedSteps: Array<{ name: string; result: StepResult }>;
  
  /** Remaining steps in the sequence */
  remainingSteps: Array<{ name: string; tags: string[] }>;
  
  /** Shared step data (set by steps, readable by guards) */
  stepData: Map<string, unknown>;
  
  /** The original workflow task */
  task: string;
  
  /** The agent that initiated the workflow */
  agent: string;
}

interface WorkflowGuardResult {
  /** Actions to inject into the workflow sequence */
  inject?: InjectedAction[];
  
  /** Abort the workflow entirely */
  abort?: { reason: string };
  
  /** Log message for observability */
  message?: string;
}

type WorkflowGuard = (ctx: WorkflowGuardContext) => Promise<WorkflowGuardResult | undefined>;
```

### InjectedAction: The Core Mechanism

This is the heart of the architecture — how a guard injects work into a running workflow:

```typescript
interface InjectedAction {
  /** What kind of action to inject */
  type: "step" | "workflow" | "escalation";
  
  /** Is this mandatory (must execute) or optional (agent can skip)? */
  mandatory: boolean;
  
  /** Where to inject relative to current position */
  position: "before-next" | "after-current" | "replace-next";
  
  /** For type "step": a step definition to inject */
  step?: WorkflowStepDef;
  
  /** For type "workflow": a sub-workflow to inject */
  workflow?: { name: string; task: string };
  
  /** For type "escalation": escalate to the orchestrator */
  escalation?: { reason: string; context?: unknown };
  
  /** Which guard injected this (for observability) */
  source: string;
}
```

---

## 4. Action Injection: How Guards Modify the Running Workflow

### The Step Queue

The workflow engine maintains a mutable step queue instead of a fixed array:

```typescript
class WorkflowRunner {
  private stepQueue: WorkflowStepDef[];
  private completedSteps: Array<{ name: string; result: StepResult }>;
  private guards: WorkflowGuard[];
  private stepData: Map<string, unknown>;
  
  async run(workflow: WorkflowDef, ctx: WorkflowContext): Promise<WorkflowResult> {
    this.stepQueue = [...workflow.steps(ctx)];
    this.completedSteps = [];
    this.stepData = new Map();
    
    while (this.stepQueue.length > 0) {
      const step = this.stepQueue.shift()!;
      
      // ── Before-step guards ─────────────────────────────────
      const beforeResult = await this.runGuards("before", step);
      if (beforeResult.abort) {
        return { type: "escalate", reason: beforeResult.abort.reason };
      }
      // Injections from before-guards go at front of queue
      this.applyInjections(beforeResult.injections, "before-next");
      
      // ── Execute the step ───────────────────────────────────
      const stepCtx = this.createStepContext(step);
      const result = await step.run(stepCtx);
      this.completedSteps.push({ name: step.name, result });
      
      // Emit on bus
      this.emit({ type: "workflow_step_done", step: step.name, result });
      
      // ── After-step guards ──────────────────────────────────
      const afterResult = await this.runGuards("after", step, result);
      if (afterResult.abort) {
        return { type: "escalate", reason: afterResult.abort.reason };
      }
      // Injections from after-guards go at front of queue
      this.applyInjections(afterResult.injections, "before-next");
    }
    
    const lastResult = this.completedSteps.at(-1)?.result;
    return { type: "done", summary: lastResult?.summary ?? "Workflow complete" };
  }
  
  private applyInjections(injections: InjectedAction[], position: string): void {
    for (const action of injections) {
      if (action.type === "step" && action.step) {
        // Insert at front of queue (runs next)
        this.stepQueue.unshift(action.step);
      } else if (action.type === "workflow" && action.workflow) {
        // Convert sub-workflow to a step that calls runWorkflow
        this.stepQueue.unshift({
          name: `guard-injected:${action.source}`,
          tags: ["guard-injected"],
          run: async () => {
            const result = await this.ctx.runWorkflow(action.workflow!.name, action.workflow!.task);
            return { status: result.type === "done" ? "done" : "error", summary: result.type === "done" ? result.summary : result.reason };
          },
        });
      }
    }
  }
}
```

### Mapping to Hao's 5 Steps

| Hao's Step | Architecture Component | Code Path |
|------------|----------------------|-----------|
| **1. Agent is in a workflow** | WorkflowRunner is executing `stepQueue` | `WorkflowRunner.run()` loop |
| **2. Guard triggers on one step** | After-step guard fires on `step_done` | `this.runGuards("after", step, result)` |
| **3. Actions are injected** | Guard returns `InjectedAction[]`, engine inserts into `stepQueue` | `this.applyInjections(...)` |
| **4. Agent/orchestrator reacts** | The injected step executes — agent or sub-workflow runs | `step.run(stepCtx)` on the injected step |
| **5. Returns to interrupted point** | Injected step completes, `while` loop continues with original remaining steps | Next iteration of `while (stepQueue.length > 0)` |

### Optional vs. Mandatory Actions

```typescript
// Guard returns an optional action:
{
  inject: [{
    type: "step",
    mandatory: false,  // agent can skip
    step: { name: "suggested-review", run: async () => { ... } },
    source: "quality-guard",
  }]
}

// Guard returns a mandatory action:
{
  inject: [{
    type: "workflow",
    mandatory: true,  // must execute, cannot be skipped
    workflow: { name: "verify-wrap", task: "Verify changes from previous step" },
    source: "finish-guard",
  }]
}
```

For optional actions, the engine can wrap them in a "decision step" where the orchestrating agent or a lightweight LLM call decides whether to proceed:

```typescript
// Engine wraps optional action in a decision gate
if (!action.mandatory) {
  const decisionStep: WorkflowStepDef = {
    name: `decide:${action.source}`,
    tags: ["guard-decision"],
    run: async (stepCtx) => {
      // Ask the orchestrator agent whether to proceed
      // For now: always proceed (simplest implementation)
      return { status: "done", summary: "Proceeding with optional action" };
    },
  };
  this.stepQueue.unshift(action.step ?? decisionStep, decisionStep);
} else {
  this.stepQueue.unshift(action.step!);
}
```

---

## 5. Agent Reaction: The Decision Point

Hao's step 4 says *"the agent on the step or orchestrator agent gets a chance to react."*

There are two reaction modes:

### Mode A: In-Step Agent Reaction (Session-Level)

The agent currently running the step sees the guard's action as a steering message within its session. This is May's design and already works for tool-call-level guards.

```
[Session] Agent working on step "execute"
  └─ Guard fires on tool call → steer message injected
  └─ Agent sees: "Guard recommends X" → Agent decides → Agent acts
```

**When to use**: For guidance within a step (e.g., "you've read this file 3 times, stop").

### Mode B: Workflow-Level Orchestrator Reaction (NEW)

The guard injects an action *between steps* and the workflow engine handles it. No individual agent session needs to react — the workflow DAG itself is modified.

```
[Workflow] Step "execute" completes → Guard fires → Action injected
  └─ Engine inserts "verify" step into queue
  └─ Engine executes "verify" step (new agent session or pure JS)
  └─ Engine continues with remaining steps
```

**When to use**: For structural verification (Hao's pattern). The individual agent doesn't need to know about the guard — the workflow handles it.

### Mode C: Escalation Reaction (NEW)

The guard determines the situation requires human or orchestrator judgment:

```
[Workflow] Step "execute" completes → Guard fires → Escalation injected
  └─ Engine pauses workflow → Emits escalation event on bus
  └─ Orchestrator (May or human) receives escalation
  └─ Orchestrator decides: resume, abort, or modify
```

**When to use**: For ambiguous situations where the guard can't determine the right action.

---

## 6. Resume: Returning to the Interrupted Point

The beauty of the step-queue model is that resume is trivial. After an injected action completes, the `while` loop simply continues with the next item in `stepQueue`. There's no "interrupt/resume" state machine — just a queue.

```
Before injection:  stepQueue = [step-B, step-C]
Guard fires after step-A: injects [guard-verify]
After injection:   stepQueue = [guard-verify, step-B, step-C]
guard-verify runs...
After guard-verify: stepQueue = [step-B, step-C]
step-B runs normally.
```

### Resume After Crash

The existing `WorkflowRun` persistence mechanism (workflow-tool.ts) already tracks completed steps and supports resume. The step-queue model is compatible:

```typescript
// On resume: reconstruct queue by removing completed steps
const completedNames = new Set(previousRun.steps.map(s => s.agent));
this.stepQueue = allSteps.filter(s => !completedNames.has(s.name));
```

Guard-injected steps that completed before the crash are recorded in `WorkflowRun.steps` like any other step, so they're correctly replayed on resume.

---

## 7. Concrete Examples

### Example A: finish-guard → verify-wrap Redirect (Current → Proposed)

**Current flow** (session-level, May's design):
```
1. Agent calls finish(status: "success") 
2. finish-guard fires in beforeToolCall
3. Guard returns { block: true, redirect: { workflow: "verify-wrap", ... } }
4. wrapToolsWithReceipts blocks the tool call
5. Agent.steer() injects: "Guard recommends verify-wrap workflow"
6. Agent (maybe) runs workflow("verify-wrap", ...)
7. Agent (maybe) just rephrases summary to bypass guard
```
Problem: Step 6 is "maybe" — the agent has agency to ignore the redirect (KE-176: interruptive steps get 10% compliance).

**Proposed flow** (workflow-level):
```
1. Workflow is running: steps = [execute, review, finalize]
2. "execute" step completes — agent's session ends with files written
3. After-step WorkflowGuard fires:
     - Examines step result: files written, no verification in transcript
     - Returns: { inject: [{ type: "workflow", mandatory: true,
         workflow: { name: "verify-wrap", task: "Verify files from execute step" },
         source: "verification-guard" }] }
4. Engine inserts verify-wrap into stepQueue:
     stepQueue = [guard-injected:verification-guard, review, finalize]
5. verify-wrap runs as a sub-workflow (new session, structural verification)
6. verify-wrap completes → result available to next steps
7. stepQueue continues: [review, finalize]
```

The agent from step 2 never sees the guard. Verification is structural (KE-174: zero alignment tax, zero amplification). The guard operates at the workflow level, not the session level. Compliance isn't relevant — the architecture enforces it.

### Example B: completeness-guard → Investigation Workflow

**Scenario**: Agent in a code-fix workflow skips investigating hidden dependencies.

```
1. Workflow: steps = [investigate, fix, verify]
2. "investigate" step completes — but agent only found 2 of 4 bugs
3. After-step WorkflowGuard fires:
     - Examines step result: FINDINGS.md exists but is thin (< 200 chars)
     - Returns: { inject: [{ type: "step", mandatory: false,
         step: { name: "deep-investigate", tags: ["investigation"],
           run: async (ctx) => {
             const result = await workflowCtx.runAgent("coder", 
               "Re-examine the codebase for hidden dependencies. The initial investigation was brief.");
             return { status: result.status, summary: result.lastAssistantText ?? "" };
           }
         },
         source: "completeness-guard" }] }
4. Action is optional → engine may ask orchestrator whether to proceed
5. If proceeds: deep-investigate runs, finds 2 more bugs
6. stepQueue continues: [fix, verify] — fix step now has richer context
```

### Example C: Quality Guard on Code Review Step

```
1. Workflow: steps = [implement, review, merge]
2. "review" step completes — reviewer found 3 issues but coder only fixed 1
3. After-step WorkflowGuard fires:
     - Examines step result: mentions "3 issues found" but later "1 resolved"
     - Returns: { inject: [{ type: "step", mandatory: true,
         step: { name: "fix-review-issues", ... },
         source: "review-completeness-guard" }] }
4. Engine injects: stepQueue = [fix-review-issues, merge]
5. fix-review-issues runs → fixes remaining 2 issues
6. merge runs normally
```

---

## 8. Connection to Evidence

### KE-174: Structural Enforcement α≈1

KE-174 established that **structural verification** (architecture-level, not agent-level) avoids the alignment tax and bias amplification. The guard-workflow architecture is the implementation path for this:

- **Guards that inject workflow steps** = structural verification (α≈1, no alignment tax)
- **Guards that block tool calls and steer agents** = behavioral verification (α>1, alignment tax present)

The proposed architecture moves guards from behavioral (block + steer) to structural (inject + execute). This is the concrete mechanism that realizes KE-174's "Regime 2: Structural Verification."

### KE-176: Selective Compliance — Agents Cherry-Pick

KE-176 showed that agents follow additive skill steps (~100%) but ignore interruptive steps (~10%). Session-level guard redirects are interruptive — they ask the agent to stop what it's doing and run a workflow. Compliance is low.

Workflow-level guard injection sidesteps compliance entirely. The agent doesn't decide whether to run the verification workflow — the workflow engine does. This converts an interruptive behavioral requirement into a structural architectural guarantee.

### KE-135: Gate-Task Synergy

KE-135 found that guards/gates perform best when they're analytically relevant to the core task. Irrelevant guards cause attention dilution (-36pp).

In the proposed architecture, workflow guards can be configured per-workflow and matched by step tags. A verification guard only fires on steps tagged `["code-change"]`, not on analysis or investigation steps. This enables the synergy KE-135 recommends: guards are matched to the steps where they're relevant.

```typescript
// Guard registration with tag matching
const verificationGuard: WorkflowGuard = {
  name: "post-code-verification",
  /** Only fire after steps tagged "code-change" */
  triggerOn: { afterStepTags: ["code-change"] },
  evaluate: async (ctx) => {
    // Only inject verification if the step actually wrote files
    const writtenFiles = ctx.stepData.get("writtenFiles") as string[] | undefined;
    if (!writtenFiles?.length) return undefined;
    return {
      inject: [{
        type: "workflow",
        mandatory: true,
        workflow: { name: "verify-wrap", task: `Verify: ${writtenFiles.join(", ")}` },
        source: "post-code-verification",
      }],
    };
  },
};
```

---

## 9. Connection to Existing Architecture

### Layering on the EventBus

The existing EventBus (event-system.md) already carries session-level events. Workflow events currently flow through an `onEvent` callback in workflow-tool.ts. The minimal change:

```typescript
// In workflow-tool.ts, change from:
onEvent?.({ type: "step_done", step: agentName, sessionId: sid, result: taskResult });

// To:
const event = { type: "workflow_step_done", workflowRunId: runId, step: agentName, sessionId: sid, result: taskResult };
onEvent?.(event);
bus?.emit(event);  // Also emit on the global bus
```

Guard events similarly emit on the bus:

```typescript
bus?.emit({
  type: "guard_action_injected",
  workflowRunId: runId,
  guardName: guard.name,
  action: injectedAction,
  mandatory: injectedAction.mandatory,
});
```

This gives all existing bus subscribers (DbWriter, Telegram, AutoEval, Web UI) visibility into guard-workflow interactions without changing their code.

### Relationship to `beforeToolCall`/`afterToolCall`

The existing tool-call guards continue to work unchanged. They're a different level:

| Level | Hook | Scope | Granularity |
|-------|------|-------|-------------|
| **Tool-call** (existing) | `beforeToolCall` / `afterToolCall` | Within a session | Individual tool invocation |
| **Workflow-step** (new) | `beforeStep` / `afterStep` | Within a workflow | Agent session or JS step |

They compose naturally:
- **Tool-call guards** handle session-internal concerns: path validation, read dedup, empty args, scrape dedup
- **Workflow-step guards** handle cross-step concerns: verification, completeness, quality review

Some guards exist at both levels. The finish-guard currently operates at tool-call level (blocking `finish()` in sessions). Under the new architecture, verification can be moved to workflow-step level (injecting verify-wrap after code-change steps), making the tool-call-level finish-guard lighter or unnecessary for workflows.

### Connection to Existing Steering Queue

The workflow engine already has a `steeringQueue` for interrupting workflows:

```typescript
// workflow-tool.ts, line ~109
const steering = steeringQueue.shift();
if (steering) {
  throw new WorkflowInterrupted(steering, completedSteps, runId);
}
```

The guard-injection mechanism is conceptually similar but constructive rather than destructive:
- **Steering** = "stop the workflow, throw an exception"  
- **Guard injection** = "add a step to the workflow, keep going"

Both modify workflow execution from outside. The steering mechanism is the "abort" path; guard injection is the "augment" path.

---

## 10. TypeScript Interfaces (Complete)

```typescript
// ── Step-Level Types ───────────────────────────────────────────────────

interface StepContext {
  /** Read data set by a previous step */
  get(key: string): unknown;
  /** Write data for subsequent steps/guards */
  set(key: string, value: unknown): void;
  /** The workflow's runAgent — delegates to WorkflowContext */
  runAgent(name: string, task: string): Promise<TaskResult>;
  /** The workflow's runWorkflow — for sub-workflow steps */
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;
  /** Summarize a task result for handoff */
  summarize(result: TaskResult, opts?: HandoffOptions): string;
}

interface StepResult {
  status: "done" | "error";
  summary: string;
  sessionId?: string;
}

interface WorkflowStepDef {
  name: string;
  description?: string;
  tags?: string[];
  run: (ctx: StepContext) => Promise<StepResult>;
}

// ── Workflow Definition Types ──────────────────────────────────────────

/** New-style workflow: declarative step sequence */
interface DeclarativeWorkflowModule {
  name: string;
  description: string;
  steps: (ctx: WorkflowContext) => WorkflowStepDef[];
  style: "declarative";
}

/** Old-style workflow: opaque execute function (backward compat) */
interface OpaqueWorkflowModule {
  name: string;
  description: string;
  execute: (ctx: WorkflowContext) => Promise<WorkflowResult>;
  style: "opaque";
}

type WorkflowModule = DeclarativeWorkflowModule | OpaqueWorkflowModule;

// ── Guard Types ────────────────────────────────────────────────────────

interface WorkflowGuardContext {
  workflowName: string;
  workflowRunId: string;
  completedStep?: { name: string; tags: string[]; result: StepResult };
  nextStep?: { name: string; tags: string[] };
  completedSteps: Array<{ name: string; result: StepResult }>;
  remainingSteps: Array<{ name: string; tags: string[] }>;
  stepData: Map<string, unknown>;
  task: string;
  agent: string;
}

interface WorkflowGuardResult {
  inject?: InjectedAction[];
  abort?: { reason: string };
  message?: string;
}

type WorkflowGuardFn = (ctx: WorkflowGuardContext) => Promise<WorkflowGuardResult | undefined>;

interface WorkflowGuard {
  name: string;
  /** When to trigger this guard */
  triggerOn?: {
    /** Fire after steps with these tags */
    afterStepTags?: string[];
    /** Fire before steps with these tags */
    beforeStepTags?: string[];
    /** Fire on specific step names */
    stepNames?: string[];
    /** Fire on all steps (default if no triggerOn specified) */
    always?: boolean;
  };
  evaluate: WorkflowGuardFn;
}

// ── Injection Types ────────────────────────────────────────────────────

interface InjectedAction {
  type: "step" | "workflow" | "escalation";
  mandatory: boolean;
  position: "before-next" | "after-current" | "replace-next";
  step?: WorkflowStepDef;
  workflow?: { name: string; task: string };
  escalation?: { reason: string; context?: unknown };
  source: string;
}

// ── Guard Registration ─────────────────────────────────────────────────

interface WorkflowGuardRegistry {
  /** Register a guard globally (applies to all workflows) */
  register(guard: WorkflowGuard): void;
  /** Register a guard for a specific workflow */
  registerFor(workflowName: string, guard: WorkflowGuard): void;
  /** Get all guards that should fire for a given step */
  getGuards(workflowName: string, step: WorkflowStepDef, phase: "before" | "after"): WorkflowGuard[];
}
```

---

## 11. Implementation Phases

### Phase 0: Emit Workflow Events on the Bus (1-2 days)

**What**: Bridge the existing `onEvent` callback in workflow-tool.ts to the global EventBus. Workflow events become visible to all bus subscribers.

**Changes**:
- `workflow-tool.ts`: Accept `bus` parameter, emit workflow events on bus alongside `onEvent`
- `manager.ts`: Pass `bus` reference when creating workflow tool

**No behavioral changes**. Existing guards and workflows work identically. We just gain observability.

**Verification**: Web UI and DbWriter can see workflow step events.

### Phase 1: Step-Data Sharing Between Steps (1-2 days)

**What**: Add a `stepData: Map<string, unknown>` to the workflow execution context. Steps can write data (e.g., list of files written) that subsequent steps and guards can read.

**Changes**:
- `workflow-tool.ts`: Create `stepData` map in `executeWorkflow`, pass to each `runAgent` callback wrapper
- `workflow.ts`: Add `stepData` to `WorkflowContext` type

**This is the prerequisite** for guards to make informed decisions about step results. Without shared step data, a guard can only look at `result.lastAssistantText` (a string).

### Phase 2: Declarative Step Registration (3-5 days)

**What**: Support the `steps()` function alongside `execute()`. The workflow engine calls `steps()` to get the step sequence, then executes them in order.

**Changes**:
- `workflow.ts`: Add `WorkflowStepDef`, `StepContext`, `DeclarativeWorkflowModule` types
- `workflow-tool.ts`: Detect `steps` vs `execute` exports. For `steps`: build step queue, execute sequentially
- Migrate one workflow (e.g., `verify-wrap`) to the new style as proof-of-concept

**Backward compatible**: Old `execute()` workflows work unchanged.

### Phase 3: Workflow-Level Guard Hooks (3-5 days)

**What**: Add `beforeStep`/`afterStep` guard hooks to the step execution loop. Guards can observe step results and inject actions.

**Changes**:
- `workflow-tool.ts`: Add `WorkflowGuard[]` to execution context. After each step, run matching guards. If any return `inject`, insert into step queue.
- `compose-guards.ts` or new `compose-workflow-guards.ts`: Composition for workflow guards (same pattern: first abort wins, injections accumulate)
- `manager.ts`: Register default workflow guards (e.g., post-code-verification)

**This is the core of Hao's 5-step pattern.** After this phase, guards can inject steps into running workflows.

### Phase 4: Guard-Workflow Pairs (2-3 days)

**What**: Build the first guard-workflow pairs that demonstrate the pattern:

1. **Post-Code Verification Guard** → injects `verify-wrap` after any step tagged `["code-change"]`
2. **Review Completeness Guard** → injects a fix step after review steps where issues were found but not resolved
3. **Investigation Depth Guard** → injects deeper investigation after steps that produced thin findings

**Changes**: New guard definitions + registration. No engine changes.

### Phase 5: Per-Workflow Guard Configuration (2-3 days)

**What**: Allow workflows to declare which guards apply to them, and allow agent config to override guard behavior.

```typescript
// In workflow definition:
export const guards = ["post-code-verification", "review-completeness"];

// In agent.json:
{
  "workflowGuards": {
    "post-code-verification": { "enabled": true, "mandatory": true },
    "review-completeness": { "enabled": false }
  }
}
```

### Phase 6: Bus-Based Guard Analytics (2-3 days, can parallel with Phase 4-5)

**What**: Since guard events flow through the bus, add a `GuardAnalytics` subscriber that tracks:
- Which guards fire most frequently
- Which injections succeed vs. are redundant
- Time added by guard-injected steps
- Correlation between guard injection and workflow outcome quality

This feeds back into guard tuning (KE-135: ensuring guards are relevant, not dilutive).

---

## Comparison: May's Design vs. This Design

| Dimension | May's Session-Level Design | This Workflow-Level Design |
|-----------|---------------------------|---------------------------|
| **Guard trigger point** | Tool call within a session | Workflow step boundary |
| **Action mechanism** | Block tool call + steer agent | Inject step into workflow queue |
| **Agent involvement** | Agent must decide to follow redirect | Agent doesn't see the guard (structural) |
| **Compliance** | Voluntary (~10% for interruptive, KE-176) | Guaranteed (architectural enforcement) |
| **Alignment tax** | Present (agent spends capacity responding) | Absent (verification is external, KE-174) |
| **Amplification** | Present (guard-recovery is LLM-mediated) | Absent (no LLM reasoning in guard path, KE-174) |
| **Scope** | Single session | Cross-step, cross-session |
| **Existing infrastructure** | Already partially implemented (redirect/steer fields) | Needs step-queue refactor |
| **Backward compatibility** | Full | Full (opaque execute() wraps as single step) |

**May's design is still valuable** as the session-level layer. Not all work happens in workflows — ad-hoc agent sessions need tool-call guards too. The two layers compose:

```
Workflow-level guards: structural, inject steps, guaranteed
  └─ Within each step's session:
       Tool-call guards: behavioral, block/steer, voluntary
```

---

## Open Questions

1. **Guard ordering at workflow level**: When multiple guards want to inject steps after the same step, what order do injections execute in? Proposal: registration order (same as `composeGuards`). First guard's injection runs first.

2. **Guard on guard-injected steps**: If a guard-injected step completes, do guards fire on *it* too? This could create infinite loops. Proposal: guard-injected steps (tagged `["guard-injected"]`) are exempt from the guard that injected them but not from other guards. Max injection depth of 2 prevents runaway.

3. **Optional action UX**: For `mandatory: false` actions, who decides? The workflow engine could auto-proceed, ask the orchestrator agent, or skip by default. Starting with "auto-proceed with logging" is simplest.

4. **Data flow from injected steps**: If verify-wrap is injected between "execute" and "review", does the review step see verify-wrap's results? Proposal: yes — injected steps write to `stepData` like any other step. The review step can read `stepData.get("verify-wrap:result")`.

5. **Migration path for existing guard-redirect**: The finish-guard already returns `redirect: { workflow: "verify-wrap", ... }`. Should we keep this working at the session level while also adding workflow-level injection? Proposal: yes — both levels coexist. Workflow-level guards handle the common case; session-level redirects handle edge cases in ad-hoc sessions.

---

## Summary

Hao's directive calls for guards that operate at **workflow level**, injecting actions into the **workflow DAG** rather than blocking tool calls within sessions. This design delivers that through:

1. **Declarative step sequences** (inspectable, modifiable)
2. **Workflow-level guards** (fire on step boundaries, not tool calls)  
3. **Step queue injection** (guards add steps, engine executes them)
4. **Structural verification** (zero alignment tax per KE-174, guaranteed compliance per KE-176)
5. **Tag-based guard matching** (synergy over dilution per KE-135)
6. **Full backward compatibility** (old workflows and session-level guards unchanged)

The incremental implementation path starts with observability (Phase 0), adds data sharing (Phase 1), makes workflows inspectable (Phase 2), adds guard hooks (Phase 3), builds guard-workflow pairs (Phase 4), and adds configuration (Phase 5). Each phase is independently valuable and shippable.
