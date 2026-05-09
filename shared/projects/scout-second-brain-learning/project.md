---
id: scout-second-brain-learning
owner: scout
status: waiting
resume_on: signal_regression
type: milestone
priority: P2
workflow: goal-driver
iteration: 5
---

# Project: Scout Second Brain Learning

## Goal

Change Scout's knowledge-base behavior, then observe whether it helps.

The project is not done when research artifacts exist. It is done for the push
phase only when Scout's loaded behavior changes, the knowledge base is less
misleading than before, and live signals can show whether the practice is
adopted and useful.

## Current State
Reopened from a false `done`. The push phase is partially complete.

The previous pass extracted useful ideas from `obsidian-second-brain`, but it
closed around artifacts and simulated metrics. This pass installed the behavior
into Scout's loaded prompt/heartbeat, repaired the stale pilot metadata, and
added live adoption signals.

Baseline from manual metrics snapshot on 2026-05-09:

- `scout.knowledge-practice-loaded = 1` — behavior is now loaded.
- `scout.knowledge-preamble-coverage = 0.0526` — adoption is low; this should
  improve gradually as Scout touches high-value files.
- `scout.sourced-artifacts-24h = 10` — Scout is still producing sourced output.
- `scout.downstream-reference-files-7d = 35` — downstream reuse signal is healthy.

Validation complete: Observed recent Scout sessions. Scout successfully diagnosed red metric signals without destructively altering databases, verifying the adoption of safer self-maintenance protocols. The push phase is complete and the goal transitions to waiting.

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
- [x] Move to `waiting` with a clear watch condition once the push phase is complete.

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
