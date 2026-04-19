# Brainstorm: Guards as Environmental Boundaries

**Date**: 2026-04-14  
**Trigger**: Hao's critique — "Why config on agent? The guard should be env/system boundary. The agent may or may not be aware. When hit, it's auto triggered and the agent may react."

## The Wrong Frame (my previous design)

My earlier design (DESIGN-event-driven-guards.md) treated guards as **per-agent policy toggles**:
```json
// agents/bob/agent.json — WRONG THINKING
{ "guards": { "commit": true, "verification-depth": false } }
```

This is wrong because:
1. It puts the agent in control of its own constraints — like letting a prisoner choose which bars apply
2. It creates an N×M configuration problem (N agents × M guards)
3. It confuses **who the guards serve** — they serve the system, not the agent

## The Right Frame: Guards as Environmental Physics

Guards are like **gravity, walls, and locked doors**. You don't configure gravity per person. Gravity is just there. When you jump, it pulls you back. You can work with it or fight it, but you can't opt out.

### Taxonomy of Environmental Boundaries

| Type | Analogy | Current guards | Trigger |
|------|---------|---------------|---------|
| **Physics** | Gravity — impossible to violate | `empty-args-guard`, `tool-schema-guard`, `path-hallucination-guard` | Malformed tool call → instant rejection |
| **Walls** | Walls — can't walk through them | `cross-edit-guard`, `session-read-guard` | Action violates spatial boundary → blocked |
| **Doors** | Locked door — need a key to pass | `commit-guard`, `finish-guard`, `completeness-guard`, `verification-depth-guard` | Attempting exit without meeting conditions → blocked + told what's needed |
| **Friction** | Muddy ground — slows you down | `read-dedup-guard`, `scrape-dedup-guard` | Repetitive action → warning then block |

Key insight: **NONE of these need per-agent configuration.** They're properties of the environment, not the agent.

### But what about Bob's verification-depth exemption?

Currently `verification-depth-guard` has `exemptAgents: ["bob"]`. Under the environment model, this is wrong. The right framing is:

**Option A**: The boundary doesn't apply because Bob's environment is different — he has a different exit (his deliver-or-report workflow IS his verification). The guard should detect this rather than hardcode an exemption.

**Option B**: The boundary has a second valid "key" — workflow-level verification. The guard should accept both transcript-level AND workflow-level verification as valid evidence.

**Option C**: The boundary is poorly defined. If one agent legitimately doesn't need it, maybe the boundary itself is too narrow. Make the guard smarter, not more configurable.

All three options are better than `exemptAgents: ["bob"]`.

## Rethinking the Architecture

### Current: Guards in a pipeline, configured in code

```
Agent → tool_call → [guard1, guard2, ..., guard11] → tool execution
                     ↑ hardcoded list, agent-specific exemptions
```

### Proposed: Guards as environment layers that emit events

```
┌─────────────────────────────────────────────────────────┐
│  ENVIRONMENT                                             │
│                                                          │
│  ┌─── Physics Layer ────────────────────────────────┐   │
│  │  Invalid args? → reject (not even an event)      │   │
│  │  Impossible path? → reject                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Boundary Layer ──────────────────────────────┐    │
│  │  Cross-edit? → blocked (emit boundary_hit event) │   │
│  │  Read .jsonl? → blocked (emit boundary_hit event)│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Gate Layer (exit conditions) ────────────────┐    │
│  │  finish() without commit? → blocked + guidance   │   │
│  │  finish() without evidence? → blocked + guidance │   │
│  │  finish() without verification? → blocked + hint │   │
│  │  (emit gate_blocked event)                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Friction Layer ─────────────────────────────┐     │
│  │  Read same file 5x? → warning then block        │   │
│  │  Scrape same URL 3x? → warning then block       │   │
│  │  (emit friction_warning event)                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Agent ──────────────────────────────────────┐     │
│  │  Operates freely within boundaries              │     │
│  │  Hits boundaries → gets feedback → adapts       │     │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### What changes vs my previous design?

1. **No per-agent config** — guards are system-global
2. **Guards emit events** — when a boundary is hit, an event fires. Observers (logging, analytics, adaptive systems) can react.
3. **Guards can have intelligence** — instead of exempting Bob, the verification-depth guard can detect workflow-level verification
4. **The agent doesn't know about guards** — it just gets feedback ("you can't do this" or "you need to do X first")

## What Events Do Guards Emit?

```typescript
type GuardEvent = 
  | { type: "guard_physics_reject"; guard: string; tool: string; reason: string; sessionId: string; agent: string }
  | { type: "guard_boundary_block"; guard: string; tool: string; reason: string; sessionId: string; agent: string }  
  | { type: "guard_gate_block"; guard: string; tool: string; reason: string; sessionId: string; agent: string;
      guidance?: string;  // what the agent needs to do to pass
    }
  | { type: "guard_friction_warn"; guard: string; tool: string; reason: string; sessionId: string; agent: string; count: number }
  | { type: "guard_friction_block"; guard: string; tool: string; reason: string; sessionId: string; agent: string; count: number }
