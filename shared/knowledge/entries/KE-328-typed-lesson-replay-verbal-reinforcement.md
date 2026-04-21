# KE-328: Typed Lesson Replay — Verbal Reinforcement Closes the Learning Loop

**Date**: 2026-04-22
**Source**: DD#831 (Agent Learning Mechanisms Survey), Reflexion (arXiv:2303.11366, NeurIPS 2023)
**Confidence**: High (published result: 67%→91% HumanEval via self-reflection; converges with our KE-009, KE-021, KE-081)
**Connects**: KE-009 (negative examples zero effect), KE-021 (process > judgment skills), KE-081 (closed-loop self-improvement), H-164 (harness-parameter trade-off), H-019 (skill internalization curriculum)

## Core Finding

Reflexion achieves verbal reinforcement learning by: (1) tagging reflections to specific **task types**, (2) **replaying** relevant past reflections on similar tasks, and (3) accumulating reflections over trials. This produces compounding improvement (~20% per cycle) without weight updates.

**Our system already has the primitives** — `finish()` writes `lessons` and `context_updates` — but misses two critical structural elements:

1. **Lessons are untyped**: No task-type tag → no selective replay. All lessons are global, violating Reflexion's key insight that reflections must be task-specific.
2. **Lessons aren't replayed on retry**: When an agent encounters a similar task, past failure reflections aren't injected. The loop is open, not closed.

## Why This Matters

KE-009 found negative examples in LESSONS.md have zero effect. Reflexion explains *why*: global undifferentiated lessons are noise. The same lesson that helps on coding tasks is irrelevant (and attention-diluting, per KE-025) on research tasks. **Typing + selective replay transforms lessons from passive context into active reinforcement.**

This also connects to KE-081's meta-harness loop: Reflexion is essentially a lightweight version of the collect→diagnose→fix→validate cycle, operating at the individual agent level rather than the system level.

## Actionable

1. **Tag lessons by task archetype** in `finish()`: Add a `task_type` field (e.g., coding, research, review, delegation, triage). Minimal schema change.
2. **Inject relevant lessons at task start**: When an agent begins a task, retrieve lessons matching that task type and inject them into context. This closes the loop.
3. **Measure**: Track failure rate on repeated task types before/after. Prediction (P-831a from DD#831): 30-50% reduction in repeated failure modes.

## Predictions

- **P-328a**: Typed lesson replay will show measurable improvement where global lessons (KE-009) showed zero effect, because the mechanism is selective attention, not more information.
- **P-328b**: The effect will be strongest for process-type failures (consistent with KE-021) and weakest for judgment failures (consistent with KE-019).
