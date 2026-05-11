# Design: Master-Worker Workflow (Persistent Sessions)

**Status:** retired historical design. The runtime workflow files and dedicated
tests were removed; `project` is the default explicit-project workflow. Do not
select `workflow: master-worker` for non-archived shared projects.

## Overview

Historical design for a project workflow that uses **two persistent sessions** —
one worker, one reviewer — that stay alive across iterations. The current
runtime convention favors the simpler `project` workflow and file-backed
project context.

## Current Architecture (what we're replacing)

```
handler tick → workflow.execute()
  iteration 1:
    runAgent("bob", workerPrompt)    → new session, N turns, session ends
    runAgent("may", reviewPrompt)    → new session, N turns, session ends
  iteration 2:
    runAgent("bob", workerPrompt)    → new session, N turns, session ends (context rebuilt from files)
    runAgent("may", reviewPrompt)    → new session, N turns, session ends (context rebuilt from files)
  ...
```

**Problems:**
- Worker rebuilds ~20k token context every iteration (project.md + journal + guidance + milestones)
- Worker doesn't remember what it tried, what failed, how the codebase works
- Reviewer re-injects all previous guidance via `getAllReviewerGuidance()` string parsing
- No prompt cache hits — every session is cold
- No compaction benefit — sessions too short to trigger

## New Architecture

```
handler tick → workflow.execute()
  create worker session (stays alive)
  create reviewer session (stays alive)

  reviewer.prompt("Assess current state of this project...")  ← planning phase
  decision = extractDecision(reviewer)

  while (decision is CONTINUE or PIVOT):
    worker.followUp(decision.guidance)        ← worker keeps full context
    await worker.waitForIdle()

    reviewer.followUp(summarize(worker))      ← reviewer keeps full context
    await reviewer.waitForIdle()
    decision = extractDecision(reviewer)

  cleanup: persist session state, emit final event
```

## Session Lifecycle

### Worker Session

```
Created:     workflow start
First prompt: reviewer's initial guidance (not a giant rebuilt prompt)
Subsequent:  followUp(reviewer guidance) — adds one user message
Compaction:  triggers naturally at 70% context window
             KeyFacts preserved: files read/edited, commands run, what failed
Ends:        workflow ends (done/blocked/cancelled/max-iterations)
```

### Reviewer Session

```
Created:     workflow start
First prompt: "Assess project state" + project.md + journal.md
Subsequent:  followUp(worker summary) — adds one user message
Compaction:  triggers naturally; preserves review history, decision patterns
Ends:        workflow ends
```

### Why Review First

The reviewer's first prompt is a **planning** step:
- Reads project.md (goal, milestones, current state)
- Reads journal.md (what happened in previous workflow runs)
- Checks file system (do deliverables exist? are tests passing?)
- Produces a focused work order for the worker

This solves the cold-start problem. Today the worker gets a giant prompt and has to figure out where things stand. With review-first, the worker gets a clear, focused directive from iteration 1.

## WorkflowContext Changes

New primitives needed:

```typescript
interface WorkflowContext {
  // ... existing fields ...

  /** Unique run identifier. */
  runId: string;

  /**
   * Create a persistent agent session that stays alive across followUp() calls.
   * Returns a handle for sending messages and reading results.
   */
  createSession(agent: string, opts?: {
    systemPrompt?: string;
    tools?: "full" | "readonly";    // readonly = no Edit, Write, Bash-write
    projectId?: string;
  }): Promise<SessionHandle>;
}

interface SessionHandle {
  sessionId: string;

  /** Send the initial prompt. Agent works until idle. */
  prompt(message: string): Promise<void>;

  /** Queue a follow-up message. Agent works until idle. */
  followUp(message: string): Promise<void>;

  /** Wait for current work to finish. */
  waitForIdle(): Promise<void>;

  /** Get the agent's last assistant text. */
  lastText(): string;

  /** Get a summary of what happened since last check. */
  summarize(opts?: HandoffOptions): string;

  /** Abort the current run. */
  abort(): void;

  /** End the session permanently. */
  close(): void;
}
```

