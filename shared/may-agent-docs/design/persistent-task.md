# Design: Persistent Task System

**Author**: Bob (design review), May (draft)  
**Date**: 2026-04-14  
**Status**: Design review  
**Replaces**: `auto-loop.ts` (0 production runs, deleted from disk 2026-04-11)  

## 1. Core Idea

**A task and a project are the same thing.** A project is just a task that takes more than one turn. With unbounded workflow loops, there's no reason to treat them differently.

An agent starts a task. The task runs in a loop until done or blocked. The markdown project file IS the state — no JSON, no state machines, no separate persistence layer.

## 2. The Loop

```
Owner starts persistent-task workflow
  │
  ▼
┌─────────────────────────────────────────┐
│  while (status == CONTINUE) {           │
│    1. Worker does a chunk of work       │
│    2. Append result to project file     │
│    3. Owner reviews → DONE/BLOCKED/     │
│                       CONTINUE          │
│  }                                      │
└─────────────────────────────────────────┘
  │
  ▼
Return result (done or escalate)
```

Each iteration is two `ctx.runAgent()` calls: one for the worker, one for the owner's review. The project file accumulates a human-readable audit log.

### 2.1 Owner = Worker (Simple Mode)

For tasks where one agent does everything:

```
agent: bob
project: agents/bob/workspace/projects/refactor-guards.md
goal: Refactor all guard files to use the new API
```

The same agent works AND reviews. The review step is a lightweight "am I done?" check — not a full evaluation. This prevents the common failure mode of an agent losing context across sessions.

### 2.2 Owner ≠ Worker (Delegation Mode)

For supervised work:

```
owner: may
worker: tech-lead
project: agents/shared/projects/persistent-task-impl.md
goal: Implement persistent-task.ts per the design doc
```

May reviews each iteration's output and decides whether tech-lead should continue, pivot, or stop. This is the "project manager" pattern.

## 3. Project File Format

The project markdown file serves triple duty: **state**, **audit log**, and **human dashboard**.

```markdown
# Task: <title>

**Status**: active | done | blocked
**Owner**: <agent>
**Worker**: <agent>
**Started**: <ISO timestamp>
**Updated**: <ISO timestamp>
**Iteration**: <N>

## Goal
<what we're trying to achieve — set once, immutable>

## Progress Log

### Iteration 1 — <timestamp>
**Worker task**: <prompt summary given to worker>
**Worker result**: <what the worker accomplished — truncated summary>
**Files touched**: <list>
**Owner assessment**: CONTINUE — <guidance for next iteration>

### Iteration 2 — <timestamp>
...

## Current State
<owner's running understanding of where things stand — overwritten each iteration>

## Outcome
<filled when done or blocked — final summary>
```

### 3.1 Why Markdown, Not JSON

| Concern | JSON (auto-loop) | Markdown (this design) |
|---------|------------------|----------------------|
| Human readability | Requires tooling | Open in any editor |
| Agent readability | Requires parsing | Native — agents read markdown |
| Resume semantics | Parse state machine | Read the file, see where we are |
| Debugging | Decode JSON fields | Read the progress log |
| Version control | Noisy diffs | Clean diffs |
| Extensibility | Schema changes | Add a section |

auto-loop's JSON state was never read by a human in 0 production runs. The markdown file is the project dashboard for free.

## 4. Edge Cases and Safety

### 4.1 Worker Keeps Failing

**Problem**: Worker errors on every iteration → infinite error loop.

**Solution**: Consecutive failure counter with escalation.

```
Rules:
- Worker error → retry ONCE with error context
- 2nd consecutive error → mark BLOCKED, escalate to owner (or human if owner = worker)
- Owner review error → skip review, treat as CONTINUE (don't let review failures kill the task)
```

**Rationale**: One retry handles transient failures (model hiccup, tool timeout). Two consecutive failures indicates a real problem — a human or different agent needs to look at it. We don't want aggressive retry (3, 5, 10 attempts) because each retry is an LLM session costing $0.50-2.00.

### 4.2 Worker Produces No Progress (Spinning)

**Problem**: Worker returns "success" each iteration but makes no actual progress. The loop continues forever without advancing.

**Solution**: This is the owner's job. The owner review step sees the full progress log. If the last N iterations show no meaningful progress, the owner should assess BLOCKED. We don't need a mechanical detector — the owner IS the detector.

For owner=worker (self-supervised) mode, this is a real risk. Mitigation:

- The review prompt should explicitly ask: "Compare iteration N's output to iteration N-1. Is there measurable progress?"
- The iteration cap (§4.4) is the hard backstop

### 4.3 Runaway Cost

**Problem**: A long-running task accumulates unbounded cost.

