# Design: Persistent Tasks (replacing auto-loop)

**Author**: May  
**Date**: 2026-04-14  
**Status**: Draft  

## Problem

We have a "project" concept (files in `shared/projects/`) and an `auto-loop` workflow (0 production runs). They're disconnected. Projects are passive docs that need agents to manually pick them up each session. Auto-loop is overengineered JSON state machines nobody uses.

**Core insight from user**: There is no difference between a task and a project. A project is just a task that takes more than one turn. Now that we have no turns limitation (workflows can loop forever), there's no reason to treat them differently.

## Design

### One sentence

**An agent starts a task. The task runs in a loop until done or blocked. The project file is the audit log.**

### The loop

```
while (true) {
  // 1. Worker does a chunk of work
  result = await ctx.runAgent(worker, buildPrompt(projectFile, iteration))
  
  // 2. Append result to project file (audit log)
  appendProgress(projectFile, iteration, result)
  
  // 3. Owner reviews: done? blocked? continue?
  assessment = await ctx.runAgent(owner, reviewPrompt(projectFile))
  
  // 4. Exit conditions
  if (assessment says DONE or BLOCKED) break
  
  // 5. Next iteration uses assessment's guidance
  iteration++
}
```

That's it. No phases. No state machines. No JSON. The project markdown file IS the state.

### Project file = audit log

```markdown
# Project: <title>

**Status**: active | done | blocked  
**Owner**: <agent>  
**Worker**: <agent> (can be same as owner)  
**Started**: <timestamp>  
**Last updated**: <timestamp>  

## Goal
<what we're trying to achieve>

## Progress Log
### Iteration 1 — 2026-04-14T10:00:00Z
**Task given**: <what the worker was asked to do>
**Result**: <summary of what happened>
**Files touched**: <list>
**Assessment**: Continue — next step is X

### Iteration 2 — 2026-04-14T10:15:00Z
...

## Current State
<what the owner thinks the situation is — updated each iteration>

## Outcome
<filled in when done/blocked>
```

This is human-readable. Anyone (agent or human) can read the project file and understand exactly what happened, when, and why.

### Who triggers it?

The **owner agent** triggers it. They can:

1. **Call the workflow directly** via the `workflow` tool: `workflow.run("persistent-task", "...")`
2. **Be triggered by cron** via `run-workflow` handler
3. **Be asked by another agent** who delegates the project

The owner IS the watchdog. They're the one running the review step each iteration. They see the worker's output and decide whether to continue, pivot, or stop.

### Worker and owner can be the same agent

For simple tasks: owner = worker. The loop becomes:
```
while (true) {
  result = runAgent(me, "do next chunk based on project file")
  update project file
  check = runAgent(me, "am I done?")
  if done: break
}
```

For complex tasks: owner ≠ worker. E.g., May owns the project, tech-lead does the work, May reviews each iteration.

### Exit conditions

1. **DONE** — Owner says the goal is achieved
2. **BLOCKED** — Owner identifies a blocker that can't be resolved autonomously
3. **Steering interrupt** — External signal via existing steering mechanism (telegram/socket)
4. **Timeout** — `timeoutMs` in workflow config (safety net, set high: 4-24h)
5. **Max iterations** — Optional safety cap, default none (infinite)

### What about auto-loop?

Delete it. 0 production runs. This replaces it with something simpler.

## Workflow input format

```
project: agents/shared/projects/my-project.md
owner: may
worker: tech-lead
goal: Implement the new guard system per the design doc
```

Or for self-driven tasks (owner = worker):
```
project: agents/scout/workspace/projects/deep-dive-X.md
agent: scout
goal: Research and synthesize findings on topic X
```

## Implementation

One file: `agents/shared/workflows/persistent-task.ts`

~100 lines. No state machine. No JSON persistence. The markdown file is the persistence layer.

### Key functions

1. `parseInput(task)` — Extract project path, owner, worker, goal from task string
2. `readProjectFile(path)` — Read current project state, or create if new
3. `appendProgress(path, iteration, result)` — Append an iteration entry to the progress log
4. `extractStatus(text)` — Parse owner's assessment: DONE | BLOCKED | CONTINUE
5. `execute(ctx)` — The main loop

### The execute function (pseudocode)

```typescript
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const { projectPath, owner, worker, goal } = parseInput(ctx.task);
  
  // Initialize or resume project file
  let project = readOrCreateProject(projectPath, { owner, worker, goal });
  let iteration = project.lastIteration + 1;
  
  while (true) {
    // Worker does work
    const workerPrompt = buildWorkerPrompt(project, iteration);
    const result = await ctx.runAgent(worker, workerPrompt);
    
    // Record in audit log
    appendProgress(projectPath, iteration, result);
    
    // Owner reviews (skip if worker errored — auto-escalate)
    if (result.status === "error") {
      markBlocked(projectPath, `Worker error: ${result.error}`);
      return ctx.escalate(`Worker failed at iteration ${iteration}`, { projectPath });
    }
    
    const reviewPrompt = buildReviewPrompt(projectPath, iteration, result);
    const assessment = await ctx.runAgent(owner, reviewPrompt);
    
    const decision = extractStatus(assessment.lastAssistantText ?? "");
    appendAssessment(projectPath, iteration, decision, assessment);
    
    if (decision.status === "done") {
      markDone(projectPath, decision.summary);
      return ctx.done(`Project complete after ${iteration} iterations: ${decision.summary}`);
    }
    
    if (decision.status === "blocked") {
      markBlocked(projectPath, decision.reason);
      return ctx.escalate(`Blocked at iteration ${iteration}: ${decision.reason}`, { projectPath });
    }
    
    // Continue with owner's guidance for next iteration
    iteration++;
  }
}
```

## What this enables

1. **Any agent can drive any project** — just start the workflow
2. **Projects are auditable** — every iteration logged in markdown
3. **Resume is trivial** — read the project file, see where we left off, keep going
4. **External visibility** — humans can read project files in real-time
5. **Interrupt is built-in** — steering already works
6. **No new concepts** — uses existing workflow, runAgent, project file patterns

## What we're NOT building

- No dashboard UI (project files are the dashboard)
- No priority queue (agents decide what to work on)
- No inter-project dependencies (keep it simple)
- No parallel workers within one project (fork separate workflows for that)

## Migration

1. Delete `auto-loop.ts` (0 users)
2. Create `persistent-task.ts`
3. Update `shared/workflows/REGISTRY.md`
4. Any agent can now: `workflow.run("persistent-task", "project: ... owner: ... worker: ... goal: ...")`
