---
id: scout-second-brain-learning
owner: scout
status: waiting
type: milestone
priority: P2
iteration: 8
wait_reason: sourced-artifacts-24h=0 is an activity gap (no recent Scout knowledge session), not a behavior regression. Behavior install remains intact. Resume only if behavior regresses or adoption stalls across multiple consecutive sessions.
migrated_to: scout-knowledge-lib.app
---

# Project: Scout Second Brain Learning

Migration note, 2026-06-12: the durable Scout knowledge library has been
extracted to `projects/scout-knowledge-lib/`, with May-agent control-plane state
in `projects/scout-knowledge-lib.app/`. This historical project remains as
context for why the library practices exist.

## Goal

Change Scout's knowledge-base behavior, then observe whether it helps.

The project is not done when research artifacts exist. It is done for the push
phase only when Scout's loaded behavior changes, the knowledge base is less
misleading than before, and live signals can show whether the practice is
adopted and useful.

## Current State

Waiting after a clean validation heartbeat.

The first real heartbeat after the behavior install was mixed: Scout touched
existing knowledge files, but also created a ceremonial metric-dismissal project
and treated `scout.knowledge-preamble-coverage` as dismissible. That prompt gap
was fixed.

The next real Scout heartbeat, session `s_1778329915911_13`, behaved better:
it used live metrics, improved existing knowledge files, committed the work in
`47991bc2a`, read files back after guard feedback, and did not create another
fake metric-dismissal project. The adoption metric moved from `0.1404` to
`0.2281`. It is still below threshold, but that is acceptable here because this
project's goal is behavior change with observable gain, not bulk-editing the
knowledge base until a ratio turns green.

Baseline from manual metrics snapshot on 2026-05-09:

- `scout.knowledge-practice-loaded = 1` — behavior is loaded.
- `scout.knowledge-preamble-coverage = 0.0526` — adoption is low and should
  improve gradually as Scout touches high-value knowledge files.
- `scout.sourced-artifacts-24h = 10` — sourced output is healthy.
- `scout.downstream-reference-files-7d = 35` — downstream reuse signal is healthy.

2026-05-21 runtime fix: the Scout watch metrics are now first-class
`metrics-snapshot` built-ins. `project-steward` also treats disabled, missing,
or stale project-scoped watch metrics as `project.health.finding`, so this
waiting project wakes when its watch contract stops being observable.

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
- [x] Fix the heartbeat prompt gap that caused Scout to create a ceremonial metric-dismissal project.
- [x] Observe one subsequent Scout heartbeat after the prompt fix.
- [x] Move to `waiting` with a clear watch condition once the prompt fix is verified.

## Watch Conditions

These are owner-checked conditions (no formal watch metrics required):

- Reactivate immediately if Scout's AGENTS.md or heartbeat.md lose the knowledge-management behavior.
- Reactivate if Scout creates another ceremonial metric-dismissal project.
- Reactivate if preamble coverage stops improving across real Scout knowledge-producing sessions.
- Reactivate if downstream reuse of Scout knowledge files visibly degrades.

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

## Journal

2026-05-09:

- Installed Scout knowledge-management behavior and live metrics.
- First live validation found a real prompt failure: Scout created a ceremonial
  metric-dismissal project for a real adoption signal.
- Fixed the prompt gap in Scout heartbeat guidance and shared heartbeat prompt
  construction.
- Re-ran a real Scout heartbeat. Session `s_1778329915911_13` updated existing
  knowledge files, committed `47991bc2a`, recovered from guard feedback, and
  finished successfully.
- `scout.knowledge-preamble-coverage` improved from `0.1404` to `0.2281`; leave
  the project waiting and let normal Scout work continue adoption gradually.
  - Snapshot 2026-05-09 (later): `scout.knowledge-preamble-coverage` is `0.2982`.

2026-05-11:

- Migrated the waiting project from experimental `goal-driver` back to the
  default `project` workflow. The behavior-change push is complete; future
  resumes should use the normal project driver.
