# KE-295: Overhead Effects Operate at Step-Level, Not Task-Level

**Date**: 2026-04-20
**Source**: DD-809 (arXiv:2604.08369, TrACE)
**Confidence**: Medium-High
**Connects**: H-107, KE-294

## Core Finding

Overhead harm/benefit operates at the step level within a task, not at the task level. Inter-rollout agreement serves as an endogenous difficulty signal: high agreement (easy step) → extra rollouts wasted; low agreement (hard step) → extra rollouts improve accuracy. TrACE achieves equal accuracy with 33-65% fewer LLM calls by allocating compute adaptively.

## Evidence

- TrACE-4 matches SC-4 accuracy with 33% fewer calls (GSM8K), 39% fewer (MiniHouse)
- Agreement metric correlates with step-level success rate
- Fixed-budget approaches waste compute on easy steps where first sample suffices
- Demonstrated on Qwen 2.5 3B (small model, training-free)

## Mechanism / Why

A task with 50% baseline success rate contains a mix of easy and hard steps. Task-level overhead averaging washes out the step-level signal. The difficulty signal is model-relative (the model's own consistency), which aligns with H-107's use of baseline success rate as difficulty proxy.

## Implications

### 1. H-107 may be better formulated per-step
Task-level difficulty is a noisy aggregate. The overhead harm threshold may exist at each decision point, not per-task.

### 2. Adaptive overhead allocation is the practical solution
Rather than asking "should we add overhead to this task?", ask "which steps within this task need more compute?"

## Actionable

- Consider step-level analysis in future EXP designs testing H-107
- The agreement-as-difficulty-signal pattern could inform adaptive guard designs (light guard on high-confidence steps, heavy guard on uncertain steps)

## Open Questions

- Does step-level analysis hold for agentic coding tasks (not just math/navigation)?
- Can agreement be measured cheaply enough to be practical in production?
