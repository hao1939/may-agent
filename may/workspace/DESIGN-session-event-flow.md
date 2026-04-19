# Design: Session Execution as Event Flow with Guard-Triggered Workflows

**Status**: RFC Draft  
**Author**: May  
**Date**: 2025-07-12

## The Idea

Instead of guards being "gatekeepers" that block tool calls and return error text, they become **sensors** that produce events. When a guard event fires, the session execution flow can **transfer to a guard-suggested workflow** — or the agent can be asked to decide what to do. The session itself becomes an event stream where guard triggers are first-class participants.

## Current Architecture: What We Have

### Execution Model
```
User/Cron/Message → Manager.run() → Agent.prompt() → agentLoop()
                                                         ↓
                                              emit AgentEvents:
                                                turn_start
                                                message_update (text_delta)
                                                tool_execution_start
                                                tool_execution_end
                                                message_end
                                                turn_end
                                                agent_end
```

### Guard Execution Point
Guards run inside `wrapToolsWithReceipts()` — they intercept individual tool calls:
```
Agent wants to call finish() → wrapToolsWithReceipts checks beforeToolCall →
  composeGuards runs 11 guards in sequence →
    if any returns { block: true, reason: "..." } →
      tool call is replaced with error text tool_output
    else →
      tool executes normally
```

### What Guards Can Do Today
- `{ block: true, reason: "..." }` — Replace tool result with error text
- `{ block: false, reason: "..." }` — Append a warning to tool output
- `undefined` — Allow the call

That's it. Three options, all operating at the tool-call level.

### Problems
1. **No execution flow control** — A guard can't say "stop what you're doing and run the verify-wrap workflow"
2. **No agent decision-making** — A guard can't say "ask the agent whether it wants to address this before proceeding"
3. **Binary block/allow** — No middle ground between "hard stop this tool" and "let it through"
4. **Text-in-error-channel** — Guard guidance arrives as tool error text, not as a structured event the agent's reasoning can process differently
5. **Hardcoded composition** — 11 guards wired in `composeGuards()`, can't add/remove per agent/session dynamically

## Proposed Architecture: Guards as Event-Producing Sensors

### Core Concept: The Guard Event

Instead of returning `{ block, reason }`, guards return a richer structure:

```typescript
interface GuardEvent {
  /** Unique guard identifier */
  guard: string;
  
  /** How urgent is this? */
  severity: "info" | "warning" | "critical";
  
  /** What happened */
  observation: string;
  
  /** What the guard recommends */
  recommendation: GuardRecommendation;
}

type GuardRecommendation =
  | { type: "allow" }                                    // proceed normally
  | { type: "warn"; message: string }                    // warn but allow
  | { type: "block"; reason: string }                    // hard block (existing behavior)
  | { type: "redirect"; workflow: string; task: string } // transfer to a workflow
  | { type: "ask"; question: string; options: string[] } // ask agent to decide
  | { type: "steer"; message: string }                   // inject a steering message
```

### Execution Flow with Guard Events

```
Agent wants to call finish() → Guard Pipeline runs →
  finish-guard detects no verification → returns:
    {
      guard: "finish-guard",
      severity: "warning",
      observation: "Agent claims success but has no verification evidence",
      recommendation: {
        type: "redirect",
        workflow: "verify-wrap",
        task: "Verify the changes made in this session before finishing"
      }
    }
  
  → Session Event Router receives GuardEvent →
    CASE "redirect":
      1. Block the current tool call (return error explaining why)
      2. Inject a steering message: "A guard has detected an issue and is
         redirecting you to the verify-wrap workflow. Run: workflow('verify-wrap', '...')"
      3. OR: directly invoke the workflow via the session's workflow executor
    
    CASE "ask":
      1. Block the current tool call
      2. Inject: "⚠️ Guard question: {question}. Options: {options}. 
         Please decide how to proceed."
    
    CASE "steer":
      1. Allow the tool call to proceed
      2. Queue a steer() message for after this turn
```

### Where This Hooks In: The Session Event Router

The key new component sits between the guard pipeline and the agent:

```typescript
class SessionEventRouter {
  private agent: Agent;
  private workflowExecutor: WorkflowContext;
  
  async handleGuardEvent(event: GuardEvent, toolCall: ToolCall): Promise<GuardAction> {
    switch (event.recommendation.type) {
      case "allow":
        return { action: "proceed" };
        
      case "warn":
        return { action: "proceed", appendWarning: event.recommendation.message };
        
      case "block":
        return { action: "block", reason: event.recommendation.reason };
        
      case "redirect":
        // Block the tool call AND redirect to workflow
        return {
          action: "block_and_redirect",
          blockReason: `Guard "${event.guard}" is redirecting to workflow "${event.recommendation.workflow}": ${event.observation}`,
          redirect: {
            workflow: event.recommendation.workflow,
            task: event.recommendation.task,
          }
        };
        
      case "ask":
        // Block the tool call and ask the agent
        return {
          action: "block_and_ask",
          blockReason: event.recommendation.question,
        };
        
      case "steer":
        // Allow the call but inject a steering message
        this.agent.steer({
          role: "user",
          content: `[guard:${event.guard}] ${event.recommendation.message}`,
        });
        return { action: "proceed" };
    }
  }
}
```

