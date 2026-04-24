# Technical Analysis: Workflow System Capabilities for Auto-Loop

**Date**: 2026-04-08  
**Requested by**: May (req:56824397)  
**Context**: Hao wants multi-cycle autonomous execution (like GSD-2's auto mode)

---

## 1. Executive Summary

Our workflow system already has **all the primitives** needed for multi-cycle autonomous loops. What's missing is a **top-level orchestrator workflow** that uses them. The gap is ~100 lines of workflow code, not an engine rewrite.

**Key finding**: The engine supports loops, branching, composition, and persistence. Three existing workflows already demonstrate looping patterns. The only thing we don't have is a workflow that chains *multiple heterogeneous tasks* in a goal-directed loop with a "done?" gate.

---

## 2. What the Engine CAN Do Today

### 2.1 Core Primitives (src/lib/workflow.ts + workflow-tool.ts)

| Capability | How | Evidence |
|---|---|---|
| **Sequential multi-agent steps** | `ctx.runAgent(name, task)` — blocks, returns `TaskResult` | Every workflow uses this |
| **Workflow composition** | `ctx.runWorkflow(name, task)` — runs a sub-workflow | Supported, 1 nested run in production (depth cap: 3) |
| **Loops** | Regular JS `for`/`while` in `execute()` | implement-and-verify uses `for (attempt=1..maxAttempts)` |
| **Branching** | Regular JS `if`/`switch` on step results | All workflows branch on `status`, `lastAssistantText`, verdict |
| **Step handoff context** | `ctx.summarize(result)` — structured handoff summary | implement-and-review, deliver-or-report |
| **Persistence** | Every step saved to `WorkflowRun` JSON in `.state/workflows/` | 229 runs persisted |
| **Resume after crash** | `workflow resume` action replays completed steps from archive | Built-in, tested |
| **Steering/interruption** | `steer(message)` injects signal, throws `WorkflowInterrupted` | 3 interrupted runs in production |
| **Pure-JS verification gates** | `execSync()` for shell commands, `existsSync()` for file checks | implement-and-verify, deliver-or-report |
| **Events** | `ctx.emit()` for observability | All workflows emit step_start/step_done |
| **Escalation** | `ctx.escalate(reason)` — bail to supervisor | 93/229 runs escalated (expected — strict quality gates) |

### 2.2 Looping Patterns Already in Production

**implement-and-verify** (shared):
```ts
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  coder = await ctx.runAgent("coder", coderTask);
  verify = runVerification(verifyCommand);
  if (verify.passed) return ctx.done(...);
  lastVerifyOutput = verify.output; // feed error into next iteration
}
return ctx.escalate("failed after N attempts");
```
- Loop with retry, error accumulation, shell verification gate
- Avg 2.2 steps/run (most pass first try)

**implement-and-review** (shared):
```ts
coder → qa → [if fail] → coder-fix → qa-re-review → [if still fail] → escalate
```
- Linear with one retry branch, not a loop — but demonstrates multi-step branching

**test-and-fix** (May):
```ts
test → [if pass] done | [if fail] → fix → [check fix output] → done|escalate
```
- Simple conditional retry

**training-sprint** (Coach):
```ts
plan → fork/patch → for(experiment) { runGym(baseline); runGym(patched) } → promote/discard
```
- Pure-JS loop for gym tests (no LLM), multi-experiment batch processing

### 2.3 What's NOT Used But Available

1. **`runWorkflow` composition**: Only 1 nested workflow run ever. Could compose `implement-and-verify` inside an auto-loop.
2. **Dynamic step count**: All current workflows have statically-bounded steps (max ~5). The engine has no limit — a workflow could run 20 steps.
3. **State accumulation across loop iterations**: implement-and-verify does this minimally (lastVerifyOutput). Could be expanded to full task-queue state.

---

## 3. What's Missing for Auto-Loop

### 3.1 Missing Piece #1: A "Goal-Directed Loop" Workflow

None of the existing workflows implement:
```
while (tasks remain) {
  pick next task → execute task → check if more tasks → repeat
}
```

This is straightforward to build with existing primitives:

```ts
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  let taskQueue = parseTaskList(ctx.task);  // or get from agent
  let completed = [];
  let maxCycles = 10; // safety cap
  
  for (let cycle = 0; cycle < maxCycles && taskQueue.length > 0; cycle++) {
    const currentTask = taskQueue.shift();
    
    // Execute via sub-workflow or direct agent call
    const result = await ctx.runWorkflow("implement-and-verify", currentTask);
    // or: const result = await ctx.runAgent("coder", currentTask);
    
    completed.push({ task: currentTask, result });
    
    // "Done?" gate — can be shell verification, file check, or LLM judgment
    if (allGoalsMet(completed)) break;
    
    // Optionally: have an agent re-plan remaining tasks
    // const replan = await ctx.runAgent("bob", `Remaining: ${taskQueue}. Adjust?`);
    // taskQueue = parseNewPlan(replan);
  }
  
  return ctx.done(formatSummary(completed));
}
```

**Effort**: ~100-150 lines of workflow code. Zero engine changes.

### 3.2 Missing Piece #2: "Done?" Gate Design

The hard question isn't "can we loop?" — it's "how do we decide when to stop?" Options:

| Gate Type | How | Cost | Quality |
|---|---|---|---|
| **Checklist** | Parse task into checklist items, mark off as completed | Zero LLM | Good for explicit goals |
| **Shell verification** | `tsc --noEmit && vitest --run` | Zero LLM | Good for code tasks |
| **File existence** | Check deliverables exist on disk | Zero LLM | Good for documentation tasks |
| **LLM judgment** | Agent reviews completed work against original goal | 1 LLM call/cycle | Best for ambiguous goals |
| **Hybrid** | Shell gate + LLM judgment on first pass | 1 LLM call total | Best balance |

Recommendation: **Shell verification for code tasks, checklist for others, LLM judgment as fallback**.

### 3.3 Missing Piece #3: Total Budget Cap

Current workflows cap at 2-5 steps. An auto-loop needs a higher but still bounded cap:
- **Step cap**: 10-20 agent calls per auto-loop run
- **Op budget**: Already exists per-session; workflow doesn't override it
- **Time cap**: Not implemented in engine but trivial (`Date.now() - startTime > maxDuration`)
- **Cost cap**: Not tracked at workflow level (tracked at session level)

**Recommendation**: Add `maxSteps` parameter to auto-loop workflow (default 10). The engine's existing steering mechanism provides emergency brake.

### 3.4 Non-Missing: Things People Think Are Missing But Aren't

| "We need..." | Reality |
|---|---|
| "State persistence across steps" | ✅ JS variables persist across `runAgent` calls within `execute()`. WorkflowRun JSON persists to disk after every step. |
| "Error recovery" | ✅ Workflows catch errors and retry. Resume replays completed steps. |
| "Context passing between steps" | ✅ `ctx.summarize(result)` + `lastAssistantText` + full `TaskResult` |
| "Parallel execution" | ⚠️ Not built into workflow engine, but trivial via `Promise.all([ctx.runAgent(...), ctx.runAgent(...)])` |
| "Dynamic agent selection" | ✅ `runAgent(name, task)` takes any agent name as a string. Workflow can pick agents dynamically. |
| "Sub-workflow calls" | ✅ `ctx.runWorkflow(name, task)` works. Max depth 3. |

---

## 4. Production Data

### 4.1 Workflow Statistics (229 runs)

- **Success rate**: 127/229 = 55% (93 escalated, 6 errors, 3 interrupted)
- **Max steps per run**: 4 (implement-and-review with retry)
- **Avg steps**: 2.5 across all workflows
- **Nested workflows**: 1 (barely used — opportunity for auto-loop)

### 4.2 Per-Workflow Performance

| Workflow | Runs | Success | Escalated | Avg Steps |
|---|---|---|---|---|
| implement-and-review | 86 | ~60% | ~35% | 2.9 |
| growth-cycle | 73 | ~40% | ~55% | 2.1 |
| training-sprint | 28 | varies | varies | 2.1 |
| skill-lifecycle | 18 | varies | varies | 3.8 |

### 4.3 Session Duration

The longest workflow-spawned sessions were implement-and-review runs at 489 and 326 minutes (interrupted). Normal workflow runs complete in 5-30 minutes.

---

## 5. Implementation Recommendation

### Option A: "Auto-Task" Workflow (Recommended — Minimal)

A new shared workflow `auto-task.ts`:

```
Input: Goal description + optional task breakdown
Loop: Pick task → run implement-and-verify → shell verify → next task
Gate: All tasks complete + final verification passes  
Cap: maxSteps (default 10), maxDuration (default 30min)
Output: Summary of all completed tasks + verification evidence
```

- **Engine changes**: Zero
- **New code**: ~120 lines
- **Risk**: Low — uses only proven primitives
- **When to use**: Multi-file refactors, feature implementations, batch fixes

### Option B: "Goal Loop" Workflow (More Ambitious)

Add LLM-based re-planning:

```
Input: High-level goal
Step 1: Agent breaks goal into tasks
Loop: Execute next task → re-plan remaining → check if goal met
Gate: LLM judges "is the goal fully met?"
Cap: maxCycles (default 5), maxSteps (default 20)
```

- **Engine changes**: Zero
- **New code**: ~200 lines
- **Risk**: Medium — LLM re-planning can drift
- **When to use**: Exploratory tasks where the full plan isn't known upfront

### Option C: Cron-Triggered Multi-Session Loop (Different Approach)

Instead of a single long workflow, use cron to trigger sequential sessions:

```
Cron job → Agent session reads todo → picks next task → executes → updates todo → finishes
Cron fires again → next session picks up remaining tasks
```

- **Engine changes**: Minor (cron entry with "run until todo empty" logic)
- **New code**: ~50 lines (heartbeat modification)
- **Risk**: Low but slower (cron interval gaps)
- **Already partially exists**: Heartbeat-driven agents already do this pattern manually

### My Recommendation: **Start with Option A**, add Option B's re-planning as a parameter toggle.

---

## 6. Architecture Implications

### No Engine Changes Needed

The workflow engine (workflow-tool.ts) is designed for exactly this. The `execute()` function receives a `WorkflowContext` and can do anything JavaScript can do — loops, branches, state, I/O, shell commands. The engine handles:
- Persistence (automatic step recording)
- Resume (replay completed steps from archive)  
- Steering (interrupt via signal queue)
- Nesting (sub-workflows up to depth 3)
- Error handling (catch + retry patterns)

### What Might Need Tuning

1. **Op budget per session**: Each `runAgent` call creates a session with its own op budget (default from agent.json). For auto-loop, sub-agent sessions might need higher individual budgets or the loop handles more granular tasks.

2. **Total workflow timeout**: Not currently enforced at the engine level. If we add a 30-minute cap, it should be in the workflow code (easy) or the engine (robust but more work).

3. **Progress reporting**: Current workflows don't report mid-loop progress to the caller. Adding `ctx.emit()` calls with progress updates would help observability.

---

## 7. TL;DR

| Question | Answer |
|---|---|
| Can our workflow system loop? | **Yes** — implement-and-verify already does |
| Can it compose sub-workflows? | **Yes** — `runWorkflow()` exists, barely used |
| Can it do dynamic branching? | **Yes** — it's just JavaScript |
| Can it persist state? | **Yes** — automatic per-step persistence |
| Can it resume after crash? | **Yes** — built-in replay mechanism |
| What's missing? | A **top-level auto-loop workflow** (~100 lines) and a **"done?" gate** design |
| Engine changes needed? | **Zero** |
