# CR#340 — Event-Native Guard-Workflow Architecture: Prior Art & Design Patterns

**Source**: Coach IT-12 (P0) — Hao's directive on event-native guard-workflow architecture  
**Session**: 744 (2026-04-13)  
**Connects**: DD#757 (NeMo Guardrails), DD#758 (SHIELDA), + industry patterns  

---

## Hao's Architecture Vision (verbatim from inputs 2026-04-13)

**Five-Step Pattern**:
1. It's in a workflow
2. Guards trigger on one step of the workflow
3. Optional or mandatory actions are injected into the workflow
4. The agent on the step or the orchestrator agent gets a chance to react to the action (which may be an inner workflow or escalation)
5. The action executes and then returns back to where interrupted and continues

**Key constraint**: "I am not thinking about the guard steering the session — I am thinking above that." This is **workflow-level**, not session-level. Guards operate on workflow steps, not on individual LLM turns.

---

## Prior Art Survey

### 1. NeMo Guardrails / Colang 2.0 (DD#757) — ★★★★★ Direct Predecessor
**Closest existing implementation.** Treats everything as events in a unified stream. Guards ("rails") fire on event patterns and inject alternative flows. Supports input/dialog/output interception points with priority ordering and composable rail chains.

**What it gets right**: Event-native architecture, flow injection, composability.  
**What it misses**: Single-agent only; dialog-level (not workflow-level); no agent negotiation with the guard.

### 2. SHIELDA (DD#758) — ★★★★½ Formal Exception Semantics
**Exception-handling model applied to agent dialog.** Defines typed exceptions (boundary, safety, capability, external), handler flows, and recovery strategies. Uses try/catch/finally semantics.

**What it gets right**: Interrupt-handle-resume pattern, typed responses, handler chaining.  
**What it misses**: Exception-centric (reactive to failures) rather than guard-centric (proactive quality enforcement).

### 3. AgentSentry (2602.22724) — ★★★★ Middleware-Based Guardrails
**Treats guardrails as middleware in an agent execution pipeline.** Each tool call passes through a guardrail middleware chain. Guards can modify, block, or augment the call before it reaches the tool.

**What it gets right**: Middleware chain pattern, per-tool-call interception.  
**What it misses**: Only guards tool calls (not workflow steps); no injection of alternative workflows.

### 4. Temporal.io / Durable Execution (Industry Pattern)
**Workflow-as-event-log.** Each workflow step is a durable event in an append-only log. Activities can be interrupted, retried, or have child workflows spawned. The workflow state machine supports:
- **Signals**: External events injected into running workflow (= guard trigger)
- **Activities**: Units of work that can be retried (= workflow step)
- **Child workflows**: Spawned from a parent workflow, return results (= injected inner workflow)
- **Interceptors**: Middleware that wraps every activity/signal (= guards)

**This is the strongest industrial precedent for Hao's pattern.** Temporal signals + child workflows implement exactly the "inject action → execute → resume" pattern.

### 5. Saga Pattern (Distributed Systems)
**Compensating transactions for long-running workflows.** When a step fails, the saga orchestrator executes compensating actions for all completed steps, then can retry or redirect.

**Relevant for**: The "what happens if the injected action fails?" question. Sagas define rollback semantics that our guard-injection architecture will need.

### 6. Aspect-Oriented Programming (AOP) — Software Engineering Pattern
**Cross-cutting concerns injected at join points.** Guards are aspects; workflow steps are join points; the injection of guard actions is "advice" (before/after/around).

- **Before advice**: Guard checks before step executes (our current model)
- **Around advice**: Guard wraps step execution with pre/post processing + can skip the step entirely
- **After-throwing advice**: Guard fires when step fails (exception handling)

**Hao's model maps to "around advice"**: the guard wraps the workflow step, can inject actions, and the original step resumes after.

---

## Synthesis: Architecture Design Recommendations for Bob & Tech-Lead

### Core Data Model
```
Session = EventStream[Event]

Event = 
  | WorkflowStart(workflow_id, params)
  | StepStart(step_id, step_type, params)
  | ToolCall(tool, args)
  | ToolResult(result)
  | LLMCall(prompt)
  | LLMResult(response)
  | GuardTriggered(guard_id, trigger_event, severity)
  | ActionInjected(action_id, action_type, mandatory: bool)
  | AgentReaction(action_id, decision: accept|modify|escalate)
  | ActionResult(action_id, result)
  | StepResumed(step_id, from_action_id)
  | StepComplete(step_id, result)
  | WorkflowComplete(workflow_id, result)
```

### Guard Lifecycle (Hao's 5 Steps Formalized)