### Implementation Approach: Minimal Changes

The beauty of this design is that it can be implemented **incrementally** on top of what exists:

#### Phase 1: Richer Guard Returns (no core changes needed)

Extend `BeforeToolCallResult` locally (we already define it locally in `compose-guards.ts`):

```typescript
interface BeforeToolCallResult {
  block: boolean;
  reason: string;
  // NEW: optional structured recommendation
  redirect?: { workflow: string; task: string };
  steer?: string;
  severity?: "info" | "warning" | "critical";
}
```

In `wrapToolsWithReceipts`, when a guard returns `redirect`:

```typescript
if (guardResult?.block && guardResult.redirect) {
  // Block the call AND inject a workflow redirect
  const session = getSession();
  if (session) {
    session.agent.steer({
      role: "user",
      content: [{ type: "text", text:
        `⚠️ Guard blocked your ${tool.name} call: ${guardResult.reason}\n\n` +
        `Recommended action: Run workflow("${guardResult.redirect.workflow}", "${guardResult.redirect.task}")`
      }],
    });
  }
}
```

This is ~20 lines of code change. The agent still decides whether to follow the recommendation — it's not forced. But the guidance arrives as a steering message, not buried in tool error output.

#### Phase 2: Direct Workflow Execution (medium lift)

Instead of asking the agent to run a workflow, the guard system executes it directly:

```typescript
if (guardResult?.redirect) {
  // Block the call, run the workflow, inject results
  const session = getSession();
  if (session) {
    const workflowResult = await runWorkflow(
      guardResult.redirect.workflow,
      guardResult.redirect.task,
      session
    );
    session.agent.steer({
      role: "user",
      content: `[guard-workflow] ${guardResult.redirect.workflow} completed: ${workflowResult.summary}`,
    });
  }
}
```

This is more powerful but riskier — workflows execute outside the agent's control. Good for mechanical checks (verify-wrap), bad for judgment calls.

#### Phase 3: Event Bus Integration

Guard events flow through the EventBus, making them observable/subscribable:

```typescript
// In wrapToolsWithReceipts
if (guardResult) {
  bus?.emit({
    type: "guard_event",
    sessionId,
    agent: agentName,
    guard: guardResult.guard ?? "unknown",
    severity: guardResult.severity ?? "warning",
    toolName: tool.name,
    blocked: guardResult.block,
    recommendation: guardResult.redirect ?? guardResult.steer ?? null,
  });
}
```

This enables:
- **May** subscribing to guard events across all sessions for monitoring
- **Per-agent guard policies** loaded from agent.json
- **Guard analytics** — which guards fire most, which redirects succeed
- **External systems** reacting to guard events (Slack notifications, dashboards)

## Concrete Example: Finish Guard → Verify-Wrap Redirect

Today (current):
```
Agent: finish({ status: "success", summary: "Fixed the bug" })
  → finish-guard: "No verification evidence. Block."
  → Agent sees error: "🚫 FINISH_GUARD_BLOCK: ..."
  → Agent (maybe) runs tests, (maybe) calls finish again
  → Agent (maybe) just rephrases summary to bypass guard
```

Proposed:
```
Agent: finish({ status: "success", summary: "Fixed the bug" })
  → finish-guard detects no verification
  → Returns: { block: true, reason: "...", redirect: { workflow: "verify-wrap", task: "Verify fix" } }
  → wrapToolsWithReceipts:
      1. Blocks the finish call (returns error text)
      2. Calls agent.steer() with redirect guidance
  → Agent receives steering: "Guard recommends verify-wrap workflow"
  → Agent runs workflow("verify-wrap", "Verify the bug fix")
  → Workflow runs tests, checks output
  → Agent gets verification results
  → Agent calls finish() again with real evidence
  → finish-guard: allow (evidence present)
```

The key difference: **the agent isn't just told "you can't do this"** — it's told **"here's what to do instead."** The execution flow is redirected, not just blocked.

## Guard-as-Sensor Taxonomy

