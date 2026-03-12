# Optimizer Design

Status: **Partially implemented**. The evaluator and optimizer agents exist and run
via cron jobs. The structured staging pipeline and workflow-driven optimization loop
described below are **unimplemented proposals** — current operation uses simpler
direct cron dispatch (evaluator evaluates sessions, optimizer reads analysis and acts).

## Overview

Two agents — **evaluator** and **optimizer** — collaborate in a single workflow to continuously improve agent performance, cost, and efficiency.

- **Optimizer** analyzes and generates: spots inefficiencies, creates artifacts (scripts, workflows, prompt changes), proposes model swaps
- **Evaluator** validates: benchmarks generated artifacts against past tasks, scores results, promotes or rejects

Neither judges its own output.

## Optimization Targets

| Target | What changes | What's measured |
|---|---|---|
| Model selection | model ID per agent per task type | quality delta, cost delta, latency |
| Prompt trimming | remove unused lessons/sections | quality delta, token savings |
| Script generation | new skill script in agent's skills dir | efficiency (fewer tool calls), quality |
| Workflow generation | new workflow `.ts` file | efficiency, cost per task |

## Data Sources

- `.state/evaluations/*.json` — per-session scores, corrections, patterns
- `.state/sessions/` — full transcripts (token usage, tool call counts)
- Agent configs — system prompts, models, tools, skills
- Model pricing — token counts × price per model (config or hardcoded table)

## Optimization Workflow

A single scheduled workflow orchestrates both agents:

```ts
// workflows/optimize.ts
export const name = "optimize";
export const description = "Periodic optimization: analyze, generate, validate";

export async function run(ctx) {
  // Step 1: Optimizer analyzes and generates
  const analysis = await ctx.runAgent("optimizer",
    "Analyze recent evaluations. Identify top 3 optimization opportunities. Generate artifacts.");

  // Step 2: Evaluator validates what optimizer produced
  const verdict = await ctx.runAgent("evaluator",
    `Benchmark these staged artifacts against recent successful tasks:\n${analysis}`);

  // Step 3: Optimizer reads verdict, applies or iterates
  const result = await ctx.runAgent("optimizer",
    `Evaluator verdict:\n${verdict}\nPromote passing artifacts, discard failures, report.`);

  return { status: "done", summary: result };
}
```

## Staging Pipeline

```
Optimizer generates
  → .state/staged/workflows/
  → .state/staged/skills/
  → .state/staged/proposals/   (model changes, prompt diffs)

Evaluator benchmarks
  → pass: move to agents/<name>/workflows/ or agents/<name>/skills/
  → fail: move to .state/rejected/ with data
  → unclear: flag for human review
```

## Scope Split

| Agent | Creates | Validates | Applies |
|---|---|---|---|
| Evaluator | lessons, corrections | staged artifacts | promotes or rejects with data |
| Optimizer | workflows, scripts, model/prompt proposals | — | stages only |

## Trigger

Periodic — runs after every N evaluations accumulate (configured in runner, same pattern as maintenance). Can also be triggered manually.

## Experiment Execution

For model swap experiments, the optimizer can use git worktree on the agents repo:

1. Create branch with config change (e.g., different model for coder)
2. Run benchmark tasks against branch config
3. Collect results via evaluator
4. Compare against baseline (main branch results)
5. If improvement meets threshold → propose merge with data

## What Evaluator Already Does (unchanged)

- Post-session: score, detect corrections, extract lessons, stage workflow suggestions
- Periodic maintenance: prune lessons, flag stale knowledge

## What Optimizer Does (new)

- Analyze cost/performance trends across evaluations
- Identify repetitive multi-step patterns → generate skill scripts
- Identify task types where cheaper models might work → propose model swaps
- Read evaluator verdicts → promote/discard staged artifacts
- Produce optimization reports with data
