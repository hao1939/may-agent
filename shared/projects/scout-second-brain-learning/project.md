---
id: scout-second-brain-learning
owner: scout
status: active
type: milestone
priority: P2
workflow: goal-driver
iteration: 7
stop_reason:
resume_condition:
---

# Project: Scout Second Brain Learning

## Goal

Change Scout's knowledge-base behavior, then observe whether it helps.

The project is not done when research artifacts exist. It is done for the push
phase only when Scout's loaded behavior changes, the knowledge base is less
misleading than before, and live signals can show whether the practice is
adopted and useful.

## Current State
Actively correcting validation failures from the first real heartbeat after the
behavior install.

Scout did run a non-project heartbeat after the baseline and did touch existing
knowledge files, which is a positive signal. However, the same heartbeat also
created a ceremonial `scout-metric-dismissal-2026-05-09` project and described
`scout.knowledge-preamble-coverage` as a dismissible metric. That is the wrong
behavior: preamble coverage is a real adoption signal, not a false-positive
alert to dismiss.

Current push: remove the bogus dismissal project, tighten heartbeat guidance so
metric alert judgments do not become fake projects, then run another Scout
heartbeat to verify the behavior is cleaner.

Baseline from manual metrics snapshot on 2026-05-09:

- `scout.knowledge-practice-loaded = 1` — behavior is loaded.
- `scout.knowledge-preamble-coverage = 0.0526` — adoption is low and should
  improve gradually as Scout touches high-value knowledge files.
- `scout.sourced-artifacts-24h = 10` — sourced output is healthy.
- `scout.downstream-reference-files-7d = 35` — downstream reuse signal is healthy.

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

## Signals

- `scout.knowledge-practice-loaded`: should be 1. Confirms Scout's loaded
  prompt/heartbeat contain the knowledge-management behavior.
- `scout.knowledge-preamble-coverage`: should rise over time as Scout touches
  high-value knowledge files. Do not bulk-edit just to game it.
- `scout.sourced-artifacts-24h`: should remain healthy without creating shallow duplicate files.
- `scout.downstream-reference-files-7d`: should stay healthy or improve as findings become easier for other agents to reuse.
- `scout.good-session-rate-24h` and `scout.operational-friction-rate-24h`: weak
  secondary signals only; judge them with evaluator calibration context.

## Plan

- [x] Read the repo README and map the main knowledge-base practices to our agent system.
- [x] Write `agents/scout/knowledge/obsidian-second-brain-patterns.md` with: applicable ideas, non-applicable ideas, risks, and a smallest pilot.
- [x] Pick 2-3 practices for a scout-only pilot. Prefer practices that reduce duplicate notes and improve downstream reuse.
- [x] Apply the pilot to 3-5 recent scout knowledge artifacts.
- [x] Propose a Scout-scoped implementation using Scout's heartbeat and loaded prompt.
- [x] Install the Scout-scoped behavior in `agents/scout/AGENTS.md` and `agents/scout/heartbeat.md`.
- [x] Repair misleading pilot edits and standardize the touched preambles.
- [x] Add live metrics that reveal behavior installation/adoption instead of relying on simulated gains.
- [x] Run a metrics snapshot and record the baseline values in this project.
- [x] Observe at least one subsequent Scout session and judge whether it searched/updated existing knowledge before creating new files.
- [ ] Fix the heartbeat prompt gap that caused Scout to create a ceremonial metric-dismissal project.
- [ ] Observe one subsequent Scout heartbeat after the prompt fix.
- [ ] Move to `waiting` with a clear watch condition once the prompt fix is verified.

## Watch Conditions

- Reactivate after Scout completes a real knowledge-producing heartbeat/project
  after the 2026-05-09 baseline.
- Reactivate immediately if `scout.knowledge-practice-loaded < 1`.
- Reactivate if `scout.knowledge-preamble-coverage` stays below threshold after
  Scout touches knowledge files; fix adoption through normal high-value edits,
  not bulk metric gaming.
- Reactivate if `scout.downstream-reference-files-7d` drops below threshold.

## Acceptance Criteria

- Scout's loaded prompt tells it to search existing knowledge first, update in
  place when possible, and keep source-grounded `<ai_context>` preambles.
- The project uses live metrics as signals, not simulated metrics as proof.
- At least one real future Scout session demonstrates the behavior, or the
  project records why it failed and what to fix next.
- The project returns to `waiting` when there is no concrete next push, with a
  resume condition tied to signal regression or failed adoption.

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
- Do not claim gain from simulated metrics. If a signal is not available yet,
  create the simplest useful signal or record the gap.

## Artifacts
- outputs/knowledge-operations-guide.md
- outputs/pilot-practices-selection.md
- outputs/pilot-guidelines.md
- outputs/pilot-practices.md
- outputs/ready-for-review.md
- outputs/pilot-review.md
- outputs/final-summary.md
- outputs/ready-for-review-flag.md
- outputs/wrap-up.md
- outputs/agent-second-brain-guidelines.md
- outputs/ai-first-preamble-pilot.md