### Implementation

`createSession` wraps `manager.createAgent()` + bookkeeping:
- Creates a pi-agent `Agent` instance with the specified agent's config
- Registers it in the DB with `projectId` and `workflowRunId`
- Subscribes to events for persistence (JSONL) and bus emission
- Returns a `SessionHandle` that delegates to `agent.prompt()`, `agent.followUp()`, etc.

This is a thin wrapper — most of the machinery already exists in `manager.ts`.

## Workflow Implementation

```typescript
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const projectContent = readFile(config.projectPath);
  const journalContent = readFile(config.journalPath);
  const state = parseProjectState(projectContent);

  // Early exits (unchanged)
  if (state.status === "paused") return ctx.done("Paused.");
  if (state.status === "cancelled") return ctx.done("Cancelled.");
  if (isTerminal(state) && !hasPendingComments(projectContent)) {
    return ctx.done(`Status: ${state.status}. No pending comments.`);
  }

  // ── Create persistent sessions ──
  const worker = await ctx.createSession(config.worker, {
    tools: "full",
    projectId: config.projectId,
  });
  const reviewer = await ctx.createSession(config.owner, {
    tools: "readonly",
    projectId: config.projectId,
  });

  ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "started",
    workflow: "master-worker", projectId: config.projectId });

  let iteration = state.lastIteration + 1;
  let continueWithoutProgress = 0;

  try {
    // ── Planning phase: reviewer assesses state ──
    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase",
      detail: "planning", iteration });

    await reviewer.prompt(buildPlanningPrompt(projectContent, journalContent, config.goal));
    await reviewer.waitForIdle();
    let decision = extractDecision(reviewer.lastText());

    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "decision",
      detail: `${decision.status} — ${decision.detail}`, data: { status: decision.status, iteration } });

    // ── Handle pending comments (before main loop) ──
    const comments = extractComments(projectContent);
    if (comments) {
      // Reviewer already has project context — just ask about comments
      await reviewer.followUp(`Pending comments to address:\n${comments}\nHow should these affect the plan?`);
      await reviewer.waitForIdle();
      decision = extractDecision(reviewer.lastText());
      clearComments(config.projectPath, projectContent);
    }

    // ── Main loop ──
    while (iteration <= config.maxIterations && isContinue(decision)) {
      // ── Work phase ──
      ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase",
        detail: "working", iteration });

      if (iteration === 1) {
        await worker.prompt(buildInitialWorkerPrompt(config.goal, decision.guidance));
      } else {
        await worker.followUp(decision.guidance);
      }
      await worker.waitForIdle();

      // Journal (append-only, unchanged)
      appendJournal(config, iteration, worker.summarize());

      // ── Review phase ──
      ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase",
        detail: "reviewing", iteration });

      await reviewer.followUp(worker.summarize({ maxLength: 1500 }));
      await reviewer.waitForIdle();
      decision = extractDecision(reviewer.lastText());

      ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "decision",
        detail: `${decision.status} — ${decision.detail}`,
        data: { status: decision.status, iteration } });

      // ── Progress tracking ──
      updateMilestones(config, reviewer.lastText());
      const progress = checkProgress(config, continueWithoutProgress);
      continueWithoutProgress = progress.count;

      if (progress.stalled) {
        ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "blocked",
          detail: `${continueWithoutProgress} iterations without progress` });
        updateProjectStatus(config, "blocked", progress.reason);
        return ctx.escalate(progress.reason);
      }

      // ── Handle non-continue decisions ──
      if (decision.status === "blocked") {
        ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "blocked",
          detail: decision.detail });
        updateProjectStatus(config, "blocked", decision.detail);
        return ctx.escalate(decision.detail);
      }
      if (decision.status === "waiting") {
        ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "waiting",
          detail: decision.detail });
        updateProjectStatus(config, "waiting", decision.detail);
        return ctx.done(`Waiting: ${decision.detail}`);
      }

      updateCurrentState(config, iteration, decision);
      iteration++;

      // ── Re-check for new comments mid-loop ──
      const newComments = extractComments(readFile(config.projectPath));
      if (newComments) {
        await reviewer.followUp(`New comments received:\n${newComments}`);
        await reviewer.waitForIdle();
        decision = extractDecision(reviewer.lastText());
        clearComments(config.projectPath);
      }
    }

    // ── Wrap up ──
    if (iteration > config.maxIterations) {
      updateProjectStatus(config, "paused", `Reached ${config.maxIterations} iteration cap.`);
    }

    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "completed",
      detail: `${iteration - 1} iterations` });

    return ctx.done(`Completed after ${iteration - 1} iterations.`);

  } finally {
    worker.close();
    reviewer.close();
  }
}
```

