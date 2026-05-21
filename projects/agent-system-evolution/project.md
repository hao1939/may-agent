---
id: agent-system-evolution
owner: may
status: active
type: milestone
priority: P1
iteration: 0
project_policy: aggressive-push
max_concurrent: 2
max_task_attempts: 2
---

# Project: Agent System Evolution

## Goal

Learn, experiment with, and validate agent harness techniques that improve how
agents act, report evidence, evaluate work, coordinate, and safely adapt.

This project owns the agent-system harness R&D lane: turning observed behavior
gaps into testable harness ideas, running bounded experiments, defining
behavioral contracts, and promoting proven techniques into agent conventions or
platform-facing implementation requests.

It does **not** own platform/runtime implementation directly. When a validated
harness technique needs SDK, event, persistence, UI, or runtime support, this
project should produce a clear platform request with acceptance criteria and
validation signals.

## Coupling Contract

Projects should remain loosely coupled.

- Use **metrics** to expose system conditions that need attention.
- Use **events** to publish structured facts and trigger owner loops.
- Use **project comments** to request work from another project owner.
- Use **tasks** to make accepted work concrete inside the receiving project.
- Use **SDK/platform APIs** as the shared contract; do not depend on another
  project's private files or transient state.

Cross-project flow should look like this:

```text
agent-system-evolution observes need
  -> defines harness contract or experiment
  -> emits metric/event or comments on platform
  -> platform owner accepts/rejects/splits into platform tasks
  -> platform ships infra contract
  -> evolution project consumes the contract
```

No project should silently mutate another project's control plane.

## Signals

- `project.health.finding-count` — project-system health signals visible to owners.
- `session.failed-triage-rate-3h` — evaluator coverage or triage quality may need attention.
- `projects/evaluator-receipt-coverage/project.md` — structural receipt coverage validation is closed; reopen receipt work only for quality/regression experiments, not basic persistence.
- `learning.feedback` events — actionable feedback that should influence agent behavior.
- `project-creative-audit` outputs — proposal-only signals for missing or surprising project issues.
- Comments from platform or domain projects requesting evolution work.
- Human owner directive on 2026-05-21: keep this R&D lane moving when plausible harness experiments remain; turn ideas into bounded experiment cards and validation tasks.

## Current State

Active: boundary project has been reframed as the agent harness R&D lane.
Evaluator self-improvement, strategy-extractor calibration, and false-good
calibration have been merged here as evaluator learning/calibration lanes.

The structural receipt signal has completed its first loop: this project drafted
the harness contract, platform implemented canonical `session.receipt`
persistence, and `projects/evaluator-receipt-coverage/project.md` closed after
fresh-session coverage moved materially above baseline.

The next project posture is aggressive R&D, not passive watch. When a plausible
harness idea exists, the owner should create bounded experiment tasks that state
the hypothesis, minimal test, evidence, stop condition, and promotion path. The
current concrete frontiers are evaluator score-batch calibration, receipt
quality after persistence, project-reconcile behavior, metric auto-handler
patterns, Scout knowledge adoption, and cross-agent coordination/delegation
patterns.

## Scope

In scope:
- Agent harness techniques: evidence reporting, finish contracts, evaluation
  feedback loops, task-driving patterns, skills/prompts, routing, and safeguards.
- Bounded experiments that compare candidate harness techniques before adoption.
- Evaluation quality, calibration, feedback routing, and behavior-change policy.
- Behavioral contracts that define what platform/runtime support should provide.
- Cross-agent coordination patterns and proposal-only creative audit lanes.

Out of scope:
- Runtime/SDK/persistence/UI/container implementation details unless accepted
  as a platform task.
- Domain-specific project discovery or product-quality maps.
- Direct edits to another project's `project.md` unless that project owner has
  accepted the task.

## Related Projects