**Solution**: Layered cost controls.

| Layer | Mechanism | Default | Override |
|-------|-----------|---------|----------|
| **Iteration cap** | `maxIterations` parameter | 20 | Set in workflow input |
| **Wall-clock timeout** | `timeoutMs` in workflow config | 4 hours | Set in workflow input |
| **Per-session cost** | Existing model-level limits | Varies | N/A (external) |
| **Human steering** | Existing steering/interrupt mechanism | Always on | N/A |

**Why 20 iterations default**: Each iteration is 2 agent sessions (worker + owner review). At ~$1-2 per session pair, 20 iterations ≈ $20-40 maximum. This is enough for substantial multi-step work but caps catastrophic runaway. Tasks needing more than 20 iterations should be decomposed.

**Why 4 hours wall-clock**: Covers most realistic workflows. A task running longer than 4 hours without completing is likely stuck. The timeout triggers a BLOCKED exit, not a silent kill — the project file records where it stopped.

### 4.4 Iteration Cap vs. Infinite Loop

auto-loop had `maxCycles` and it was the RIGHT idea (safety net) even though auto-loop was never used. We keep it:

```
maxIterations: 20       // default, can be overridden
```

When reached: The workflow exits with a `done` result summarizing progress. The project file is left in `active` state so it can be resumed. This is NOT a failure — it's "pausing to checkpoint."

### 4.5 Session Crash Mid-Iteration

**Problem**: The workflow process dies between the worker finishing and the owner reviewing. Where does resume pick up?

**Solution**: The project file is the recovery mechanism.

```
Resume logic:
1. Read project file
2. Find last complete iteration (has both worker result AND owner assessment)
3. If the last iteration has a worker result but NO assessment:
   → Resume from owner review step (don't re-run worker)
4. If the last iteration has an assessment of CONTINUE:
   → Start next iteration normally
5. If no iterations exist:
   → Start from iteration 1
```

**Implementation**: The workflow writes the worker's result to the project file BEFORE calling the owner review. This means:

```
Worker runs → WRITE to project file → Owner reviews → WRITE assessment
                    ▲                                       ▲
              crash here = resume at owner review     crash here = resume at next iteration
```

The only lost work on crash is the owner's review of the current iteration. Worker output is always persisted. This is the key advantage of markdown-as-state: crash recovery is just "read the file."

### 4.6 Concurrent Starts

**Problem**: Two agents (or two cron triggers) start the same project simultaneously.

**Solution**: The workflow reads the project file at start. If `Status: active` and `Updated` is within the last 10 minutes, refuse to start and escalate: "Project appears to be actively running."

This is a heuristic lock, not a mutex. It handles the common case (accidental double-trigger) without introducing locking infrastructure. The 10-minute staleness window means a crashed workflow won't permanently lock a project.

## 5. Interaction with Existing Patterns

### 5.1 Heartbeats

Heartbeats are **not replaced** by persistent tasks. They serve different purposes:

| | Heartbeat | Persistent Task |
|---|-----------|----------------|
| **Purpose** | Periodic check-in, triage, dispatch | Goal-directed multi-step work |
| **Duration** | Single session (1-7 minutes) | Multiple sessions (minutes to hours) |
| **Trigger** | Cron timer | Explicit workflow.run() call |
| **State** | Stateless (reads context each time) | Stateful (project file accumulates) |

**Interaction**: A heartbeat might START a persistent task:

```
Heartbeat fires → agent reads inbox → sees a task that needs multi-step work
  → calls workflow.run("persistent-task", "project: ... goal: ...")
  → workflow runs to completion (or iteration cap)
  → heartbeat session ends with the workflow result
```

A heartbeat should NOT be running inside a persistent task loop. The persistent task IS the loop.

### 5.2 Cron Jobs

Persistent tasks can be triggered by cron entries:

```jsonc
{
  "name": "weekly-knowledge-consolidation",
  "agent": "bob",
  "interval": "7d",
  "handler": "run-workflow",
  "workflow": "persistent-task",
  "task": "agent: bob\nproject: agents/bob/workspace/projects/knowledge-consolidation.md\ngoal: Consolidate and deduplicate knowledge base entries"
}
```

This is the graduation path from manual heartbeat work to automated persistent tasks (per cron-graduation.md).

### 5.3 Existing Projects Directory

`agents/shared/projects/` already contains project files with status, lifecycle, and ownership metadata. Persistent tasks should use these files directly. No migration needed — just start pointing the workflow at existing project files.

The current project file format (see shared/projects/README.md) tracks lifecycle stages: research → experiment → adopt → validate. The persistent task's progress log is additive — it gets appended to whatever's already in the file.

