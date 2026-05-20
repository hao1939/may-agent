---
id: evaluator-strategy-extractor-calibration
owner: evaluator
status: closed
type: archive
priority: P2
iteration: 2
---

# Archived Project: Evaluator Strategy Extractor Calibration

## Current State

Closed: merged into `projects/agent-system-evolution` on 2026-05-20.

The active owner lane is now:

`projects/agent-system-evolution/project.md`

## Moved Artifacts

- `outputs/iteration-1-validation.md` -> `projects/agent-system-evolution/outputs/evaluator/strategy-extractor/iteration-1-validation.md`
- `outputs/iteration-2-regression.md` -> `projects/agent-system-evolution/outputs/evaluator/strategy-extractor/iteration-2-regression.md`
- `outputs/fixtures/strategy-positive-modern-session/session.jsonl` -> `projects/agent-system-evolution/outputs/evaluator/strategy-extractor/fixtures/strategy-positive-modern-session/session.jsonl`
- `journal.md` -> `projects/agent-system-evolution/outputs/evaluator/strategy-extractor/history.md`

## Original Purpose

Improve `agents/evaluator/skills/extract-strategy.cjs` so periodic task #7 can
extract reusable positive tactics from fresh verified-success session samples
instead of only surfacing recovery/error-cleanup lessons.

## Merge Rationale

Strategy extraction is evaluator learning behavior, not a standalone
operational project. The immediate fix is complete and durable; remaining work
is evaluator-learning backlog inside the evolution umbrella:

- compact-success coverage,
- optimization-noise ranking,
- evaluator criteria/doc interpretation if later calibration requires it.
