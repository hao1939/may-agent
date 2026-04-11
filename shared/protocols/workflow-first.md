# Workflows — Learned Capabilities for Agent Systems

**Status**: Active  
**Date**: 2025-06-09

## The Idea

> **Workflows are proven techniques, captured so agents can handle increasingly complex problems.**

Every workflow started as an idea. Someone noticed a problem — agents forgetting to verify, research never shipping, multi-step processes losing coherence. We experimented, evaluated, and when a technique worked, we crystallized it into a workflow.

This means:
- **Workflows lift orchestration burden** so agents focus on the meaningful work — the thinking, building, and problem-solving.
- **Each workflow solves a specific problem well.** We match the right technique to the right situation, not one-size-fits-all.
- **The library grows over time.** New ideas get tried, evaluated, and if they work, added. The system accumulates capability.
- **Agents get stronger as the library grows.** More proven patterns means agents can tackle problems of increasing complexity — eventually handling things better than any individual could, because the workflows encode collective experience.

## Agents serve the protocol — and benefit from it

Every agent both **contributes to** and **benefits from** the workflow library:

| Agent | How they serve the protocol | How they benefit |
|-------|---------------------------|-----------------|
| **Bob** | Discovers new techniques through research, builds new workflows | Workflows handle the compile/test/report overhead so he focuses on building |
| **Tech-Lead** | Hardens workflows into reliable, tested code; reviews quality | Workflows ensure nothing ships without verification — less cleanup later |
| **Coach** | Uses workflows to structure training; surfaces where agents struggle | Training workflows give structured completion tracking for free |
| **Optimizer** | Measures workflow effectiveness, tunes and evolves them | Measurement data tells him exactly where to focus optimization effort |

This creates a virtuous cycle: Bob builds something new → Tech-Lead makes it solid → Coach uses it to train → Optimizer measures and improves it → everyone benefits from the improved version. Each agent's work makes every other agent more capable.

## How workflows help

Workflows handle the mechanical overhead that's easy to forget when you're focused on the interesting work:

| What workflows absorb | Without workflow |
|----------------------|-----------------|
| Compilation check after code changes | Agent has to remember to run tsc |
| Test execution after implementation | Agent has to remember which tests |
| Reporting results back to caller | Agent finishes and forgets to report |
| Retry logic on transient failures | Agent gives up or doesn't notice |
| Cross-phase handoffs (research → code → verify) | Agent writes analysis but never ships |

## The workflow lifecycle

Every workflow follows this path:

```
Idea → Experiment → Evaluate → Keep or Kill
```

1. **Spot a problem**: agents keep failing at X, or a specific task type has low done rates
2. **Hypothesize a technique**: "If we structure this as phases A → B → C, the mechanical steps won't get dropped"
3. **Build and test it**: implement as a workflow, write tests, try it in practice
4. **Evaluate with evidence**: did done rates improve? did error rates drop? did agents produce better work?
5. **Keep or kill**: if it works, add to the library and wire into agents. If not, document why and move on.

Each technique is good at specific things. `implement-and-verify` is great for code changes but overkill for writing a doc. Knowing when to use which is part of the system's growing intelligence.

## Current workflow library

| Task type | Workflow | What problem it solves |
|-----------|----------|----------------------|
| Any code change | `implement-and-verify` / `implement-and-review` | Forgetting to compile/test after changes |
| Multiple research questions | `parallel-research` | Sequential bottleneck when questions are independent |
| Skill creation | `skill-lifecycle` | Skills that launch without measurement |
| Training | `growth-cycle` / `training-sprint` | Unstructured training with no completion tracking |

## When you don't need a workflow

Lots of valuable work is just... work. No orchestration overhead needed:

- **Exploration**: scanning the KB, reading code, building understanding
- **Quick tasks**: answering a question, updating a doc, triaging
- **Creative work**: brainstorming, hypothesis generation, synthesis
- **Investigation**: debugging, reading logs, tracing issues

**Simple heuristic**: If forgetting a mechanical step (compile, test, report) would waste the work, use a workflow. Otherwise, just do the work.

## Evidence that this works

From EXP-001 and EXP-028:
- Workflow sessions: **89% done rate, 2.6% error rate**
- Non-workflow sessions: **76% done rate, 17.6% error rate**
- When workflow instructions were accidentally removed (EXP-028), done rate dropped **85% → 34%** — not because the agent forgot how to do the work, but because the mechanical closure steps got skipped

The 34% crash proves the point: the agent was still competent. It just didn't have the scaffolding to handle the boring parts. Workflows give it that.

## The Enforcement Principle

> **When agents repeatedly fail at something, the fix is never "remind them harder." It's either teach them to use an existing workflow, or build a workflow that mechanically prevents the failure.**

This is the system's core quality enforcement mechanism:

```
Agent keeps failing at X
  → Does a workflow already handle X? → Wire it into their heartbeat
  → No workflow exists? → Can we build one with reasonable effort?
    → Yes → Build it, test it, wire it in
    → No → This is a genuine capability gap, not a process gap
```

**Why this works:** Workflows are executed by the runtime, not remembered by the agent. An agent doesn't need to "remember to compile" — `implement-and-verify` compiles for them. An agent doesn't need to "remember to write findings" — `verify-wrap` enforces it.

**Evidence from our system (72h window):**

| Agent | Manual quality | Workflow quality | Δ |
|-------|---------------|-----------------|---|
| coach | 3.4 | 4.3 | **+0.9** |
| tech-lead | 3.6 | 4.3 | **+0.7** |

Wasted calls drop to near-zero with workflows. The agent is equally competent — but the workflow handles the mechanical parts that are easy to forget under cognitive load.

**This means:** Every heartbeat should map work types → workflows. "Should I use a workflow?" is the wrong question. "Which workflow fits?" is the right one. Only skip workflows for trivially small tasks (< 5 ops).

## Adding new workflows

When you spot a new problem that a workflow could solve:

1. Write the workflow in `agents/shared/workflows/<name>.ts`
2. Write tests in `test/<name>.test.ts`
3. Add it to `REGISTRY.md` — what problem it solves, when to use it
4. Wire it into the relevant agent heartbeat.md so agents know it exists
5. **Measure**: track done rate, error rate before and after. Keep or kill based on evidence.

## Shared workflow registry

| Workflow | Input | Problem it solves |
|----------|-------|-------------------|
| `implement-and-verify` | Task description | Handles compile+test verification after code changes |
| `implement-and-review` | Task description | Same + QA review phase |
| `parallel-research` | JSON with threads array | Independent exploration of 2-5 questions in parallel |
| `skill-lifecycle` | Skill proposal | Full lifecycle: propose → test → measure → promote |
