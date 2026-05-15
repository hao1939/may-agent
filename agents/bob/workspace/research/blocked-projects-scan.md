# Blocked Projects Scan — 2026-04-22

## Purpose
Identify blocked projects as experiment candidates (per Hao's guidance: blocked projects are ideal test beds — zero downside).

## Blocked/Stalled Projects (>50 consecutive skips)

| Project | Owner | Skips | Blocker |
|---------|-------|-------|---------|
| agent-cli-research | bob | 14 | No API keys configured |
| auto-resume | tech-lead | 56 | Unknown — needs investigation |
| instruction-following | coach | 236 | Done (status mismatch?) |
| context-learning-impl | bob | 227 | Unknown |
| process-automation | optimizer | 296 | Unknown |
| cron-consolidation | optimizer | 298 | Unknown |
| workflow-first | optimizer | 298 | Unknown |
| context-learning | bob | 298 | Unknown |
| reviewer-effectiveness | bob | 298 | Unknown |
| agent-autonomy | coach | 298 | Unknown |
| project-tracking-db | tech-lead | 298 | Unknown |
| metric-reactivity | may | 298 | Unknown |
| guard-friction-analysis | may | 298 | Unknown |

## Best Experiment Candidates

### Tier 1: Recently blocked (might be recoverable)
- **agent-cli-research** (14 skips) — Blocked on API keys. External dependency, not useful for milestone scoping test.
- **auto-resume** (56 skips) — Needs investigation. Could test milestone auto-scope if reactivated.

### Tier 2: Long-stalled but potentially useful
- **context-learning-impl** (227 skips) — Could restart with auto-scoped milestones as treatment group.
- **process-automation** (296 skips) — Optimizer project, could test interventions.

### Recommendation
Use **context-learning-impl** or **auto-resume** as test beds for the milestone auto-scope experiment. They're already stalled, so testing a new approach has zero downside.