| Guard | Today | Proposed |
|-------|-------|----------|
| finish-guard | Block + error text | Redirect → verify-wrap |
| completeness-guard | Block + error text | Ask: "Did you mean to finish without completing X?" |
| commit-guard | Block + error text | Redirect → safe-commit workflow |
| read-dedup-guard | Block after N reads | Steer: "You've read this file N times. Consider caching the content." |
| verification-depth-guard | Block premature finish | Redirect → verify-wrap |
| path-hallucination-guard | Block bad paths | Steer: "Path doesn't exist. Did you mean {closest_match}?" |
| session-read-guard | Block cross-session reads | Steer: "Use agents('peek', ...) instead" |
| empty-args-guard | Block | Block (no redirect needed) |
| tool-schema-guard | Block | Block (no redirect needed) |
| scrape-dedup-guard | Block | Steer: "Already scraped, use cached content" |

## What About the Agent Deciding?

Your question about "ask agents to decide" is critical. Some guards shouldn't auto-redirect — they should present the situation and let the agent choose:

```typescript
recommendation: {
  type: "ask",
  question: "You're about to finish but haven't verified your changes. What would you like to do?",
  options: [
    "Run verify-wrap workflow",
    "Add verification evidence manually",
    "Finish anyway (I'm confident)",
  ]
}
```

This would block the tool call and inject the question as a steering message. The agent responds in its next turn. This preserves agent autonomy while ensuring the guard's concern is surfaced prominently.

However, this has a risk: **agents are very good at rationalizing their way past questions.** If given the option "finish anyway (I'm confident)", many will take it. So the "ask" pattern should be used sparingly — mostly for judgment calls where the guard genuinely can't determine the right action.

## Interaction with Workflows

The redirect mechanism creates a natural bridge between guards and workflows:

```
Guard detects issue → Recommends workflow → Agent runs workflow → Workflow resolves issue → Agent continues
```

This means we can build **guard-workflow pairs**:
- `finish-guard` ↔ `verify-wrap`
- `commit-guard` ↔ `safe-commit`
- `completeness-guard` ↔ `investigate-and-fix` (to find missing pieces)

These pairs can be configured per agent:

```json
// agent.json
{
  "guardPolicies": {
    "finish-guard": {
      "action": "redirect",
      "workflow": "verify-wrap"
    },
    "commit-guard": {
      "action": "ask"
    }
  }
}
```

## Implementation Priority

1. **Phase 1** (small, high impact): Add `redirect` and `steer` fields to `BeforeToolCallResult`. Add steer() call in `wrapToolsWithReceipts` when redirect is present. Update finish-guard to return redirect. ~50 LoC.

2. **Phase 2** (medium): Add `guard_event` to EventBus. Wire guard results to bus in wrapToolsWithReceipts. ~30 LoC.

3. **Phase 3** (larger): Per-agent guard policies in agent.json. Guard registry instead of hardcoded composeGuards. ~200 LoC.

4. **Phase 4** (future): Direct workflow execution from guard pipeline. Needs careful design around cancellation/timeouts.

## Open Questions

1. **Can steer() be called from inside beforeToolCall?** — The guard runs inside the tool execution wrapper. Calling `session.agent.steer()` from there should work since steer() just queues a message for after the current turn. But this needs testing — if the agent is mid-tool-execution, does the steer arrive at the right time?

2. **Should redirects be mandatory or suggested?** — If the guard says "redirect to verify-wrap", does the agent HAVE to run it? Current thinking: suggested via steer(). The agent can ignore it, but the guard will fire again next time they try to finish without verification.

3. **Guard event ordering** — If multiple guards fire on the same tool call, which redirect wins? Proposal: first redirect wins, others are logged as events.

4. **Workflow execution context** — If a guard triggers a workflow, does that workflow run in the same session (sharing transcript context) or in a child session? Same session is more natural; child session is cleaner isolation.

5. **Feedback loop** — How does a redirected workflow's result feed back into the guard's next evaluation? E.g., if verify-wrap finds the changes are correct, the finish-guard should allow the next finish() attempt. This happens naturally if verify-wrap adds verification evidence to the transcript.

## Relationship to pi-agent-core

The `beforeToolCall` / `afterToolCall` hooks are the only extension points pi-agent-core provides for tool-call interception. Our local `BeforeToolCallResult` extension (adding `redirect`, `steer`) doesn't require any core changes — we define it locally in `compose-guards.ts` and use it in `wrapToolsWithReceipts`.

The `Agent.steer()` method is the key enabler — it's the sanctioned way to inject messages into a running agent's flow. Calling it from within the beforeToolCall pipeline is the mechanism that makes guard-to-execution-flow transfer possible.

Long-term, if this pattern proves valuable, it could be proposed upstream as a richer `BeforeToolCallResult` in pi-agent-core itself.
