# Feature: Rich Current State

## What
The reviewer's synthesis becomes the Current State, replacing the mechanical "Iteration N. Milestones: X/Y done." summary. Current State carries accumulated understanding between iterations.

## Why
Workers start each iteration reading Current State. If it says "Iteration 13. Milestones 0/0" they have no context. If it says "Rate improved 0.19→0.56, stalled because May ignores breadcrumbs, next: measure after heartbeat rewrite" they can act immediately.

## Evidence
Manual test on breadcrumb-gap project:
- Mechanical Current State → 6 iterations of confused documentation work
- Rich Current State → 1 iteration of focused measurement + action
See: breadcrumb-gap journal iterations 8-13 (baseline) vs iteration 19 (treatment)

## How It Works
After reviewer says CONTINUE, the workflow writes Current State as:
```
Iteration N. Milestones: X/Y done.
Reviewer: <reviewer's key insight, truncated to 200 chars>
```

Implementation: agents/shared/workflows/project.ts — the reviewer's `decision.detail` is included in the updateSection call for Current State.

## How to Enable
Already enabled globally (code change merged). All projects get the reviewer's synthesis in Current State.

## How to Measure
- Compare iteration efficiency: do workers need fewer iterations to reach milestones?
- Compare stall-rate: does the rate of "no progress" iterations decrease?
- Qualitative: read worker outputs — do they show awareness of prior context?

## How to Revert
Revert the updateSection call in project.ts to the mechanical version:
```
`Iteration ${iteration}. Milestones: ${ms.done}/${ms.total} done. Next: ${nextMilestone}`
```

## Status
Implemented. Monitoring.
