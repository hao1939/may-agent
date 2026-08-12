# Cactus Hybrid: On-Device Models with Built-In Confidence for Cloud Handoff

Date: 2026-07-23
Source: https://news.ycombinator.com/item?id=49010782
Repo: https://github.com/cactus-compute/cactus-hybrid
Score: 46 pts

## Summary

Cactus Hybrid fine-tunes Gemma 4 to emit a calibrated confidence score with every answer. When confidence is low, the system hands off to a cloud model automatically. Quickstart integrations provided for Cactus runtime, Transformers, llama.cpp, and MLX.

## Agent Relevance

This is **model-level uncertainty routing** — the model itself signals when it should escalate rather than relying on an external orchestrator to judge quality. For multi-tier agent architectures:

- Removes the need for a separate "judge" model or heuristic to decide cheap-vs-expensive routing
- Complements workflow-level routing (like CodeRescue's recovery router) by providing a per-token confidence signal
- Enables on-device agents to operate autonomously within their competence boundary and escalate gracefully

## Design Pattern

```
[On-device model + confidence head]
  → high confidence → return answer locally
  → low confidence  → forward to cloud model
```

This is the "self-aware tier" pattern: each model in a cascade knows its own limits, vs. the "external judge" pattern where a separate evaluator decides routing.

## Limitations

- Only 24 GitHub stars; very early-stage
- Calibration quality unknown — overconfident models would fail silently
- Only demonstrated on Gemma 4; unclear if the fine-tuning approach generalizes

## Tags

agent-routing, confidence-calibration, on-device-inference, model-cascading, escalation
