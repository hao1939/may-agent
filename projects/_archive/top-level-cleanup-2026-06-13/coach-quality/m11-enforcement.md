# M11: Enforcement Mechanism — Architecture Research & Implementation

**Date**: 2025-06-30
**Milestone**: M11 (Coach Quality Project)

## Root Cause Analysis

The scaffold in `context.md` has **0% compliance** across 6+ iterations because:

1. **context.md is passive** — it's loaded as system context but doesn't gate execution
2. **The heartbeat workflow controls behavior** — `coach-heartbeat.ts` calls `genericHeartbeat()` from `shared/workflows/heartbeat-data.ts`, which constructs a prompt and runs a single LLM session
3. **Single-session = no gate** — the agent sees the GOAL/PLAN instruction in context.md but immediately gets the heartbeat prompt with metrics/projects/inbox, which dominates attention

## Architecture Findings

### How the coach runs
```
coach-heartbeat.ts 
  → genericHeartbeat(ctx, "coach")
    → loads metrics, projects, alerts, inbox, heartbeat.md
    → constructs ONE prompt
    → ctx.runAgent("coach", prompt)  ← single LLM session, no planning gate
```

### Available enforcement mechanisms

| Mechanism | How | Effectiveness |
|-----------|-----|---------------|
| context.md text | Passive instruction | 0% (proven) |
| heartbeat.md text | Passive instruction in prompt | ~0% (same problem) |
| **2-phase workflow** | Separate LLM sessions: plan → execute | **High** (proven by growth-cycle.ts) |
| **Custom heartbeat workflow** | Override genericHeartbeat with planning step | **High** |
| Pre-session hook | Not available in runtime | N/A |

### Proven pattern: growth-cycle.ts
The `growth-cycle.ts` workflow already enforces structured work:
- Step 1: Diagnose (LLM session 1)
- Step 2: Fork & patch (LLM session 2)  
- Step 3: Test (pure JS)
- Step 4: Decide (pure JS)

Each step gets its own `ctx.runAgent()` call with focused instructions. This is the only pattern in the codebase that reliably gates behavior.

## Implementation: 2-Phase Coach Heartbeat

**File modified**: `agents/coach/workflows/coach-heartbeat.ts`

**Change**: Replace single-session `genericHeartbeat()` call with a 2-phase workflow:
- **Phase 1 (Triage)**: Load all context, ask coach to output ONLY a plan (no tool calls allowed in prompt). Short session.
- **Phase 2 (Execute)**: Take the plan from Phase 1, inject it as the session's mandate, then execute.

This mirrors the growth-cycle pattern and uses **session boundaries** as the enforcement mechanism (per KE-180 recommendation: "2-phase with session boundary").

### Key design decisions
1. Phase 1 prompt explicitly says "Do NOT use any tools. Output ONLY your plan."
2. Phase 2 prompt includes the plan and says "Execute this plan. Call finish() with verification_evidence."
3. Falls back to single-session for idle heartbeats (no red metrics, no projects, no inbox) to save LLM cost.
4. Adds ~1 extra LLM session per substantive heartbeat (acceptable cost for quality improvement).

## Limitations
- This only covers heartbeats. Work dispatched via `agents.call` or `agents.fork` still uses single sessions.
- The Phase 1 plan quality depends on the coach's judgment — garbage plan → garbage execution.
- Extra LLM cost (~$0.01-0.05 per heartbeat for the planning session).

## Next Steps
- M12: Run gym scenarios to measure compliance rate with 2-phase heartbeat
- M13: If effective, propose extending pattern to other agents via shared workflow
