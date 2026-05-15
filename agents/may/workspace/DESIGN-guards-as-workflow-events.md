# DESIGN: Guards as Workflow Events

**Status:** Proposal  
**Author:** May  
**Date:** 2025-07-14  
**Supersedes:** DESIGN-workflow-guard-integration.md (Phase 2 portion)

## Hao's Insight

> "What about an event-based guard system where events inject into the workflow execution and agents react to them? It can be a fundamental part/first class mechanism of workflow."

The key realization: **guards and workflows are the same thing**. They're both about structuring agent execution. The current system has two parallel mechanisms doing overlapping work:

1. **Guards**: `beforeToolCall` hooks that intercept tool calls, can block, and must lecture the agent about what to do instead
2. **Workflows**: step-based execution sequences that structure how work gets done

The problem isn't integration — it's duplication. When a guard blocks `finish()` saying "you didn't verify your work," it's *poorly implementing a workflow step* (the verification step). When a workflow has a verify phase, it renders the verification guard irrelevant.

## Current Architecture: Two Parallel Systems

```
Agent makes a tool call
    │
    ├──► composeGuards() ──► [block/allow/steer/redirect]
    │    (beforeToolCall hooks)
    │    - Runs BEFORE every tool call
    │    - Can block with a reason string
    │    - Agent gets lectured, has to figure out what to do
    │
    └──► If tool is workflow("run", ...) ──► workflow engine
         (step-based execution)
         - Runs agents in sequence
         - Has event emission (workflow_start, step_start, step_done, workflow_done)
         - Has interruption mechanism (steeringQueue → WorkflowInterrupted)
         - But only runs when agent explicitly invokes a workflow
```

Problems:
- Guards lecture. Workflows guide. Lecturing is worse than guiding.
- Guards can't create new work. They can only block existing work.
- The `redirect` field (Phase 1) was a hack to make guards suggest workflows — admitting guards shouldn't be the ones handling task-level quality.
- Guards run on *every tool call* regardless of workflow context, causing redundant checks.

## Proposed Architecture: Unified Event-Driven Execution

### Core Idea

Every agent session runs inside a workflow context — even ad-hoc sessions. The workflow engine emits events at key points. **Guards become event listeners that can inject steps into the workflow execution.**

```
Agent Session (always has a workflow context)
    │
    ├── Events emitted at key points:
    │   ├── session_start
    │   ├── tool_call(name, args)      ← what guards currently intercept
    │   ├── tool_result(name, result)
    │   ├── step_complete(deliverables)
    │   └── session_finishing(evidence) ← what finish guard currently checks
    │
    ├── Event Listeners (née guards):
    │   ├── SafetyListener: tool_call → block cross-agent edits, empty args, etc.
    │   ├── ResourceListener: tool_call → dedup reads, scrapes
    │   ├── CommitListener: session_finishing → inject "commit your work" step
    │   └── VerifyListener: session_finishing → inject "verify deliverables" step
    │
    └── Step Injection:
        When a listener detects a quality gap, it doesn't block.
        It INJECTS a new step into the workflow execution:
        
        VerifyListener on session_finishing:
          "Agent is finishing without verification evidence"
          → inject step: runAgent(self, "Verify: check files X,Y,Z exist and are correct")
          → original finish() proceeds after verification step completes
```

### Key Design Principle: Listeners Never Block

In the current system, guards have two roles:
1. **Safety invariants**: Block dangerous operations (cross-agent edits, path hallucination)
2. **Quality enforcement**: Block finish() when work is incomplete

These should be handled differently:

| Type | Current | Proposed |
|------|---------|----------|
| Safety (invariant) | Guard blocks tool call | Listener blocks tool call (same, but simpler) |
| Quality (task-specific) | Guard blocks + lectures | Listener injects corrective step |

Safety listeners still block — you can't "inject a step" to fix a cross-agent edit. But quality listeners inject steps instead of blocking.

### How Step Injection Works

The workflow engine already has `steeringQueue` for interrupting running workflows. Step injection extends this:

```typescript
interface WorkflowEventListener {
  /** Unique name for this listener */
  name: string;
  
  /** Which events this listener cares about */
  events: WorkflowEventType[];
  
  /** 
   * Called when a matching event fires.
   * Returns undefined to allow, a StepInjection to add work,
   * or a BlockResult to hard-block (safety only).
   */
  handle(event: WorkflowEvent, context: ListenerContext): 
    Promise<StepInjection | BlockResult | undefined>;
}

interface StepInjection {
  type: 'inject';
  /** What the injected step should accomplish */
  task: string;
  /** Which agent runs it (default: current agent) */
  agent?: string;
  /** Where to inject: 'before' current step or 'after' */
  position: 'before' | 'after';
  /** Human-readable reason for the injection */
  reason: string;
}

interface BlockResult {
  type: 'block';
  reason: string;
}
```

### Event Flow: Before vs After

```
Workflow Execution:
  
  1. Agent starts working on task
  2. Agent calls finish()
  
  Current flow:
    finish() → composeGuards() → finishGuard says "BLOCKED: no verification"
    → Agent gets error, has to figure out what to do
    → Agent eventually verifies, calls finish() again
    → finishGuard allows it
    
  Proposed flow:
    finish() → emit(session_finishing, { evidence, deliverables })
    → VerifyListener: "no verification evidence found"
    → inject step: { task: "verify files X,Y,Z", agent: self, position: 'before' }
    → Workflow engine: pause finish(), run verification step
    → Verification step completes successfully
    → finish() proceeds with evidence from verification step
    
  The agent NEVER sees a blocked finish(). It experiences verification
  as a natural workflow step.
```

### The "Implicit Workflow" Concept

Currently, workflows are explicit — an agent calls `workflow("run", "verify-wrap", ...)`. Most sessions don't use workflows. The proposal: **every session runs inside an implicit workflow**.

```typescript
// Implicit workflow for non-workflow sessions:
const implicitWorkflow: WorkflowModule = {
  name: 'session',
  description: 'Default session workflow — just run the agent',
  execute: async (ctx) => {
    const result = await ctx.runAgent(ctx.agent, ctx.task);
    return ctx.done(result.lastAssistantText ?? 'completed');
  }
};
```

This means:
- Every session emits workflow events (tool_call, session_finishing, etc.)
- Every session can have steps injected by listeners
- The guard composition logic moves from `beforeToolCall` hooks to workflow event listeners

### Migration Path

**Phase 1: Safety-only guards stay as beforeToolCall hooks (no change)**
These are the fast-path, must-block-immediately guards:
- `crossEditGuard` — must block before the edit happens
- `emptyArgsGuard` — must block malformed calls
- `toolSchemaGuard` — must block invalid params
- `pathHallucinationGuard` — must block nonexistent paths
- `readDedupGuard` — must block infinite loops
- `scrapeDedupGuard` — must block duplicate scrapes

These are *synchronous invariants*. They don't benefit from step injection.

**Phase 2: Quality guards become workflow event listeners**
- `verificationDepthGuard` → `VerifyListener` on `session_finishing`
- `completenessGuard` → `CompletenessListener` on `session_finishing`  
- `finishGuard` → `EvidenceListener` on `session_finishing`
- `commitGuard` → `CommitListener` on `session_finishing`

These currently block finish() and lecture. Instead, they inject corrective steps.

**Phase 3: Implicit workflow wrapping**
- Non-workflow sessions get wrapped in the implicit workflow
- All quality listeners can fire for all sessions
- Explicit workflows compose naturally with listeners

### Concrete Example: CommitGuard → CommitListener

Current behavior (guard):
```
Agent: finish({ summary: "Done!" })
Guard: "BLOCKED — you have uncommitted changes. Run git add && git commit."
Agent: bash("git add -A && git commit -m 'fix stuff'")
Agent: finish({ summary: "Done!" })  // tries again
Guard: passes
```

Proposed behavior (listener):
```
Agent: finish({ summary: "Done!" })
Event: session_finishing { uncommittedChanges: true }
CommitListener → inject { 
  task: "Commit your changes with a descriptive message", 
  position: 'before',
  reason: "Uncommitted changes detected" 
}
Workflow engine: runs injected step (agent commits)
Injected step completes → finish() proceeds
```

The difference: the agent never experiences a failure. The commit step is seamlessly woven into execution.

## Advantages

1. **No more "guard lecturing"** — Agents don't see blocked responses with instructions. They see additional workflow steps.