```

### What observers do with these events?

1. **Logging/analytics** — track which guards fire most, which agents hit boundaries, detect patterns
2. **Adaptive steering** — if an agent hits the same gate 3 times, inject a stronger steer (this is what Phase 1's redirect was about, but event-driven)
3. **System health** — if a guard suddenly fires 10x more than usual, something changed
4. **Learning** — guards that fire very rarely might be unnecessary; guards that fire constantly might need better agent training

## On the "Redirect" from Phase 1

The Phase 1 redirect was:
```
guard blocks finish() → injects steer("run verify-wrap workflow")
```

In the environmental model, this becomes:
```
gate blocks finish() → emits guard_gate_block event → 
  observer sees event → observer injects steer if needed
```

The guard itself doesn't steer. It just blocks and says why. A separate **observer** (could be a bus subscriber) decides whether to help the agent. This is cleaner because:
- The guard stays simple — just enforce the boundary
- The response logic is separate — can be tuned independently
- The response can be smarter — look at how many times this agent has been blocked, what it tried, etc.

## Concrete Proposal: What to Actually Build

### Step 1: Guard events (small, immediate value)

Add event emission to the existing guard pipeline. No structural change to how guards work.

```typescript
// In compose-guards.ts or manager-receipts.ts
if (result?.block) {
  bus.emit({ 
    type: "guard_block", 
    guard: guardName,   // need to thread guard identity through
    tool: context.toolCall.name,
    reason: result.reason,
    sessionId, 
    agent: agentName,
    layer: result.layer, // "physics" | "boundary" | "gate" | "friction"
  });
}
```

This gives us observability. We can track guard hits, build dashboards, detect patterns.

### Step 2: Guard response subscribers (replaces Phase 1 redirect)

Instead of guards containing redirect logic, bus subscribers react to guard events:

```typescript
// src/lib/guard-responders.ts
bus.subscribe((event) => {
  if (event.type !== "guard_block") return;
  
  // Gate blocks on finish() → suggest workflow
  if (event.guard === "finish-guard" && event.tool === "finish") {
    const session = manager.getSession(event.sessionId);
    if (session?.agent) {
      session.agent.steer({
        role: "user",
        content: [{ type: "text", text: 
          `Your finish() was blocked: ${event.reason}\n\n` +
          `Suggestion: run the verify-wrap workflow to add verification evidence.`
        }],
        timestamp: Date.now(),
        source: "system",
      });
    }
  }
  
  // Repeated friction blocks → escalate
  if (event.layer === "friction" && event.count >= 5) {
    // Maybe inject a stronger steer, or even inform the parent session
  }
});
```

### Step 3: Make guards smarter (eliminates per-agent exemptions)

Instead of `exemptAgents: ["bob"]`, make verification-depth-guard detect workflow-level verification:

```typescript
// In verification-depth-guard.ts
// Instead of: if (exemptAgents.includes(agentName)) return undefined;
// Do: check if the transcript shows a workflow that includes verification
function hasWorkflowVerification(messages: Message[]): boolean {
  // Look for workflow tool calls that include verify/test steps
  // e.g., verify-wrap, implement-and-review, etc.
  return messages.some(m => 
    isToolCall(m, "workflow") && 
    isVerificationWorkflow(getToolArgs(m))
  );
}
```

### Step 4 (future): Dynamic boundary adjustment

The system (not individual agents) can adjust boundaries based on data:
- "Agents with quality score >90% get friction thresholds doubled" (they read-dedup less aggressively)
- "Night sessions get stricter commit gates" (no human around to catch issues)
- These are SYSTEM decisions, not agent decisions

## Open Questions

1. **Where do guard events flow?** Through the existing EventBus, or a separate guard-specific channel?
   - Leaning: same EventBus. Guards are just another event source. Keep it simple.

2. **How to thread guard identity?** Currently guards are anonymous functions. Need to name them.
   - Could wrap in `{ name: string, check: GuardFn }` objects
   - Or use the existing function names and add a metadata property

3. **Should the redirect/steer from Phase 1 be reverted?**
   - It works and is merged. But it puts steer logic inside the guard (finish-guard.ts has redirect).
   - Could keep it as-is and migrate later, or refactor now.
   - Leaning: keep Phase 1 as-is, build Step 1 (events) on top, migrate redirect logic to a subscriber when ready.

4. **Should guard responses be configurable at the system level?**
   - e.g., "when commit-guard fires, steer with X message"
   - This is system config, not per-agent config. Different from my original wrong design.
   - Could be a `guard-responses.json` or just hardcoded subscribers for now.

5. **What about guards that genuinely can't be universal?**
   - cross-edit-guard exempts "may" — is May's exemption an environmental property (May is the sysadmin, she has root access)?
   - Yes. This isn't per-agent config. It's **role-based access** — a property of the environment, like "admins can open all doors."
   - Model it as: the guard checks the agent's role, not a per-agent exemption list.

## Summary

| Old thinking | New thinking |
|---|---|
| Guards are per-agent policies | Guards are environmental boundaries |
| Agent configures its guards | System defines boundaries, agent operates within them |
| Guard redirects agent | Guard emits event → observer responds |
| `exemptAgents: ["bob"]` | Guard detects workflow-level verification |
| Guard knows about workflows | Guard only knows about boundaries; responders know about workflows |
| N×M config (agents × guards) | M guards, global, with role-based access for special cases |
