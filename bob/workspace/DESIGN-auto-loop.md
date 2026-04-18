# DESIGN: Auto-Loop Controller for Multi-Cycle Research Tasks

**Author**: Bob  
**Date**: 2026-04-08  
**Status**: Proposal  

---

## TL;DR

**Option C + workflows as building blocks.** Use workspace state files as the loop driver, with each heartbeat (or explicit invocation) as one cycle. Workflows handle individual cycle execution. No new runtime primitives needed.

The key insight: **our heartbeat IS already an auto-loop**. What's missing isn't looping machinery — it's structured state derivation and dispatch.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTO-LOOP STATE FILE                     │
│  agents/<agent>/workspace/auto-loop/<task-id>.yaml          │
│                                                              │
│  task: "Research hypothesis H-089 across 5 experiments"      │
│  phase: "execute"          # derive | plan | execute | eval  │
│  cycle: 3                                                    │
│  maxCycles: 5                                                │
│  status: "active"          # active | paused | done | stuck  │
│  stuckCount: 0                                               │
│  created: 2026-04-08T12:00:00Z                               │
│  lastCycleAt: 2026-04-08T14:30:00Z                           │
│                                                              │
│  plan:                                                       │
│    - cycle1: "Gather baseline data" ✅                       │
│    - cycle2: "Run EXP-090" ✅                                │
│    - cycle3: "Run EXP-091" ⏳                                │
│    - cycle4: "Analyze results"                               │
│    - cycle5: "Write synthesis"                               │
│                                                              │
│  history:                                                    │
│    - {cycle: 1, phase: execute, result: "gathered 5 DDs",    │
│       files: ["KE-061.md"], duration: "4m"}                  │
│    - {cycle: 2, phase: execute, result: "EXP-090 complete",  │
│       files: ["EXP-090.md"], duration: "6m"}                 │
│                                                              │
│  context:                   # carried forward each cycle     │
│    keyFindings: [...]                                        │
│    openQuestions: [...]                                       │
│    blockers: []                                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  DERIVE      │ │  DISPATCH    │ │  FINALIZE    │
     │  Read state  │ │  Pick action │ │  Update state│
     │  file, check │ │  based on    │ │  file, bump  │
     │  what phase  │ │  phase →     │ │  cycle, check│
     │  we're in    │ │  workflow    │ │  completion  │
     └──────────────┘ └──────────────┘ └──────────────┘
```

### The Cycle (runs once per invocation)

```
1. DERIVE   — Read auto-loop/<task-id>.yaml → determine current phase
2. DISPATCH — Map phase to action:
               plan     → agent session: read context, produce plan
               execute  → workflow or agent session: do the work
               evaluate → agent session: assess progress, update plan
               done     → return summary
               stuck    → escalate or try different approach