2. **Composable** — Multiple listeners can inject steps. A session_finishing event might trigger both CommitListener (inject commit step) and VerifyListener (inject verify step). The workflow engine sequences them.

3. **Observable** — All injected steps appear in the workflow trace. We can see exactly which listeners fired and what they injected. Currently, guard blocks are invisible to the workflow system.

4. **Testable** — Listeners are pure functions: event in → injection out. Much easier to unit test than guards that need full tool call contexts.

5. **Data-driven optimization** — We can measure: "VerifyListener injected 34 steps this week, of which 30 found no issues → maybe reduce sensitivity." Currently we can't easily measure guard impact.

## Open Questions

1. **How does the implicit workflow interact with explicit workflows?** If an agent inside verify-wrap triggers session_finishing, the VerifyListener should be suppressed (verify-wrap already handles this). Listener context needs `workflowContext`.

2. **Performance of step injection** — Each injected step potentially starts a new agent session. This has real cost (tokens, time). Need a "materiality threshold" — CommitListener shouldn't inject a step for 1 uncommitted whitespace change.

3. **Ordering of injected steps** — If CommitListener and VerifyListener both trigger, which runs first? Verify should run before Commit (verify might find issues requiring more changes). Need a priority system.

4. **Can listeners inject non-agent steps?** E.g., CommitListener could just run `git add && git commit` directly without spawning an agent. This would be a "lightweight injection" — a function call rather than an agent session.

5. **How do we prevent injection loops?** If VerifyListener injects a verification step, and that step also triggers session_finishing, does VerifyListener fire again? Need a `depth` or `injectedBy` field to prevent recursion.

## Implementation Sketch

```typescript
// New file: src/lib/workflow-listeners.ts

export interface ListenerContext {
  /** Current workflow name (or 'session' for implicit) */
  workflow: string;
  /** Current agent name */
  agent: string;
  /** Depth of workflow nesting */
  depth: number;
  /** Listeners that already injected steps in this sequence */
  injectedBy: Set<string>;
  /** Session messages for context */
  messages: Array<{ role: string; content: unknown }>;
}

export interface WorkflowListener {
  name: string;
  /** 
   * Priority: lower numbers run first.
   * Safety: 0-99, Quality: 100-199, Housekeeping: 200+
   */
  priority: number;
  events: string[];
  handle(
    event: WorkflowEvent, 
    ctx: ListenerContext
  ): Promise<StepInjection | BlockResult | undefined>;
}

// In workflow-tool.ts, before returning from a workflow:
async function processListeners(
  event: WorkflowEvent,
  listeners: WorkflowListener[],
  ctx: ListenerContext
): Promise<StepInjection[]> {
  const injections: StepInjection[] = [];
  const sorted = listeners
    .filter(l => l.events.includes(event.type))
    .sort((a, b) => a.priority - b.priority);
  
  for (const listener of sorted) {
    // Skip if this listener already injected (prevent loops)
    if (ctx.injectedBy.has(listener.name)) continue;
    
    const result = await listener.handle(event, ctx);
    if (result?.type === 'block') {
      throw new Error(`Blocked by ${listener.name}: ${result.reason}`);
    }
    if (result?.type === 'inject') {
      injections.push(result);
      ctx.injectedBy.add(listener.name);
    }
  }
  return injections;
}
```

## Relationship to Existing Design

This proposal is **not** a complete rewrite. It:
- **Keeps** Phase 1 (`redirect` and `steer` on BeforeToolCallResult) — these are already shipped
- **Keeps** safety guards as beforeToolCall hooks — they need synchronous blocking
- **Replaces** Phase 2 of DESIGN-workflow-guard-integration (auto-wrap, guard retirement)
- **Extends** the workflow engine with listener + step injection support
- **Adds** the implicit workflow concept for non-workflow sessions

The actual code change is primarily in `workflow-tool.ts` (add listener support) and migrating 4 guards (finish, commit, completeness, verification-depth) to listeners.

## Decision Needed

This design needs Hao's review before implementation. Specific questions:

1. Is the implicit workflow concept right, or should we only support listeners in explicit workflows?
2. Should safety guards also become listeners (with `block` capability), or keep them as separate beforeToolCall hooks?
3. Is step injection the right metaphor, or should listeners inject *messages* (like steer does) rather than *steps*?

---

*"The best guard is one the agent never notices." — design goal*
