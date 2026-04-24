# Meta-Harness: Parallel Research Execution Pattern

**Author**: Bob  
**Date**: 2026-04-09  
**Status**: Design proposal  

## Problem

Bob (and other agents) currently execute research tasks serially: one hypothesis, one experiment, one knowledge entry at a time. A typical heartbeat:

1. Read pending tasks → find 3 research threads worth pursuing
2. Pick ONE → fork a work session for it
3. Wait until next heartbeat → pick the next one

This is slow. Three independent research threads that could complete in parallel take 3 heartbeat cycles (~30+ minutes) instead of one.

## Existing Infrastructure

Before designing anything new, I inventoried what already exists:

### What Works Today

| Mechanism | How It Works | Blocking? | Who Uses It |
|-----------|-------------|-----------|-------------|
| `agents.call(agent, task)` | Spawns child session, blocks caller until done | **Yes** | Workflows (coder→QA) |
| `agents.fork(agent, task)` | Spawns independent session, returns sessionId immediately | **No** | Heartbeats (dispatch work sessions) |
| `agents.message(agent, msg)` | Fire-and-forget, triggers heartbeat | **No** | Cross-agent messaging |
| `workflow.run(name, task)` | Runs predefined step sequences using `ctx.runAgent()` | **Yes** (each step) | Coach, tech-lead |
| `Promise.all()` in workflows | Run multiple `ctx.runAgent()` calls in parallel | **No** (within workflow) | `verify-parallel`, `implement-and-adversarial-review` |

### Key Observation: `Promise.all()` Already Works

The `verify-parallel` and `implement-and-adversarial-review` workflows already demonstrate parallel agent execution:

```typescript
// From implement-and-adversarial-review.ts
const [review, audit] = await Promise.all([
  ctx.runAgent("qa", qaTask),
  ctx.runAgent("qa", auditorTask),
]);
```

This runs two QA sessions simultaneously and collects both results. The workflow infrastructure (`WorkflowContext.runAgent`) supports this natively — `Promise.all()` just works because `runAgent` returns a `Promise<TaskResult>`.

### What's Missing

The gap isn't in the *execution* layer — it's in the *orchestration* layer. There's no workflow pattern for:

1. Forking N research tasks in parallel (where N varies)
2. Collecting and synthesizing all results  
3. Deciding what to do next based on combined findings

The `auto-loop` workflow handles *sequential* multi-cycle research. The `research-pipeline` workflow handles a serial scout→bob chain. Neither handles "fan out N tasks, fan in results."

## Design: `parallel-research` Workflow

### Pattern: Fork-Join with Synthesis

```
┌─────────────────────────────────────────────────┐
│                 parallel-research                 │
│                                                   │
│  Phase 1: FORK (parallel)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Thread 1 │ │ Thread 2 │ │ Thread 3 │  ...N   │
│  │ (agent)  │ │ (agent)  │ │ (agent)  │         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       │             │             │               │
│  Phase 2: COLLECT                                │
│       └─────────────┼─────────────┘               │
│                     ▼                             │
│  Phase 3: SYNTHESIZE                             │
│  ┌──────────────────────────────────────┐        │
│  │ Synthesis agent reads all results,   │        │
│  │ finds cross-thread connections,      │        │
│  │ writes integrated findings           │        │
│  └──────────────────────────────────────┘        │
│                                                   │
│  Output: Synthesis doc + per-thread results      │
└─────────────────────────────────────────────────┘
```

### Workflow Implementation

