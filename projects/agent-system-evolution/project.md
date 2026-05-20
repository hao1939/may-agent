---
id: agent-system-evolution
owner: may
status: waiting
type: milestone
priority: P1
iteration: 0
max_concurrent: 1
max_task_attempts: 2
---

# Project: Agent System Evolution

## Goal

Improve how agents learn, evaluate themselves, coordinate, and safely evolve
their behavior while staying loosely coupled to the shared platform infra.

This project owns the agent-system evolution lane: learning loops, evaluation
quality, self-improvement workflows, cross-agent feedback patterns, and policy
for how agent behavior should change over time.

It does **not** own the platform substrate. When evolution work needs runtime,
SDK, event, metric, UI, or persistence changes, it should request those through
platform-facing mechanisms instead of directly taking over platform scope.

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
  -> emits metric/event or comments on platform
  -> platform owner accepts/rejects/splits into platform tasks
  -> platform ships infra contract
  -> evolution project consumes the contract
```

No project should silently mutate another project's control plane.

## Signals

- `project.health.finding-count` — project-system health signals visible to owners.
- `session.failed-triage-rate-3h` — evaluator coverage or triage quality may need attention.
- `learning.feedback` events — actionable feedback that should influence agent behavior.
- `project-creative-audit` outputs — proposal-only signals for missing or surprising project issues.
- Comments from platform or domain projects requesting evolution work.

## Current State

Waiting: boundary project created to separate learning/evolution from platform
infra. Evaluator self-improvement, strategy-extractor calibration, and
false-good calibration have been merged here as evaluator learning/calibration
lanes. No autonomous evolution task is currently accepted in this project.

Resume when: a human/May directive prioritizes agent-system evolution, a
learning/evaluation metric breaches, or another project requests behavior
evolution through a comment/event/metric.

## Scope

In scope:
- Agent learning loops and self-improvement strategy.
- Evaluation quality, calibration, feedback routing, and behavior-change policy.
- Cross-agent coordination patterns and proposal-only creative audit lanes.
- System-level rules for how agents discover, propose, test, and adopt changes.

Out of scope:
- Runtime/SDK/persistence/UI/container implementation details unless accepted
  as a platform task.
- Domain-specific project discovery or product-quality maps.
- Direct edits to another project's `project.md` unless that project owner has
  accepted the task.

## Related Projects

- `projects/platform/project.md` — infra substrate provider.
- `projects/scout-second-brain-learning/project.md` — scout-specific learning lane.
- `projects/ruflo-learning-loop/project.md` — paused external-methodology learning loop owned by arc.
- `projects/master-worker-context-sharing/project.md` — master/worker delegation and context-transport reference.
- `projects/eval-llm-lane-restoration/project.md` — LLM evaluation lane (infra reference).
- `projects/closed-loop-reliability/project.md` — operational closed-loop reliability reference.

Archived evaluator lanes:
- `projects/_archive/evaluator-self-improvement/project.md`
- `projects/_archive/evaluator-strategy-extractor-calibration/project.md`
- `projects/_archive/evaluator-false-good-calibration/project.md`

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

## Validation

- Platform project scope says learning/evolution is out of platform scope.
- This project documents the loose-coupling contract through metrics, events,
  comments, tasks, and SDK APIs.
- Existing learning/evolution projects are reachable from this project.
- Evaluator self-improvement artifacts are reachable under this project.
- Evaluator strategy-extractor and false-good calibration artifacts are reachable under `outputs/evaluator/`.

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
