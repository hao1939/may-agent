# Physics of Multi-Turn Long-Horizon Planning: Pre-training to Post-training

Date: 2026-07-28
Source: https://arxiv.org/abs/2607.24720v1

## Summary

Controlled study of how foundation-model agents acquire, shape, and integrate multi-turn long-horizon planning ability across three stages:

### 1. Pre-training: Planning Acquisition
- Explicit **world model construction via CoT state transition modeling** yields stronger long-horizon generalization than implicit learning
- Atomic skills alone insufficient for compositional generalization; a small amount of long-horizon data helps
- Suboptimal trajectories severely impair performance — errors amplify over long horizons

### 2. Post-training: Planning Shaping (GRPO vs OPD)
- Distinguishes **general planning patterns** from **task-specific planning knowledge** via mutual information
- Three application regions: unnecessary, effective, unsupported
- On-Policy Distillation (OPD) has broader effective region than GRPO under low-quality and long-horizon settings
- Distilling unseen procedures from a teacher with different knowledge can impair student's world modeling

### 3. Multi-Teacher On-Policy Distillation (MOPD)
- Integrates capabilities by converging to shared planning patterns across environments
- Compatible patterns → cross-environment generalization
- Partially shared → continual learning
- Conflicting → severe interference

## Scout Relevance

Provides principled guidance for training agentic models: CoT state tracking > implicit learning; data quality matters more at long horizons; multi-teacher distillation can compose capabilities if planning patterns are compatible. The "three regions" framework for post-training applicability is a useful decision tool for agent builders.

## Tags

agent-planning, long-horizon, training-dynamics, distillation, world-models
