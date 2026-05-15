# Feature: Smart Context Generation

## What
Instead of always building the same worker prompt, adapt the context based on the project's situation. Different iterations need different context.

## Why
Current prompt dumps everything: goal, milestones, current state, resources, process notes, guidance, recent history. For iteration 1 this is right. For iteration 10 where the worker is stuck on the same milestone, most of this is noise — they need focused "what to try differently."

## Observation
The breadcrumb-gap experiment showed: when Current State carried accumulated understanding (what worked, what failed, what to try), the worker produced better output in fewer iterations. The KEY context was the synthesis, not the raw data.

## Hypothesis
The worker prompt should adapt based on project state:
- Early iterations → more context (goal, resources, full milestones)  
- Mid-project → focused context (current state, guidance, next milestone)
- Stuck → investigation context (what was tried, what failed, resources to explore)

## Experiment Design

### Phase 1: Measure baseline
For 3-5 active projects, record for each iteration:
- Prompt size (tokens)
- Which sections were in the prompt
- Worker outcome (productive vs confused vs no-op)
- Iterations per milestone

### Phase 2: Test "focused" generator
For one project, change the prompt to include ONLY:
- Current State (reviewer synthesis)
- Owner Guidance
- Next milestone
- Process Notes (if any)

Drop: full milestone list, recent journal, resources (worker can read these if needed).

Run 3-5 iterations. Compare to baseline: fewer confused iterations? Faster milestone completion?

### Phase 3: Test "reviewer-directed" context
Let the reviewer specify what the next worker needs:
```
CONTINUE — worker needs investigation context. Include full resources section.
```
or:
```
CONTINUE — simple mechanical fix. Minimal context, just the guidance.
```

The workflow parses this hint and adjusts the prompt accordingly.

## How to Enable
Add to `## Process Notes` of the test project:
```
Context: focused (only current state + guidance + next milestone)
```

The workflow reads this and adjusts buildWorkerPrompt accordingly.

## How to Measure
- Iterations per milestone (fewer = better)
- Worker confusion rate (no-op or repeated work = confused)
- Prompt tokens per iteration (smaller = more efficient)

## How to Revert
Remove the Process Notes line. Workflow falls back to full-dump (current behavior).

## Status
Not started. Needs Phase 1 baseline measurement first.

## Open Questions
- Should the reviewer explicitly choose context level, or should it be automatic?
- Is "focused" always better for mid-project, or does it depend on the domain?
- Does reducing context make workers miss important constraints?