### 5.4 Auto-Pause Recovery

If the persistent-task workflow's worker sessions trigger auto-pause (3 consecutive errors), the auto-pause circuit breaker (auto-pause-recovery.md) handles it. The persistent task will be BLOCKED when the worker fails twice consecutively (§4.1), which happens before auto-pause triggers (3 errors). So in practice, the persistent task's own error handling fires first.

## 6. Owner Review: Lightweight LLM, Not Rules

### 6.1 Why LLM Review

The owner review step must answer: "Is this task done? Should we continue? Are we stuck?"

This is a **judgment call**, not a mechanical check. Consider:

- "The worker implemented 3 of 5 functions" → CONTINUE (but how many more iterations?)
- "The worker's approach has a fundamental flaw" → BLOCKED (need human input) or CONTINUE with pivot guidance
- "The worker wrote tests but they don't cover the edge case from the goal" → CONTINUE with specific guidance
- "This is good enough for now" → DONE

Rule-based review can't handle this. auto-loop's `extractDecision()` regex (`DECISION: DONE` / `REVISE`) was brittle — it defaulted to CONTINUE for anything it couldn't parse, which meant the loop never stopped early.

### 6.2 Review Prompt Structure

```
You are reviewing iteration {N} of a persistent task.

## Goal
{goal}

## Progress Log (last 3 iterations)
{recent_progress}

## Latest Worker Output
{worker_summary}

## Files Modified This Iteration
{files_list}

Assess:
1. Is the goal achieved? If yes, respond with DONE and a summary.
2. Is the task blocked on something the worker can't resolve? If yes, respond with BLOCKED and the reason.
3. Otherwise, respond with CONTINUE and specific guidance for the next iteration.

Your response MUST start with one of: DONE, BLOCKED, CONTINUE
```

### 6.3 Review Cost

Each review is one short LLM call. At the cheapest tier (Claude Haiku or equivalent), this is ~$0.01-0.05 per review. The total review overhead for a 10-iteration task is $0.10-0.50 — trivial compared to the worker sessions.

For owner=worker mode, the review can be even cheaper: use `ctx.runAgent()` with a lightweight prompt that just asks for a status assessment. The agent doesn't need full tool access for the review step.

### 6.4 When to Skip Review

For workflows where every iteration is clearly incremental (e.g., "process each file in this directory"), the review step adds latency without value. Optional parameter:

```
reviewEvery: 5    // only run owner review every 5th iteration
```

Iterations without review auto-CONTINUE. This trades safety for speed on well-understood tasks. Default: review every iteration.

## 7. Input Format

```
project: <path to project markdown file>
owner: <agent name>
worker: <agent name>
goal: <one-line goal description>
maxIterations: 20          # optional, default 20
timeoutMs: 14400000        # optional, default 4 hours
reviewEvery: 1             # optional, default 1
```

Short form for self-supervised tasks:

```
project: <path>
agent: <name>
goal: <goal>
```

When `agent` is specified instead of `owner`/`worker`, both are set to the same agent.

## 8. Implementation Sketch

One file: `agents/shared/workflows/persistent-task.ts`, ~120-150 lines.

```typescript
export const name = "persistent-task";
export const description = "Run a task in a loop until done or blocked. " +
  "Project markdown file is the state and audit log.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task);
  let project = readOrCreateProject(config);
  let iteration = project.lastCompleteIteration + 1;
  let consecutiveFailures = 0;

  // Staleness check (§4.6)
  if (project.status === 'active' && isRecentlyUpdated(project, 10 * 60_000)) {
    return ctx.escalate("Project appears to be actively running");
  }

  while (iteration <= config.maxIterations) {
    // --- Worker phase ---
    const workerPrompt = buildWorkerPrompt(project, iteration, config.goal);
    const result = await ctx.runAgent(config.worker, workerPrompt);

    if (result.status === "error") {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        markBlocked(config.projectPath, `Worker failed ${consecutiveFailures}x`);
        return ctx.escalate(`Worker failed at iteration ${iteration}`);
      }
      // Retry once
      appendNote(config.projectPath, iteration, "Worker error, retrying...");
      continue; // re-run same iteration
    }
    consecutiveFailures = 0;

    // Persist worker output BEFORE review (crash safety, §4.5)
    appendWorkerResult(config.projectPath, iteration, result);

    // --- Owner review phase ---
    if (iteration % config.reviewEvery === 0) {
      const reviewPrompt = buildReviewPrompt(project, iteration, result);
      const assessment = await ctx.runAgent(config.owner, reviewPrompt);
      const decision = extractDecision(assessment);

      appendAssessment(config.projectPath, iteration, decision);

      if (decision.status === "done") {
        markDone(config.projectPath, decision.summary);
        return ctx.done(`Complete after ${iteration} iterations: ${decision.summary}`);
      }
      if (decision.status === "blocked") {
        markBlocked(config.projectPath, decision.reason);
        return ctx.escalate(`Blocked at iteration ${iteration}: ${decision.reason}`);
      }
      // CONTINUE — decision.guidance feeds into next worker prompt
    } else {
      appendAssessment(config.projectPath, iteration, { status: "continue", guidance: "auto" });
    }

    iteration++;
  }

  // Iteration cap reached — not a failure, just a pause
  markPaused(config.projectPath, `Reached ${config.maxIterations} iterations`);
  return ctx.done(`Paused after ${config.maxIterations} iterations. Resume by re-running.`);
}
```