- `projects/platform/project.md` — infra substrate provider.
- `projects/evaluator-receipt-coverage/project.md` — validation tracker for structural receipt coverage.
- `projects/scout-second-brain-learning/project.md` — scout-specific learning lane.
- `projects/ruflo-learning-loop/project.md` — paused external-methodology learning loop owned by arc.
- `projects/master-worker-context-sharing/project.md` — closed split project; behavior/delegation lessons belong here, transport/runtime work belongs to platform.
- `projects/system-operations/project.md` — ops cadence, reliability watch, and routing lane.
- `projects/eval-llm-lane-restoration/project.md` — closed evaluation-infra reference, watched by system operations.
- `projects/closed-loop-reliability/project.md` — closed historical reliability-watch project.

Archived evaluator lanes:
- `projects/_archive/evaluator-self-improvement/project.md`
- `projects/_archive/evaluator-strategy-extractor-calibration/project.md`
- `projects/_archive/evaluator-false-good-calibration/project.md`

## Harness Contracts

- `contracts/structural-receipt-contract.md` — successful-session structural receipt harness contract and platform request.

## Evaluator Learning Lane

Merged from `projects/evaluator-self-improvement`.

Purpose: derive evaluator quality signals from observable session outcomes,
cross-session patterns, and comparative ranking, then use those signals to
improve evaluator calibration and agent feedback.

Artifacts:
- `outputs/evaluator/signal-heuristics.md` — v1 unsupervised quality-signal heuristics.
- `ui/evaluator-quality-panel/` — prototype quality panel for score batches.
- `outputs/evaluator/strategy-extractor/` — positive strategy extraction calibration evidence and fixture.
- `outputs/evaluator/false-good-calibration/` — false-good audit, hardening, replay, and review bundle.

Missing first-batch outputs:
- `outputs/evaluator/session-scores.jsonl`
- `outputs/evaluator/patterns.md`
- `outputs/evaluator/rubric-patches.md`

The next evaluator-learning task should produce the first bounded score batch
inside `outputs/evaluator/`, then compare those heuristic scores against recent
canonical evaluator verdicts before proposing rubric changes.

## R&D Operating Model

This is an `aggressive-push` project. It should stay active while there is a
plausible harness frontier that can be tested with a bounded artifact.

Each experiment card should include:
- Hypothesis: what behavior or system property may improve.
- Minimal experiment: the smallest artifact, prompt, workflow, metric, or
  evaluation change that can test the idea.
- Evidence: files, commands, events, metrics, or sessions that prove movement.
- Boundary: whether the outcome should become an agent convention, evaluator
  calibration, Scout behavior, project-system behavior, or a platform request.
- Stop condition: what result closes, drops, or splits the experiment.
- Promotion path: how a successful technique becomes durable system behavior.

### Strategy Extractor Calibration

Merged from `projects/evaluator-strategy-extractor-calibration`.

The immediate fix is complete: modern assistant `content[].toolCall` records are
covered by a regression fixture, and periodic strategy extraction is no longer
stuck at all-zero positive output. Remaining backlog:

- compact-success coverage,
- optimization-noise ranking,
- evaluator criteria/doc interpretation if later calibration requires it.

### False-Good Calibration

Merged from `projects/evaluator-false-good-calibration`.

The merge-ready evidence bundle is complete: audit, hardening, focused tests,
real-session replay, baseline counts, and post-merge watch query are preserved
under `outputs/evaluator/false-good-calibration/`. Remaining watch item:

- after evaluator aftermath hardening is merged/deployed, compare the same 24h
  `evaluation.false_good` / `evaluation.reviewed` /
  `evaluation.success_candidate` counts against the recorded baseline.

## Tasks

- id: establish-boundary
  goal: Establish a dedicated project boundary for agent-system evolution.
  assignee: may
  status: done
  result: succeeded

- id: inventory-projects
  result: succeeded
  attempts: 1
  goal: Inventory existing learning/evolution projects and decide which remain independent lanes versus children/references of this umbrella.
  assignee: may
  status: done
  depends_on: []

- id: first-evolution-task
  result: dropped
  attempts: 2
  goal: Define the first accepted evolution task only after a real signal or explicit owner directive.
  assignee: may
  status: done
  depends_on: [inventory-projects]

- id: merge-evaluator-calibration-lanes
  result: succeeded
  attempts: 1
  goal: Merge evaluator strategy-extractor and false-good calibration projects into the evaluator learning/calibration lane while preserving artifacts and archive redirects.
  assignee: may
  status: done
  depends_on: [inventory-projects]