## Worker Prompt Changes

### Current: giant rebuilt prompt every iteration (~20k tokens)

```
You are working on iteration N of a persistent task.
## Goal ...
## Milestones (3/5 complete) ...
## Current State ...
## Resources ...
## Process Notes ...
## Owner Guidance for This Iteration ...
## Recent Progress (last 3 journal entries) ...
## What You Must Produce ...
```

### New: thin initial prompt + followUp guidance

**Initial prompt (iteration 1 only):**
```
You are a worker on a persistent project. You'll receive guidance from a reviewer
after each iteration. Produce concrete deliverables each round.

## Goal
{goal}

## Milestones
{milestones}

## Workspace
Your workspace is {projectDir}. You cannot edit project.md or journal.md.

## First Task
{reviewer's initial guidance}
```

**followUp (iteration 2+):**
```
## Iteration {N} Guidance
{reviewer's decision and guidance}

{if PIVOT: "Previous approach failed. Try this instead: ..."}
{if new comments: "Human feedback: ..."}
```

The worker **already knows** the goal, milestones, codebase structure, what it tried before — it's all in its (compacted) session context. No need to re-inject.

## Reviewer Prompt Changes

### Current: giant rebuilt prompt every review (~15k tokens)

```
[REVIEW ONLY — no file edits expected...]
You are the PROBLEM-SOLVER for iteration N...
## Goal ...
## Milestone Progress ...
## How This System Works ...
## Recent Progress (last 2 journal entries) ...
## Your Previous Guidance (do NOT repeat these) ...
## Comments ...
## Latest Worker Output ...
## Your Decision ...
```

### New: thin initial prompt + followUp worker summaries

**Initial prompt (planning phase):**
```
You are the reviewer/strategist for a persistent project.
Your role: assess state, direct the worker, make decisions.
You can read files but MUST NOT edit them.

## Goal
{goal}

## Milestones
{milestones}

## Current State
{current state from project.md}

## Journal (previous runs)
{journal.md content — only needed at start, compaction handles the rest}

## Decision Format
Respond with: CONTINUE, PIVOT, WAITING, or BLOCKED
Include: (a) concrete output expected, (b) what's different, (c) first step
```

**followUp (after each worker iteration):**
```
## Worker Output (Iteration {N})
{worker.summarize() — files modified, commands run, key output}
```

The reviewer **already knows** its previous guidance, what approaches failed, the project's history — all in its session context. No need for `getAllReviewerGuidance()` string parsing.

## Compaction Behavior

With persistent sessions, compaction triggers naturally:

**Worker session after ~3 iterations (est. 50k tokens):**
```
[Compacted Context]
Original task: implement auth for the API
Files read: src/auth.ts, src/middleware.ts, tests/auth.test.ts, src/routes/login.ts
Files edited: src/auth.ts (added JWT validation), src/middleware.ts (auth guard), tests/auth.test.ts (3 test cases)
Commands: npm test (FAIL: 1), npm test (PASS), curl localhost:3000/login (200 OK)
Summary: Iterations 1-2 implemented JWT auth. Middleware guard works. Tests pass. Reviewer asked to add refresh tokens next.

[Recent messages preserved — last 40% of context window]
```