### 8.1 Key Functions

| Function | Purpose |
|----------|---------|
| `parseInput(raw)` | Extract config from workflow task string |
| `readOrCreateProject(config)` | Read existing project file or create from template |
| `buildWorkerPrompt(project, iteration, goal)` | Include goal + last 3 iterations + owner guidance |
| `buildReviewPrompt(project, iteration, result)` | Include goal + progress log + latest result |
| `appendWorkerResult(path, iteration, result)` | Write worker output to progress log (using ctx.summarize) |
| `appendAssessment(path, iteration, decision)` | Write owner decision to progress log |
| `extractDecision(assessment)` | Parse DONE/BLOCKED/CONTINUE from owner's text |
| `markDone/markBlocked/markPaused(path, reason)` | Update Status header + fill Outcome section |

### 8.2 Worker Prompt Context Window

The worker prompt must fit in context without overwhelming. Strategy:

- **Always include**: Goal, current state, owner's last guidance
- **Include last 3 iterations**: Enough context for continuity without bloat
- **Truncate earlier iterations**: Just iteration number + one-line summary
- **Never include**: Full file contents (worker can read them)

For a 20-iteration task, the prompt stays roughly constant size (~2-4K tokens) rather than growing linearly.

## 9. What This Replaces

| Old Concept | New Equivalent |
|-------------|---------------|
| auto-loop.ts | persistent-task.ts |
| auto-loop JSON state file | Project markdown file |
| `plan → execute → evaluate` phases | Just `work → review` (simpler) |
| `maxCycles` | `maxIterations` |
| `stuckCount` heuristic | Owner review judgment |
| `context.keyFindings` JSON | Progress log in markdown |
| Separate "project" concept in shared/projects/ | Same file, used directly by the workflow |

## 10. What We're NOT Building

- **No priority queue** — agents decide what to work on (via heartbeats, inbox, cron)
- **No inter-project dependencies** — keep it simple; use agent coordination for sequencing
- **No parallel workers** — fork separate workflow instances for parallelism
- **No dashboard UI** — the project markdown file IS the dashboard
- **No project discovery/listing API** — `ls agents/*/workspace/projects/` works fine
- **No automatic decomposition** — if a task needs 50 iterations, the human should break it up

## 11. Migration Plan

1. auto-loop.ts is already deleted from disk (2026-04-11 cleanup)
2. Create `agents/shared/workflows/persistent-task.ts`
3. Update `agents/shared/workflows/REGISTRY.md`
4. Add to agent context.md files: "For multi-step tasks, use `workflow.run('persistent-task', ...)`"
5. (Optional) Wire into cron for recurring multi-step work

No existing workflows depend on auto-loop. No migration of state files needed (0 production runs).

## 12. Open Questions

1. **Should the owner review use a cheaper model?** If owner=worker, the review session uses the same model as the work session. For pure assessment, a cheaper/faster model might suffice. But the workflow API (`ctx.runAgent`) doesn't currently support per-call model overrides. Defer until we see cost data.

2. **Should iteration cap trigger a notification?** When a task hits maxIterations, should it automatically create a request to the owner agent? Currently it just returns and the project file records the pause. A notification would ensure the task doesn't get forgotten. Probably yes — add as a tracked request.

3. **How do we handle project file growth?** A 50-iteration project file could grow large. The worker prompt already truncates to last 3 iterations (§8.2), but the file itself keeps growing. Accept this — markdown is cheap, and the full log has archival value. If it becomes a problem, add an `archiveOlderThan` parameter that moves old iterations to a `progress-archive.md` companion file.

## 13. Success Criteria

This design succeeds if:

- [ ] At least 3 agents use persistent-task in the first week
- [ ] >50% of persistent tasks complete (DONE) within iteration cap
- [ ] Project files are actually read by humans (Hao) for status checks
- [ ] No runaway cost incidents (>$50 on a single task)
- [ ] Resume-after-crash works at least once in production
