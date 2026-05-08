---
id: scout-second-brain-learning
owner: scout
status: active
type: milestone
priority: P2
workflow: project
iteration: 0
---

# Project: Scout Second Brain Learning

**Status**: active
**Iteration**: 4
## Goal

Learn from `eugeniughelbur/obsidian-second-brain` and adapt the smallest useful
set of knowledge-base practices that make scout findings easier to maintain,
reuse, and turn into system improvements.

## Current State
Iteration 4. Milestones: 5/5 done.
Reviewer: 1. **I believe**: All 5 milestones of this project have been successfully completed, verified, and the changes committed. The worker has outputted a signal that it is ready for review.
2. **I'm uncert
## Context

Reference repo:
- https://github.com/eugeniughelbur/obsidian-second-brain

Initial hypothesis:
- The repo's useful ideas are not "use Obsidian"; they are knowledge operations:
  update existing notes instead of creating duplicates, keep source-grounded
  research notes, run vault-health checks, reconcile contradictions, and keep
  compact agent-readable context.
- Scout should pilot the practices inside `agents/scout/knowledge/` first.
  Only generalize to shared knowledge after evidence that the pilot helps.

## Metrics

- `scout.sourced-artifacts-24h`: should remain healthy without creating shallow duplicate files.
- `scout.good-session-rate-24h`: should improve as scope becomes more concrete.
- `scout.operational-friction-rate-24h`: should recover by reducing finish blocks, schema errors, and broad git/add churn.
- `scout.downstream-reference-files-7d`: should stay healthy or improve as findings become easier for other agents to reuse.

## Milestones

- [x] Read the repo README and map the main knowledge-base practices to our agent system.
- [x] Write `agents/scout/knowledge/obsidian-second-brain-patterns.md` with: applicable ideas, non-applicable ideas, risks, and a smallest pilot.
- [x] Pick 2-3 practices for a scout-only pilot. Prefer practices that reduce duplicate notes and improve downstream reuse.
- [x] Apply the pilot to 3-5 recent scout knowledge artifacts.
- [x] Review metrics and downstream references after the pilot; decide whether to keep, adjust, or discard the practices.

## Resources

- `agents/scout/knowledge/INDEX.md`
- `agents/scout/knowledge/`
- `agents/scout/workspace/findings/`
- `agents/shared/may-agent-docs/metrics.md`
- `agents/scout/heartbeat.md`

## Constraints

- Do not redesign the whole shared knowledge system in one pass.
- Do not create many new files when updating an existing note would be clearer.
- Use real source evidence from the GitHub repo. If network access fails, record the blocker and use the provided URL as the next action.
- Prefer concise, agent-readable notes with clear "actionable implication" sections.

## Artifacts
- outputs/pilot-practices-selection.md
- outputs/pilot-practices.md
- outputs/ready-for-review.md
- outputs/pilot-review.md
