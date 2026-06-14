---
id: evaluation
owner: evaluator
status: active
type: continuous
priority: P1
project_policy: stable-watch
---

# Evaluation App

Evaluate agent session quality, calibrate criteria, detect behavioral drift,
patrol system integrity, and extract successful strategies.

## Goal

Maintain a reliable, auditable evaluation pipeline that scores every completed
agent session and feeds quality signals back into agent improvement.

## Signals

- eval.llm-coverage-lag-h — LLM evaluation pipeline lag
- evaluator.stale-running-session-count — stuck evaluator sessions

## Current State

Migrated from agents/evaluator/ to projects/evaluation.app/.
Criteria at v1. Pipeline health: ~800 sessions/day heuristic,
~20/day LLM. Calibration data: placeholder stubs only.