3. FINALIZE — Write results back to state file, bump cycle counter
4. EXIT     — Return control (heartbeat continues, or caller proceeds)
```

---

## What We Borrow from GSD-2

| GSD-2 Pattern | Borrow? | How |
|---|---|---|
| **State derivation** | ✅ YES | Read YAML state file at cycle start — not hardcoded |
| **Dispatch table** | ✅ YES | Simple phase → action mapping (see below) |
| **Stuck detection** | ✅ YES | If same phase repeats 2+ cycles with no progress → stuck |
| **Budget tracking** | ⚠️ PARTIAL | Track cycle count only. No token/cost budgets (per Hao directive: opBudget removed) |
| **Parallel milestones** | ❌ SKIP | Overkill. We're single-agent per loop. Parallel = fork separate auto-loops |
| **Git isolation** | ❌ SKIP | Our workspace dirs already provide isolation. Git branches add complexity for research tasks |

---

## Dispatch Table

```typescript
const DISPATCH: Record<string, (ctx, state) => Promise<CycleResult>> = {
  // Phase 1: Create or refine the plan
  plan: async (ctx, state) => {
    const result = await ctx.runAgent(state.agent, 
      `Create a ${state.maxCycles}-cycle plan for: ${state.task}\n` +
      `Context so far: ${JSON.stringify(state.context)}`
    );
    return { nextPhase: "execute", planUpdate: extractPlan(result) };
  },

  // Phase 2: Execute the current cycle's work item
  execute: async (ctx, state) => {
    const currentItem = state.plan[state.cycle - 1];
    const result = await ctx.runAgent(state.agent, 
      `Execute this step: ${currentItem}\n` +
      `History: ${summarizeHistory(state.history)}\n` +
      `Context: ${JSON.stringify(state.context)}`
    );
    // OR use a workflow:
    // const result = await ctx.runWorkflow("deliver-or-report", currentItem);
    return { nextPhase: "evaluate", cycleResult: summarize(result) };
  },

  // Phase 3: Evaluate progress, decide next move
  evaluate: async (ctx, state) => {
    const result = await ctx.runAgent(state.agent,
      `Evaluate progress on: ${state.task}\n` +
      `Completed: ${state.cycle}/${state.maxCycles} cycles\n` +
      `History: ${JSON.stringify(state.history)}\n` +
      `Decide: (a) continue to next cycle, (b) revise plan, (c) declare done early`
    );
    const decision = extractDecision(result);
    if (decision === "done") return { nextPhase: "done" };
    if (decision === "revise") return { nextPhase: "plan" };
    return { nextPhase: "execute", bumpCycle: true };
  },
};
```

---

## Integration: Two Modes

### Mode A: Heartbeat-Driven (for research tasks)

The agent's heartbeat reads `auto-loop/*.yaml` and runs one cycle per heartbeat:

```
# In heartbeat or work session:
1. ls agents/bob/workspace/auto-loop/
2. For each active .yaml file:
   a. Read state
   b. If status == "active", run one cycle
   c. Write updated state
3. Continue with other heartbeat tasks
```

**Advantage**: Zero new infrastructure. Leverages existing cron + session model.  
**Disadvantage**: One cycle per heartbeat interval (5-15 min gaps between cycles).

### Mode B: Workflow-Driven (for focused multi-cycle tasks)

A new `auto-loop` workflow runs all cycles in sequence:

```typescript
// agents/shared/workflows/auto-loop.ts
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const state = loadState(ctx.task);  // task = path to .yaml
  
  while (state.status === "active" && state.cycle <= state.maxCycles) {
    const handler = DISPATCH[state.phase];
    const result = await handler(ctx, state);
    
    updateState(state, result);
    saveState(state);
    
    // Stuck detection
    if (isStuck(state)) {
      state.status = "stuck";
      return ctx.escalate(`Auto-loop stuck at cycle ${state.cycle}, phase ${state.phase}`, state);
    }
  }
  
  return ctx.done(formatSummary(state));
}
```

**Advantage**: Runs to completion in one invocation. Good for focused tasks.  
**Disadvantage**: Burns the session budget on one task. Best for 3-5 cycle loops.

### Mode C: Agent `call` (for dispatching deep work)

An agent creates the state file and calls another agent or workflow to run it:

```
agents.fork("bob", "Run auto-loop: agents/bob/workspace/auto-loop/h089-research.yaml")
```

---

## Concrete Example: "Research H-089 Across 5 Experiments"

### Cycle 1 — Plan
```
Phase: plan
Action: Bob reads H-089, existing experiments, knowledge base
Output: 5-cycle plan written to state file
  1. Survey existing evidence (DDs, KEs) 
  2. Design & run EXP-090 (test prediction P1)
  3. Design & run EXP-091 (test prediction P2)
  4. Analyze results, update hypothesis
  5. Write synthesis entry KE-065
```

### Cycle 2 — Execute + Evaluate
```
Phase: execute → evaluate
Action: Bob gathers existing evidence, writes survey notes
Evaluate: "Good progress, found 3 relevant DDs. Continue."
State: cycle=2, phase=execute, context updated with findings
```

### Cycle 3 — Execute + Evaluate
```
Phase: execute → evaluate  
Action: Bob designs EXP-090, runs it, records results
Evaluate: "EXP-090 confirms P1. Continue to P2."
State: cycle=3, phase=execute
```

### Cycle 4 — Execute + Evaluate
```
Phase: execute → evaluate
Action: Bob designs EXP-091, runs it
Evaluate: "EXP-091 DISCONFIRMS P2. Revise plan — skip synthesis, add revision cycle."
State: cycle=4, phase=plan (revision triggered)
```

### Cycle 5 — Plan (revision) → Execute
```
Phase: plan → execute
Action: Bob revises H-089 with new evidence, writes updated hypothesis
Evaluate: "Hypothesis revised. Done."
State: cycle=5, status=done
```

---

## Stuck Detection

Simple heuristic, no ML needed:

```typescript
function isStuck(state: AutoLoopState): boolean {
  const recent = state.history.slice(-2);
  if (recent.length < 2) return false;
  
  // Same phase repeated with no new files produced
  const samePhase = recent[0].phase === recent[1].phase;
  const noNewFiles = recent[1].files.length === 0;
  
  // Increment stuck counter
  if (samePhase && noNewFiles) {
    state.stuckCount++;
  } else {
    state.stuckCount = 0;
  }
  
  return state.stuckCount >= 2;
}
```

When stuck: escalate to caller with full state. Caller (or human) can:
- Manually edit the state file to change phase/plan
- Set `status: "paused"` to stop the loop
- Provide new context in the `context.blockers` field

---

## What We DON'T Need

1. **Token/cost budgets per cycle** — Hao removed opBudget. Cost control is at model/session level.
2. **Parallel workers / worktrees** — Research tasks are serial. Parallelize by running separate auto-loops for independent tasks.
3. **Git branches per cycle** — The state file + workspace files provide sufficient history. `git diff` works if needed.
4. **Complex state machines** — Four phases (plan/execute/evaluate/done) + stuck detection covers 95% of cases.
5. **Custom DSL** — YAML state files are human-readable AND agent-readable. No new syntax to learn.
6. **New runtime primitives** — `ctx.runAgent()` and `ctx.runWorkflow()` already do everything we need. The loop is just a `while` around them.

---

## Implementation Plan

| Step | What | Effort |
|---|---|---|
| 1 | Define YAML schema for auto-loop state files | ~30 min |
| 2 | Write `auto-loop.ts` workflow (Mode B) | ~2 hours |
| 3 | Add heartbeat integration (Mode A) — read state files, run one cycle | ~1 hour |
| 4 | Test with one real research task (H-089 or similar) | ~1 session |
| 5 | Add stuck detection + escalation | ~30 min |

**Total: ~4 hours of agent time, 0 infrastructure changes.**

---

## Why This Works

The auto-loop controller is **just structured state + a dispatch table + existing workflows**. It works because:

1. **State files are the loop** — readable by agents AND humans, editable by both, survives crashes
2. **Workflows are the cycle body** — `deliver-or-report`, `implement-and-verify`, or plain `runAgent` calls
3. **Heartbeats are the scheduler** — already running on cron, already read workspace files
4. **Stuck detection is simple** — same-phase-no-progress heuristic catches >90% of loops

The GSD-2 insight is right: derive state from filesystem, not hardcoded. But we don't need their complexity. Our existing infrastructure already provides the building blocks — we just need to connect them with a state file convention.