```typescript
// agents/shared/workflows/parallel-research.ts

export const name = "parallel-research";
export const description = 
  "Fork N research threads in parallel, collect results, synthesize findings. " +
  "Task format: JSON with { threads: [{ task, agent? }], synthesisPrompt? }";

interface ResearchThread {
  task: string;
  agent?: string;  // defaults to caller's agent
  label?: string;  // human-readable label for tracking
}

interface ResearchInput {
  threads: ResearchThread[];
  synthesisAgent?: string;  // who synthesizes (default: "bob")
  synthesisPrompt?: string; // custom synthesis instructions
  outputDir?: string;       // where to write results
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input: ResearchInput = JSON.parse(ctx.task);
  
  if (!input.threads || input.threads.length === 0) {
    return ctx.escalate("No research threads specified");
  }
  
  const agent = input.threads[0].agent ?? "bob";
  const synthAgent = input.synthesisAgent ?? "bob";
  
  // ── Phase 1: FORK — run all threads in parallel ──────────────
  ctx.emit({ type: "step_start", step: "parallel-fork" });
  
  const threadPromises = input.threads.map((thread, i) => {
    const threadAgent = thread.agent ?? agent;
    const label = thread.label ?? `thread-${i + 1}`;
    return ctx.runAgent(threadAgent, 
      `## Research Thread: ${label}\n\n${thread.task}\n\n` +
      `Write your findings to a file. Be thorough but focused on this specific thread.`
    );
  });
  
  // All threads execute simultaneously
  const results = await Promise.all(threadPromises);
  
  // ── Phase 2: COLLECT — gather all results ────────────────────
  const threadSummaries = results.map((result, i) => {
    const label = input.threads[i].label ?? `thread-${i + 1}`;
    const status = result.status === "error" ? "FAILED" : "completed";
    const text = result.lastAssistantText ?? "(no output)";
    return `### Thread ${i + 1}: ${label} [${status}]\n${text}`;
  });
  
  const successCount = results.filter(r => r.status !== "error").length;
  
  if (successCount === 0) {
    return ctx.escalate("All research threads failed", {
      errors: results.map(r => r.error),
    });
  }
  
  // ── Phase 3: SYNTHESIZE — find cross-thread connections ──────
  const synthesisTask = input.synthesisPrompt 
    ?? `Synthesize the findings from ${successCount} parallel research threads. ` +
       `Look for cross-thread connections, contradictions, and emergent patterns.`;
  
  const synthInput = 
    `## Task: Research Synthesis\n\n` +
    `${synthesisTask}\n\n` +
    `## Thread Results\n\n${threadSummaries.join("\n\n")}\n\n` +
    `## Instructions\n` +
    `1. Summarize key findings from each thread\n` +
    `2. Identify connections between threads (shared patterns, contradictions)\n` +
    `3. Rank findings by impact/novelty\n` +
    `4. Propose next steps based on combined findings\n` +
    `5. Write synthesis to ${input.outputDir ?? "agents/bob/workspace"}/research-synthesis.md`;
  
  const synthesis = await ctx.runAgent(synthAgent, synthInput);
  
  if (synthesis.status === "error") {
    // Synthesis failed but we still have thread results
    return ctx.done(
      `## Parallel Research: ${successCount}/${input.threads.length} threads completed\n\n` +
      `Synthesis failed, but thread results are available:\n\n${threadSummaries.join("\n\n")}`
    );
  }
  
  return ctx.done(
    `## Parallel Research Complete\n\n` +
    `**Threads**: ${successCount}/${input.threads.length} completed\n\n` +
    `## Synthesis\n${synthesis.lastAssistantText}\n\n` +
    `## Individual Threads\n${threadSummaries.join("\n\n")}`
  );
}
```

### No Infrastructure Changes Required

This is the key insight: **the existing workflow infrastructure already supports parallel execution via `Promise.all()` on `ctx.runAgent()` calls.** No changes to:

- `src/lib/workflow.ts` — `WorkflowContext.runAgent` already returns `Promise<TaskResult>`
- `src/lib/workflow-tool.ts` — workflow execution is already async-native
- `src/lib/manager.ts` — `callAgent` already supports multiple concurrent sessions

The only new artifact is a workflow file: `agents/shared/workflows/parallel-research.ts`.

## Example Usage: Bob Running 3 Research Threads

### Scenario: Bob's heartbeat finds 3 research topics

```
// In bob's heartbeat or work session:
workflow.run("parallel-research", JSON.stringify({
  threads: [
    {
      label: "H-091 validation",
      task: "Analyze EXP-097 and EXP-098 results for hypothesis H-091 (collaborative " +
            "verification improves with role separation). Check if 15/15 pass rate is " +
            "statistically significant vs. baseline. Read agents/shared/knowledge/hypotheses/H-091*.md " +
            "and write findings to agents/bob/workspace/h091-analysis.md",
    },
    {
      label: "Cost model update",
      task: "Survey the last 50 sessions in may.db for cost distribution across agents. " +
            "Update the cost model in agents/shared/knowledge/entries/KE-060*.md with " +
            "latest per-agent cost data. Write analysis to agents/bob/workspace/cost-update.md",
    },
    {
      label: "Gym effectiveness review",
      task: "Compare bob's gym scores before and after the corrective signaling training " +
            "(DD-661/662/663). Pull data from agents/coach/gym/results/. Check if the " +
            "targeted training improved verification skill. Write to agents/bob/workspace/gym-review.md",
    },
  ],
  synthesisPrompt: "Cross-reference the hypothesis validation, cost data, and gym effectiveness " +
                   "to assess whether our current research investments are paying off.",
  outputDir: "agents/bob/workspace",
}))
```

### What Happens Under the Hood

1. Workflow starts → 3 bob sessions spawn simultaneously
2. Each runs independently (~3-5 minutes each, depending on complexity)
3. All 3 complete → synthesis agent reads all results
4. Synthesis agent writes cross-thread connections
5. Workflow returns combined result to the calling session

**Time**: ~5 minutes (parallel) vs ~15 minutes (serial)  
**Cost**: ~same total tokens (parallelism doesn't change work done)

## Alternative: Lightweight Fork Pattern (No Workflow)

For simpler cases where synthesis isn't needed, bob can already fork parallel sessions:

```
// In a heartbeat — fire-and-forget, no synthesis
agents.fork("bob", "Analyze H-091 against EXP-097/098. Write to agents/bob/workspace/h091-analysis.md")
agents.fork("bob", "Update KE-060 cost model from latest 50 sessions. Write to agents/bob/workspace/cost-update.md")
agents.fork("bob", "Review gym effectiveness after DD-661/662/663. Write to agents/bob/workspace/gym-review.md")
// Bob continues immediately. Results arrive asynchronously.
// Next heartbeat: read the workspace files and synthesize manually.
```

**Tradeoff**: Simpler, but no automatic collection/synthesis. Results need manual pickup.

## Risks and Mitigations

### Risk 1: Resource Contention
**Problem**: N parallel sessions consume N× the compute (LLM API calls, memory).  
**Mitigation**: Cap N at 3-5 threads. The workflow should reject inputs with >5 threads. Most research tasks naturally decompose into 2-4 threads.

### Risk 2: Context Collision
**Problem**: Parallel threads may write to the same files (e.g., both try to update INDEX.md).  
**Mitigation**: Each thread writes to its own output file. Only the synthesis step touches shared state. This is the same pattern as the existing adversarial-review workflow (QA and auditor don't share outputs).

### Risk 3: One Thread Blocks All
**Problem**: If one thread hangs, `Promise.all()` doesn't return until all resolve.  
**Mitigation**: Use `Promise.allSettled()` instead, so completed threads aren't lost:

```typescript
const settled = await Promise.allSettled(threadPromises);
const results = settled.map(s => 
  s.status === "fulfilled" ? s.value : { status: "error", error: s.reason }
);
```

Additionally, the manager already supports per-session timeouts via `callAgent({ timeout })`. We should wire that through `ctx.runAgent()` — this is the one infrastructure enhancement worth considering.

### Risk 4: Cost Amplification
**Problem**: Parallel threads are cheap individually but add up. 3 threads × $0.50 = $1.50 per invocation.  
**Mitigation**: Track cost in workflow results. Add a `maxCostPerThread` option that's checked post-completion (advisory, not enforced — we don't have pre-flight cost estimation).

### Risk 5: Synthesis Quality
**Problem**: The synthesis agent gets N threads of text — context window pressure.  
**Mitigation**: Each thread's output is truncated (via `ctx.summarize()`) before being passed to synthesis. Threads should write detailed results to files; only summaries flow into synthesis. This matches the existing `research-pipeline` pattern (scout writes to workspace, bob reviews).

### Risk 6: Workflow Adoption  
**Problem**: EXP-028 showed agents don't spontaneously discover workflows. Adding a workflow file doesn't mean it gets used.  
**Mitigation**: Wire it explicitly into bob's heartbeat or work session patterns. Add to `heartbeat.md` instructions: "When you have 2+ independent research tasks, use `workflow.run('parallel-research', ...)` instead of sequential forks."

## What NOT to Build

1. **Dynamic thread spawning during execution** — Keep it simple. Define all threads upfront, execute, synthesize. Dynamic spawning adds complexity without clear benefit.

2. **Thread-to-thread communication** — Threads are independent by design (same principle as adversarial audit). Cross-thread insight happens in the synthesis step, not during execution.

3. **Persistent thread state** — The `auto-loop` workflow already handles multi-cycle stateful research. `parallel-research` is for one-shot fan-out/fan-in. Don't mix the two patterns. For iterative parallel research, compose: `auto-loop` where each cycle uses `parallel-research` internally via `ctx.runWorkflow()`.

4. **Custom agent types per thread** — Threads default to "bob" (or the specified agent). Don't build a system for mixing different agent types in a single parallel-research run. If you need scout+bob, use `research-pipeline`. If you need bob+bob+bob, use `parallel-research`.

## Implementation Plan

1. **Create `agents/shared/workflows/parallel-research.ts`** (~80 lines) — The workflow implementation shown above, with `Promise.allSettled()`, input validation, and truncation.

2. **Update `agents/shared/workflows/REGISTRY.md`** — Add entry to the shared workflows table.

3. **Update `agents/bob/heartbeat.md`** — Add instruction: "When you identify 2+ independent research tasks in a single heartbeat, use `workflow.run('parallel-research', ...)` to execute them in parallel."

4. **Optional: Add timeout support to `ctx.runAgent()`** — Currently timeouts are only on `callAgent()`, not the workflow context wrapper. Threading through a `timeout` option would protect against hanging threads.

## Composability with Existing Patterns

| Pattern | Use Case |
|---------|----------|
| `parallel-research` alone | 2-5 independent research questions, one-shot |
| `auto-loop` → `parallel-research` | Multi-cycle research where each cycle fans out |
| `parallel-research` → `implement-and-review` | Research threads that produce code changes |
| `research-pipeline` → `parallel-research` | Scout deep-dive fans out into parallel analysis |

The fork-join pattern is a primitive that composes naturally with the existing workflow infrastructure through `ctx.runWorkflow()`.