```
1. [StepStart] — normal workflow step begins
2. [GuardTriggered] — guard fires on event pattern match
     └─ guard specifies: action_type, mandatory?, severity
3. [ActionInjected] — action pushed onto execution stack
     └─ could be: inner_workflow, escalation, correction, human_review
4. [AgentReaction] — agent/orchestrator sees the injection and reacts
     └─ for mandatory actions: must execute
     └─ for optional actions: agent can accept, modify, or escalate
5. [ActionResult] → [StepResumed] — action completes, original step resumes
```

### Key Design Decisions Needed

#### D1: Guard Scope — Workflow-Level vs Step-Level
Hao explicitly says "above the session level." Guards should fire on **workflow step transitions**, not on individual tool calls. This means guards observe the workflow graph, not the raw event stream.

*Recommendation*: Two-tier guard system. **Step-level guards** (like current verify/format checks) operate on individual events. **Workflow-level guards** (Hao's new vision) operate on step transitions and can inject entire sub-workflows.

#### D2: Mandatory vs Optional Actions
Hao mentions "optional or mandatory actions." This introduces a **negotiation protocol** between guard and agent:

| Action Type | Agent Autonomy | Example |
|---|---|---|
| Mandatory | Agent must execute; can choose *how* | Safety violation → must address |
| Advisory | Agent can accept, modify, or reject with justification | Style improvement → agent decides |
| Informational | No action required; context provided | FYI: similar pattern seen in previous session |

#### D3: Interrupt Semantics — Stack vs Queue
Two models for handling injected actions:

- **Stack (synchronous)**: Injected action runs immediately, original step pauses. Simple but can cause deep nesting if multiple guards fire.
- **Queue (asynchronous)**: Injected actions queued and executed at next safe interruption point. More flexible but harder to reason about ordering.

*Recommendation*: **Stack for mandatory, queue for advisory.** Mandatory actions interrupt immediately (safety-critical). Advisory actions queue until step completes.

#### D4: Resume Context
After the injected action completes, the original step needs context about what happened. The `StepResumed` event should carry:
- What guard fired and why
- What action was taken
- What the result was
- Whether the step's original parameters need adjustment

#### D5: Guard Composition
Multiple guards may fire on the same step. Need:
- **Priority ordering** (NeMo model)
- **Conflict resolution** (what if guard A says "inject verification" and guard B says "skip this step"?)
- **Guard-of-guards** (what prevents infinite guard loops?)

*Recommendation*: Guards have priority tiers. Higher-tier guards can suppress lower-tier guards. A maximum injection depth prevents recursion (like stack depth limits).

---

## Implementation Feasibility Assessment (for Tech-Lead)

### What Exists That Can Be Reused
1. **Guard infrastructure**: Current guards already fire on step events. Extending them to emit `GuardTriggered` events instead of prepending text is feasible.
2. **Workflow engine**: If our workflow engine supports child/sub-workflows, the injection mechanism is straightforward.
3. **Event logging**: We already log tool calls and results. Extending the event schema adds minimal overhead.

### What's Novel
1. **Agent negotiation with guard actions**: No existing system (including NeMo) implements agent autonomy in responding to guard triggers. This is our unique extension.
2. **Workflow-level guards**: Guards that observe the workflow DAG, not just individual events. Requires guards to have access to workflow state.
3. **Resume semantics**: Pausing a workflow step mid-execution and resuming with context is complex — requires either checkpointing or idempotent steps.

### Suggested Implementation Phases
1. **Phase 1 — Event Schema**: Define the event types. Start logging all session events in the new schema alongside current logging.
2. **Phase 2 — Guard-as-Event-Source**: Modify guards to emit `GuardTriggered` events instead of/in addition to text injection. Guards gain `action_type` and `mandatory` fields.
3. **Phase 3 — Action Injection**: Implement the `ActionInjected → AgentReaction → ActionResult → StepResumed` lifecycle for mandatory actions only.
4. **Phase 4 — Agent Negotiation**: Add the advisory action path where agents can accept/modify/reject guard suggestions.
5. **Phase 5 — Workflow-Level Guards**: Guards that operate on the workflow graph (step transitions) rather than individual events.

---

## Key Takeaway

Hao's vision is well-supported by prior art but extends it in two novel directions:
1. **Agent negotiation**: The agent gets a voice in how to respond to guard triggers (no existing system does this)
2. **Workflow-level scope**: Guards operate on workflow step transitions, not just individual LLM turns (NeMo is turn-level; Temporal is activity-level)

The closest industrial analog is **Temporal.io's signal + child workflow pattern**, and the closest academic analog is **NeMo Guardrails' event-driven rail architecture**. Combining these with SHIELDA's typed exception semantics gives a solid foundation for the design document.

---

*Filed by Scout, Session 744, 2026-04-13. P0 research for Coach IT-12 (Event-Native Guard-Workflow Architecture).*
