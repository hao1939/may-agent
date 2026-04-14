# Persistent Task — Design Amendments (Hao's Feedback)

**Date**: 2026-04-14  
**Status**: Authoritative — overrides conflicting sections in persistent-task.md and persistent-task-engineering.md

## Context

Both Bob's design and Tech-Lead's engineering analysis were too conservative. The persistent task system is meant for **tasks that run for days**, not short loops that pause after 10-20 iterations. The key feedback:

> "maxIterations are too small — we're discussing tasks that may run for days. We must have an owner agent that checks progress in heartbeat and can interrupt or redirect. Tasks should start immediately — don't wait for heartbeat or cron."

## Amendment 1: maxIterations Default = 200

The iteration cap is a **last-resort safety net**, not a normal exit condition. Tasks should run until DONE or until the owner intervenes.

| | Old (Bob) | Old (Tech-Lead) | New |
|---|---|---|---|
| Default maxIterations | 20 | 10 | 200 |
| Max override | 50 | 50 | 1000 |
| Philosophy | "Tasks needing >20 should be decomposed" | "10 is sufficient for most tasks" | "The cap is emergency brakes, not a speed limit" |

**Why 200**: At 2 sessions per iteration (worker + review), 200 iterations = 400 sessions. At typical cadence (worker takes 3-10 min per iteration), this is ~10-33 hours of work across potentially many days. Enough for substantial multi-day projects. The 1000 max covers extreme cases (data processing over thousands of files).

**Cost safety still exists** — it's just moved from the iteration cap to the owner agent (Amendment 2).

## Amendment 2: Owner Agent as Safety Net via Heartbeat

The primary safety mechanism is **not** the iteration cap. It's the **owner agent monitoring the task during its regular heartbeats**.

### How it works

```
Task starts immediately → runs iterations autonomously
    ↓
Owner's next heartbeat fires (30-60 min later)
    → Owner reads project file
    → Sees current status, iteration count, recent progress
    → Can: do nothing (let it run), steer (inject guidance), interrupt (pause/redirect), cancel
    ↓
Owner's subsequent heartbeats continue monitoring
```

### Owner heartbeat responsibilities

When an owner agent has active persistent tasks, its heartbeat should:

1. **Read the project file** — check Status, last iteration, recent worker output
2. **Assess trajectory** — is the task making progress? going off-track? burning money?
3. **Decide**:
   - **Let it run** — progress looks good, no action needed
   - **Steer** — write guidance to a steering file or use workflow interrupt to redirect
   - **Pause** — set Status to `paused` in the project file; the workflow checks this each iteration
   - **Cancel** — set Status to `cancelled`; the workflow exits cleanly

### Why this is better than hard caps

| Mechanism | Hard cap (20 iterations) | Owner heartbeat monitoring |
|---|---|---|
| Granularity | Binary: run or stop | Nuanced: steer, pause, redirect |
| Context | None — just a counter | Full — owner reads the progress log |
| Timing | After N iterations regardless of progress | Every heartbeat (~30 min), regardless of iteration count |
| False positives | Stops working tasks mid-flow | Owner sees it's working and lets it continue |
| False negatives | Allows 20 bad iterations | Owner catches problems early |
| Cost awareness | Crude (N × cost/iteration) | Owner can assess cost/value tradeoff in context |

### Workflow integration

The persistent-task loop should check for owner signals between iterations:

```typescript
while (iteration <= config.maxIterations) {
  // Check for owner intervention BEFORE each iteration
  const project = readProjectFile(config.projectPath);
  if (project.status === 'paused') {
    return ctx.done(`Paused by owner at iteration ${iteration}`);
  }
  if (project.status === 'cancelled') {
    return ctx.done(`Cancelled by owner at iteration ${iteration}`);
  }
  
  // Check for steering file
  const steering = readSteering(config.projectPath);
  if (steering) {
    // Inject owner's guidance into the next worker prompt
    applySteeringGuidance(steering);
    clearSteering(config.projectPath);
  }

  // ... worker phase, review phase as before ...
}
```

### What goes in the agent's heartbeat.md

Add a section for agents that own persistent tasks:

```markdown
## Active Persistent Tasks
- Check `agents/<you>/workspace/projects/` for files with Status: active
- For each active task: read the project file, assess progress
- If a task needs intervention: write to `<project>.steering.md` or update Status
```

## Amendment 3: Tasks Start Immediately

When a persistent task is dispatched, it runs **now**. Not on the next heartbeat. Not on the next cron tick.

### Invocation patterns

**Pattern A: Direct dispatch (primary)**
```
Agent decides to start a multi-day task →
  workflow.run("persistent-task", {
    project: "agents/scout/workspace/projects/deep-code-audit.md",
    owner: "may",
    worker: "scout", 
    goal: "Audit all shared libraries for dead code and inconsistencies"
  })
  → Workflow starts IMMEDIATELY
  → Worker begins iteration 1 right now
  → Owner (may) monitors in future heartbeats
```

**Pattern B: Via agent message (delegation)**
```
May sends message to tech-lead: "Start persistent task: implement X"
  → Tech-lead's next session: workflow.run("persistent-task", ...)
  → Runs immediately in that session
```

**Pattern C: Resume after pause/crash**
```
Owner's heartbeat sees paused task → decides to resume →
  workflow.run("persistent-task", "project: same-file.md")
  → Reads markdown, finds last iteration, continues
```

### What this means for the workflow

The `execute()` function should:
1. Run iterations in a tight loop (no artificial delays between iterations)
2. Each iteration = worker session + owner review session 
3. The loop continues until DONE, BLOCKED, iteration cap, or owner intervention (status change in project file)
4. A single workflow invocation might run 5-50 iterations before the session ends (depends on worker session length and wall-clock time)

### Session lifetime vs. task lifetime

A single `workflow.run()` invocation runs within one parent session. That session has a natural lifetime (timeout, steering interrupt, etc.). When the session ends:
- The project file has all progress persisted
- The task can be resumed by another `workflow.run()` call
- The owner's heartbeat can decide whether to resume

So the pattern is:
```
workflow.run() → runs N iterations → session ends (timeout/interrupt/cap)
  ↓
Owner heartbeat fires → sees active task → workflow.run() again → runs N more iterations
  ↓
... repeats until DONE or owner cancels
```

**The first invocation starts immediately. Subsequent resumptions happen via heartbeat or explicit dispatch.**

## Summary of Changes

| Aspect | Before | After |
|---|---|---|
| maxIterations default | 10-20 | 200 |
| Primary safety net | Iteration cap | Owner agent monitoring via heartbeat |
| Task start | "Heartbeat-triggered" or "cron-triggered" | Immediate — workflow.run() fires now |
| Owner role | Reviews each iteration inline | Reviews task trajectory in heartbeats; can steer/pause/cancel |
| Iteration cap purpose | Normal exit condition | Emergency brakes only |
| Task lifetime | Minutes to hours | Hours to days |

## Updated Open Questions

1. ~~Should the owner review use a cheaper model?~~ → Yes, makes more sense now that tasks are long-running. The per-iteration review should be lightweight.
2. **How does the owner's heartbeat discover active tasks?** → Scan `agents/*/workspace/projects/` for `Status: active` files. Simple and reliable.
3. **What happens when the parent session times out mid-iteration?** → Worker output is persisted to markdown before review. On resume, the workflow picks up at the review step. Same crash recovery as before (§4.5 of main design).
4. **Should we emit events for the owner to subscribe to?** → No. The project file IS the event log. Owner reads it in heartbeat. Keep it simple.
