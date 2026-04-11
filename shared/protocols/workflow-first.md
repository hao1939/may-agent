# Workflow-First Execution — Core Architectural Principle

**Status**: Active — all agents must follow  
**Date**: 2025-06-09

## The Rule

> **Agents run in workflows by default. Bare execution is the exception, not the norm.**

- **Heartbeat** = autonomous triage/dispatch. Decides *what* to do.
- **Workflow** = enforced process. Ensures *how* it gets done correctly.

Agents left to freeform execution skip steps, produce meta-work instead of deliverables, and never close loops. Workflows are the mechanical enforcement that prevents that.

## When to use a workflow

| Task type | Workflow | Why |
|-----------|----------|-----|
| Any code change | `implement-and-verify` or `implement-and-review` | Hard-gates on tsc+vitest. Prevents "I'll test later" |
| Research → code | `research-to-production` | Closes the hypothesis→experiment→code→deploy loop |
| Hypothesis/synthesis/KB writing | `deliver-or-report` | Catches non-delivery and verification gaps |
| Multiple independent research questions | `parallel-research` | Fan-out + automatic cross-thread synthesis |
| Skill creation/modification | `skill-lifecycle` | Propose → test → measure → promote/retire |
| Training | `growth-cycle` or `training-sprint` | Coach's proven pipelines (100% done rate) |

## When bare execution is OK

- Quick responses (< 5 ops): answering a question, updating a todo, acknowledging a dispatch
- Pure exploration: scanning the KB, reading files to decide what to do next
- Heartbeat triage itself (the dispatch step)

**Rule of thumb**: If the task has a *deliverable* (file, code change, knowledge entry, report), it should run in a workflow.

## Why this matters — the evidence

From EXP-001 and EXP-028:
- Workflow sessions: **89% done rate, 2.6% error rate**
- Non-workflow sessions: **76% done rate, 17.6% error rate**
- When heartbeat.md instructions for `workflow.run()` were accidentally removed (EXP-028), coach done rate dropped from **85% → 34%** overnight
- LLMs will NOT spontaneously discover or use workflows. **Explicit instructions in heartbeat.md are required.**

## How to add a new workflow

1. Write the workflow in `agents/shared/workflows/<name>.ts` (or `agents/<agent>/workflows/` if agent-specific)
2. Write tests in `test/<name>.test.ts` — mock `WorkflowContext`, test all branches
3. Add it to `REGISTRY.md` with purpose and expected usage
4. **Wire it into the relevant agent heartbeat.md** — this is the critical step that EXP-028 proved necessary
5. Track effectiveness: done rate, error rate, escalation rate

## Available shared workflows

| Workflow | Input | When to use |
|----------|-------|-------------|
| `implement-and-verify` | Task description | Code changes, lightweight verification (tsc+vitest) |
| `implement-and-review` | Task description | Code changes needing QA review |
| `research-to-production` | Research finding to ship | Closing the loop: assess → build → verify → report |
| `parallel-research` | JSON with threads array | 2-5 independent research questions |
| `skill-lifecycle` | Skill proposal | Full skill lifecycle: propose → test → measure → promote |
| `auto-loop` | Task with loop config | Iterative refinement with exit conditions |