- id: structural-receipt-contract
  result: succeeded
  attempts: 1
  goal: Define the successful-session structural receipt harness contract, including minimal receipt shape, persistence surface, evaluator validation signal, and platform acceptance criteria.
  assignee: may
  status: done
  depends_on: []

- id: harness-experiment-backlog
  status: done
  result: succeeded
  attempts: 1
  goal: Produce a ranked backlog of agent harness R&D experiment cards from current signals and artifacts, including evaluator scoring, receipt quality, project reconcile, metric auto-handlers, Scout knowledge adoption, and cross-agent coordination patterns.
  assignee: may
  depends_on: []

- id: evaluator-score-batch-1
  status: done
  result: succeeded
  attempts: 1
  goal: Produce the first bounded evaluator heuristic score batch under outputs/evaluator/session-scores.jsonl, compare it with recent canonical evaluator verdicts, and write patterns.md plus rubric-patches.md when evidence supports calibration changes.
  assignee: may
  depends_on: []

- id: receipt-quality-v2-audit
  status: done
  result: succeeded
  attempts: 1
  goal: Audit fresh canonical session.receipt events for evidence quality after persistence is live, then propose a v2 receipt-quality contract only if the audit finds actionable gaps.
  assignee: may
  depends_on: [harness-experiment-backlog]

- id: project-reconcile-behavior
  status: pending
  attempts: 0
  goal: Audit recent sessions for cross-project task mutations violating the coupling contract; count violations; if ≥5, draft a reconcile-on-finish convention addendum.
  assignee: may
  depends_on: []

- id: metric-auto-handler-pattern
  status: pending
  attempts: 0
  goal: Identify 3 metrics that require manual triage, define a handler spec (threshold, action, cooldown), and implement one working cron-triggered handler as a proof of concept.
  assignee: may
  depends_on: []

## Validation

- Platform project scope says learning/evolution is out of platform scope.
- This project documents the loose-coupling contract through metrics, events,
  comments, tasks, and SDK APIs.
- Existing learning/evolution projects are reachable from this project.
- Evaluator self-improvement artifacts are reachable under this project.
- Evaluator strategy-extractor and false-good calibration artifacts are reachable under `outputs/evaluator/`.
- The structural receipt task must produce a platform-facing implementation request and leave `projects/evaluator-receipt-coverage/project.md` as the validation tracker, not the implementation owner.

## Journal

### 2026-05-20 — Created boundary lane
- Created `agent-system-evolution` so platform can stay focused on infra.
- Defined the coupling rule: projects interact through metrics, events,
  comments, tasks, and platform APIs, not hard ownership across project files.

### 2026-05-20 — Merged evaluator self-improvement
- Moved evaluator signal heuristics to `outputs/evaluator/signal-heuristics.md`.
- Moved the evaluator quality-panel prototype to `ui/evaluator-quality-panel/`.
- Archived the old `projects/evaluator-self-improvement` project as a redirect.

### 2026-05-20 — Merged evaluator calibration lanes
- Moved strategy-extractor calibration artifacts to `outputs/evaluator/strategy-extractor/`.
- Moved false-good calibration artifacts to `outputs/evaluator/false-good-calibration/`.
- Archived the old evaluator calibration projects as redirects.

### 2026-05-21 — Reframed as harness R&D lane
- Reopened the project boundary because the missing structural receipt signal is a concrete harness problem, not just evaluator calibration work.
- Reframed the goal around learning, experimentation, and validation of agent harness techniques.
- Added `structural-receipt-contract` as the first accepted harness task. The implementation should be requested from platform; evaluator receipt coverage remains the validation tracker.

### 2026-05-21 — Activated aggressive R&D posture
- Structural receipt persistence and evaluator validation completed the first loop; the project should not wait on that lane.
- Set `project_policy: aggressive-push` and reopened the project with bounded experiment tasks for the broader harness R&D backlog.
- Current frontiers include evaluator score-batch calibration, receipt quality, project reconcile behavior, metric auto-handler patterns, Scout knowledge adoption, and cross-agent coordination.
