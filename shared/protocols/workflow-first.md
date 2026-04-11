# Workflow-First Execution — Core Architectural Principle

**Status**: Active  
**Date**: 2025-06-09

## The Idea

> **Workflows lift the burden of orchestration so agents can focus on meaningful work.**

- **Heartbeat** = autonomous triage/dispatch. Decides *what* to do.
- **Workflow** = handles the mechanical overhead. Makes sure loops get closed without the agent having to track it.

Agents are free to do anything — explore, research, build, experiment. Workflows aren't restrictions. They're scaffolding that handles the tedious parts: "did you compile?", "did tests pass?", "did you report back?" Without them, agents have to remember all that ceremony themselves, and inevitably some steps get dropped — not because agents are lazy, but because the interesting work pulls attention away from the mechanical steps.

## What workflows handle for you

| Overhead that workflows absorb | Without workflow |
|-------------------------------|-----------------|
| Compilation check after code changes | Agent has to remember to run tsc |
| Test execution after implementation | Agent has to remember which tests |
| Reporting results back to caller | Agent finishes and forgets to report |
| Retry logic on transient failures | Agent gives up or doesn't notice |
| Cross-phase handoffs (research → code → verify) | Agent writes analysis but never ships |

## Available workflows

| Task type | Workflow | What it handles for you |
|-----------|----------|------------------------|
| Any code change | `implement-and-verify` or `implement-and-review` | Compilation, tests, optional QA review |
| Research → code | `research-to-production` | The full loop: assess → build → verify → report |
| Multiple research questions | `parallel-research` | Fan-out, independent exploration, cross-thread synthesis |
| Skill creation/modification | `skill-lifecycle` | Propose → test → measure → promote/retire |
| Training | `growth-cycle` or `training-sprint` | Coach's structured pipelines |
| Iterative refinement | `auto-loop` | Repeated attempts with exit conditions |

## When you don't need a workflow

Lots of valuable work doesn't need orchestration overhead:

- **Exploration**: scanning the KB, reading code, building understanding
- **Quick tasks**: answering a question, updating a doc, triaging
- **Creative work**: brainstorming, hypothesis generation, synthesis writing
- **Ad-hoc investigation**: debugging, reading logs, tracing issues

**Simple heuristic**: If the task involves code that should compile and pass tests, or a multi-phase process where forgetting a step would waste the work, use a workflow. Otherwise, just do the work.

## Why this matters — the evidence

From EXP-001 and EXP-028:
- Workflow sessions: **89% done rate, 2.6% error rate**
- Non-workflow sessions: **76% done rate, 17.6% error rate**
- When heartbeat.md instructions for `workflow.run()` were accidentally removed (EXP-028), coach done rate dropped from **85% → 34%** — not because coach forgot how to coach, but because the mechanical verification steps got skipped
- LLMs won't spontaneously discover workflows exist. **Instructions in heartbeat.md are needed.**

The key insight: the 34% crash wasn't a competence problem. Coach was still doing good work. It just wasn't closing loops — verifying, reporting, committing. Workflows handle that so the agent doesn't have to.

## How to add a new workflow

1. Write the workflow in `agents/shared/workflows/<name>.ts` (or `agents/<agent>/workflows/` if agent-specific)
2. Write tests in `test/<name>.test.ts` — mock `WorkflowContext`, test all branches
3. Add it to `REGISTRY.md` with purpose and expected usage
4. Wire it into the relevant agent heartbeat.md — this is how agents discover it
5. Track effectiveness: done rate, error rate, escalation rate

## Shared workflow registry

| Workflow | Input | Purpose |
|----------|-------|---------|
| `implement-and-verify` | Task description | Handles tsc+vitest checks after code changes |
| `implement-and-review` | Task description | Same + QA review phase |
| `research-to-production` | Research finding to ship | Closes the assess → build → verify → report loop |
| `parallel-research` | JSON with threads array | Independent exploration of 2-5 questions |
| `skill-lifecycle` | Skill proposal | Full lifecycle: propose → test → measure → promote |
| `auto-loop` | Task with loop config | Iterative refinement with configurable exit conditions |