**Reviewer session after ~3 iterations (est. 20k tokens):**
```
[Compacted Context]
Original task: review auth project
Summary: Iter 1: guided JWT implementation, worker delivered. Iter 2: asked for refresh tokens, worker started but tests incomplete.
Key decisions: CONTINUE (iter 1), CONTINUE (iter 2)

[Recent messages preserved]
```

## Session Persistence and Recovery

### On clean exit
Both sessions' JSONL transcripts are already written by `subscribeForPersistence()`. On next workflow run, check if a session exists:

```typescript
const existingWorker = findSession(config.projectId, "worker", "idle");
if (existingWorker) {
  worker = await ctx.resumeSession(existingWorker.sessionId);
} else {
  worker = await ctx.createSession(config.worker, { tools: "full" });
}
```

### On crash
The `finally` block didn't run, sessions are orphaned. The handler's inflight tracking detects this (existing mechanism). Next tick creates fresh sessions — we lose the accumulated context but not the journal/project.md state. Same as today, no worse.

### Cross-workflow-run continuity
Ambitious but optional: persist the two session IDs in the workflow-run JSON. Next time the handler launches a workflow for the same project, pass the previous session IDs. The workflow resumes them instead of creating new ones. This gives continuity across handler ticks.

```json
{
  "runId": "abc123",
  "workflow": "master-worker",
  "projectId": "bob/auth",
  "sessions": {
    "worker": "sess_w_001",
    "reviewer": "sess_r_001"
  }
}
```

## File I/O Changes

### What stays
- **project.md** — spec file. Status, milestones, goal, comments. Written by workflow for status updates and milestone check-offs.
- **journal.md** — append-only log. Still written each iteration as durable record. Useful for humans reading project history.

### What's reduced
- **Journal as context source** — reviewer no longer needs `getRecentJournalEntries()` or `getAllReviewerGuidance()` injected. Journal is for durability, not for session context.
- **project.md re-reads** — less frequent. Status updates still written, but the worker/reviewer don't need to re-read it each iteration for context.
- **`buildWorkerPrompt()` / `buildReviewPrompt()`** — replaced by thin initial prompts + followUp messages. The 500-line prompt-building machinery shrinks dramatically.

### What's added
- **Session JSONL** — already exists, just longer files now (one per project work cycle instead of one per iteration).

## Migration Path

### Phase 1: Add `createSession` / `SessionHandle` to WorkflowContext
- Implement in handler's workflowCtx builder (agents/may/handlers/project.ts)
- Wraps `manager.createAgent()` + event wiring
- Existing `runAgent()` keeps working — backward compatible

### Phase 2: New workflow file `master-worker.ts`
- Implements the two-session loop
- Lives alongside current `project.ts` — can A/B test
- Handler selects workflow based on project config or feature flag

### Phase 3: Integrate workflow lifecycle events
- Emit events at phase transitions
- DB writer persists to `workflow_events` table
- Web UI shows live project status

### Phase 4: Session recovery
- Persist session IDs in workflow-run JSON
- Resume sessions across workflow runs
- Full cross-tick continuity

## Modes (future)

This design is specifically for the **master-worker** mode. Other modes reuse `SessionHandle` but compose differently:

| Mode | Sessions | Loop |
|------|----------|------|
| `master-worker` | 2 (worker + reviewer) | review → work → review → work → ... |
| `solo` | 1 | work until done or blocked |
| `supervised` | 1 (worker) | work → emit waiting → human reviews → followUp → work |
| `collaborative` | N (peers) | each works independently, sync via files + events |

The `createSession` / `SessionHandle` primitive is mode-agnostic. Each workflow type is a separate `.ts` file that composes sessions as needed.
