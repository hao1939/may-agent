# Persistent Task — Engineering Analysis

**Author**: Tech-Lead  
**Date**: 2026-04-14  
**Status**: Design review (companion to May's draft at `agents/may/workspace/DESIGN-persistent-task.md`)

## Executive Summary

The persistent-task design is directionally correct: markdown-as-state, owner/worker loop, and reuse of `WorkflowContext.runAgent()`. This document identifies the engineering constraints, failure modes, and integration questions that need answers before implementation.

**Bottom line**: The design maps cleanly to our workflow system with ~100-150 lines of new code. The hard problems are not in the happy path — they're in crash recovery, runaway cost containment, and context window management at scale.

---

## 1. Mapping to the Existing Workflow System

### What we can reuse directly

| Existing concept | Maps to | Notes |
|---|---|---|
| `WorkflowContext.runAgent()` | Worker/owner iteration calls | Already handles session creation, persistence, steering interrupts |
| `WorkflowContext.runWorkflow()` | Sub-tasks within a persistent task | Nesting depth limit already enforced (default 3) |
| `WorkflowModule.execute()` | The persistent-task loop itself | Standard workflow shape: `(ctx) => Promise<WorkflowResult>` |
| `WorkflowRun` persistence | Audit trail parallel to markdown | JSON records at `.state/workflows/wr_*.json` already track steps |
| Steering queue | External interrupts | `WorkflowInterrupted` thrown between steps — works as-is |
| Guards system | Cost/safety checks during loop | Guards see `step_done` events from each iteration; can emit `block` demands |
| `workflow.run("persistent-task", ...)` | Entry point | Same invocation pattern as any other workflow |

### What we need to build

1. **`persistent-task.ts`** (~100-150 LOC): The workflow module itself — parse input, read/create project file, run the while loop with `ctx.runAgent()`, append markdown after each iteration.
2. **Markdown parser/appender** (~50 LOC): Read current project file state, extract `lastIteration` number, parse `**Status**:` field, append new iteration blocks. This is string manipulation, not a library.
3. **Nothing else.** No new runtime types, no new persistence layer, no new tools. The workflow system already provides the execution, persistence, and interrupt infrastructure.

### WorkflowContext is sufficient — no extensions needed

The design's pseudocode uses `ctx.runAgent(worker, prompt)` and `ctx.runAgent(owner, reviewPrompt)` — both are standard `runAgent` calls. The `ctx.done()` and `ctx.escalate()` return types are the right exit signals.

One observation: `ctx.agent` (the calling agent's name) is useful for the "owner = worker = self" case. The shared workflow can use `ctx.agent` as the default for both owner and worker if not explicitly specified in the input.

---

## 2. Failure Modes

### 2.1 Crash mid-iteration

**Scenario**: Process dies between worker completing and markdown being updated.

**Risk**: LOW. The `WorkflowRun` JSON persistence already records each step before the next begins. On resume, we have:
- `WorkflowRun.steps[]` — shows which sessions completed
- The project markdown — shows how far we got writing results

**Recovery strategy**: Read the project markdown to find the last completed iteration number. Compare with `WorkflowRun.steps[]`. If a step completed but markdown wasn't updated, re-read the session transcript and append the missing entry. Then continue.

**Key decision**: Should `persistent-task.ts` use the existing `workflow.resume()` mechanism or implement its own? **Recommendation: its own.** The existing resume mechanism replays completed steps by agent name, but persistent-task steps all use the same agents (worker/owner) repeatedly. The markdown file IS the resume state — simpler and more reliable than the JSON replay approach.

### 2.2 Worker infinite loop / no progress

**Scenario**: Worker produces output each iteration but never converges. Owner keeps saying CONTINUE because the worker appears to be making progress.

**Risk**: HIGH. This is the most dangerous failure mode because it's invisible to automated checks — both agents are "working" and producing output.

**Mitigations (layered)**:
1. **Iteration cap** — `maxIterations` in input (default: 10, max: 50). Mandatory, not optional. If hit, escalate to human.
2. **Staleness detection** — After every N iterations (e.g., 5), inject a "meta-review" prompt to the owner: "You've completed N iterations. Summarize concrete deliverables so far. If you can't name specific files/decisions produced, this task may be stuck." This is cheap (one extra `runAgent` call every 5 iterations).
3. **Guard integration** — A `persistent-task-cost` guard that watches cumulative session count and blocks if cost exceeds a threshold. Fits naturally into the existing guard system.

### 2.3 Owner/worker disagreement

**Scenario**: Worker says "I completed the task" but owner says "No, not good enough." Loop never converges because the owner keeps rejecting.

**Risk**: MEDIUM. In practice, both agents read the same project file, so their context is aligned. But it can happen if the goal is ambiguous.

**Mitigation**: The owner's CONTINUE assessment must include a concrete "next step" instruction. If the owner says CONTINUE but gives no actionable next step for 2 consecutive iterations, auto-escalate. Detect this by checking if the assessment text length is below a threshold (e.g., <50 chars after stripping the CONTINUE keyword).

### 2.4 Context window overflow

**Scenario**: After 20 iterations, the project markdown is 50KB. When we inject it into the worker's prompt, it blows the context window or pushes out the system prompt.

**Risk**: HIGH for long-running tasks (>10 iterations).

**Mitigation**: Tiered context strategy:
- **Iterations 1-5**: Full project file in prompt. (~5-10KB, fine.)
- **Iterations 6-15**: Last 3 full iterations + one-line summaries of earlier ones. The owner's assessment for each iteration becomes the summary.
- **Iterations 16+**: Only the Goal, Current State, and last 2 iterations. Everything else is in the file but not in the prompt.

The markdown file always contains everything (it's the audit log). The *prompt construction* is what gets windowed. This is just string slicing in `buildWorkerPrompt()` / `buildReviewPrompt()`.

### 2.5 File corruption / concurrent writes

**Scenario**: Two persistent-task workflows running on the same project file simultaneously.

**Risk**: LOW but catastrophic.

**Mitigation**: Use a simple lock file (`<project>.lock`) created at start, deleted at end. If lock exists and is <4h old, refuse to start. If >4h old, steal the lock (crash recovery). This is ~10 lines of code. Alternatively, since the workflow system is single-threaded per process, just rely on "don't call `workflow.run()` twice on the same project" as a convention.

---

## 3. Cost / Ops Implications

### Cost per iteration

Each iteration = 2 `runAgent` calls (worker + owner review). Typical session cost:
- Worker: 5-30 ops (depends on task complexity)
- Owner review: 3-8 ops (reading and deciding)
- **Per iteration**: ~8-38 ops, ~$0.05-$0.30

### Runaway protection

The design says "Optional safety cap, default none (infinite)." **I disagree.** Default must be finite. Here's why:

An infinite loop with $0.10/iteration hitting 100 iterations = $10. Not catastrophic for us, but:
1. It consumes agent time that could be spent elsewhere
2. It fills up the project file with noise
3. The context window problem compounds

**Recommended defaults**:
- `maxIterations`: 10 (sufficient for most tasks; can be overridden up to 50)
- `timeoutMs`: 4 hours (safety net for wall-clock time)
- Guard-based cost cap: total sessions spawned by this workflow run ≤ 30

### Comparison with current approaches

| Approach | Sessions per task | Human checkpoints | Resume? |
|---|---|---|---|
| Manual (heartbeat picks up task) | 1-3 per heartbeat | Every heartbeat | No — agent forgets between heartbeats |
| `auto-loop` (never used) | 3-9 per cycle (plan+exec+eval) | maxCycles | Yes, via JSON state |
| **persistent-task** | 2 per iteration (worker+owner) | maxIterations | Yes, via markdown |

Persistent-task is ~33% more efficient per iteration than auto-loop (2 sessions vs. 3) because it eliminates the separate "plan" phase — the owner's assessment serves as both evaluation and next-iteration planning.

---

## 4. How Resume Works Technically

### The markdown IS the checkpoint

```
1. Read project file
2. Parse front-matter: Status, last iteration number
3. If Status == "active":
   a. Find last "### Iteration N" header → lastIteration = N
   b. Check if it has both **Task given** and **Assessment** sections
   c. If Assessment is missing → previous crash mid-review → re-run owner review for iteration N
   d. If Assessment present → start at iteration N+1
4. Build prompt with project context (windowed per §2.4)
5. Continue the while loop
```

### What about the WorkflowRun JSON?

The `WorkflowRun` JSON and the markdown will drift if a crash happens. **Markdown is the source of truth.** The JSON is useful for the session trace system (finding child sessions) but the loop logic should only depend on the markdown.

On resume, create a NEW `WorkflowRun` with `resumedFromRunId` pointing to the old one. This is already how `workflow.resume()` works.

### Resume entry point

Two options:
1. **Re-invoke**: `workflow.run("persistent-task", "project: same/path.md ...")` — the workflow reads the markdown, sees it's active at iteration 5, and continues from 6. Simple, no special API.
2. **workflow.resume()**: Use the existing resume action with the previous `workflowRunId`. Problem: this replays sessions by agent-name matching, which doesn't work well when all steps use the same agent names.

**Recommendation: Option 1.** The `execute()` function checks if the project file already has progress and picks up where it left off. No need for the workflow-level resume machinery. This is actually simpler than auto-loop's approach because there's no JSON state file to get out of sync.

---

## 5. Integration with Cron/Heartbeat

### Option A: Heartbeat-triggered (recommended)

```
Heartbeat fires → Agent reads project files → 
  Sees "Status: active" → workflow.run("persistent-task", "project: X.md") → 
  Runs N iterations → Returns → 
  Agent continues heartbeat
```

**Pros**:
- No new scheduling mechanism
- Agent decides WHEN to pick up a task (priority-aware)
- Heartbeat is already the agent's "wake up and work" trigger
- Cost is naturally bounded by heartbeat frequency

**Cons**:
- Task runs within the heartbeat's session — if the heartbeat has other work, the persistent-task competes
- Heartbeat interval (typically 30-60 min) determines minimum gap between task resumptions

### Option B: Cron-triggered (for autonomous tasks)

```
Cron job fires → Message to agent: "Resume persistent task X" →
  Agent session starts → workflow.run("persistent-task", "project: X.md") →
  Runs N iterations → Finishes
```

**Pros**:
- Dedicated session for the task
- Can set different frequencies per task
- Doesn't bloat heartbeat sessions

**Cons**:
- Requires cron entry per active task
- Agent needs to set up cron when starting a task and clean it up when done
- More moving parts

### Option C: Independent / long-running (not recommended)

```
One continuous workflow.run() that loops for hours
```

**Why not**: If the process restarts (deploy, crash, OOM), we lose the active session. Our system is designed around short-lived sessions that checkpoint and resume. A 4-hour continuous workflow run is fragile. The heartbeat/cron approach with markdown-based resume is more resilient.

### Recommendation: Hybrid A + B

- **Default**: Heartbeat-triggered. Agent's heartbeat checks for active persistent tasks and runs a few iterations.
- **Opt-in**: Agent can create a cron job for a specific task that needs higher cadence than heartbeat allows.
- The persistent-task workflow doesn't care HOW it's invoked — it reads the markdown and picks up where it left off.

---

## 6. What to Delete

The design says delete `auto-loop.ts`. Confirmed: **0 production runs** (I checked sessions DB). It has 321 lines of code managing JSON state, plan/execute/evaluate phases, stuck detection, context tracking — all of which persistent-task replaces with ~150 lines and a markdown file. The stuck detection from auto-loop IS worth preserving as a pattern (§2.2), just implemented differently.

---

## 7. Open Questions for Bob/May

1. **Who creates the project file?** The workflow on first run? Or does the calling agent pre-create it? The design implies the workflow creates it, which is cleaner.

2. **Project file location convention?** `agents/<agent>/workspace/projects/<slug>.md`? Or `agents/shared/projects/<slug>.md`? Matters for multi-agent projects where owner ≠ worker.

3. **Should the owner review step be skippable?** For simple tasks (owner = worker), the review step is overhead. Consider: if `owner === worker`, skip the explicit review and instead embed "Are you done? If so, say DONE" in the worker prompt.

4. **How does the agent discover its active projects?** Scan a directory? Or maintain a list in `todo.md`? Directory scan is more reliable (no state to maintain), but slower. For an agent with 3-5 active projects, either is fine.

5. **Guard integration: should persistent-task emit custom events?** E.g., `{ type: "iteration_done", iteration: 5, projectPath: "..." }`. This would let guards track cross-iteration patterns (like detecting staleness). The existing guard events (`step_done` for each `runAgent` call) fire but don't carry iteration context.

---

## 8. Implementation Order

If we proceed:

1. **Phase 1**: Core loop + markdown read/write (~100 LOC, 1 session)
   - `persistent-task.ts` with `parseInput`, `readOrCreateProject`, `appendProgress`, `extractStatus`, `execute`
   - Test with a simple self-driven task (owner = worker = coder)
   
2. **Phase 2**: Context windowing + staleness detection (~50 LOC, 1 session)
   - Prompt builder that windows older iterations
   - Meta-review injection every N iterations
   
3. **Phase 3**: Guard + observability (~30 LOC, 1 session)
   - `persistent-task-cost.ts` guard
   - Iteration count logging for dashboard

Total: ~180 LOC across 3 files. 3 sessions to implement.

[SIG: 1776179634:b2c8e1ff]
