# HB-0142: ClawGym — Scalable Framework for Claw-Style Personal Agents

**Source**: https://arxiv.org/abs/2604.26904  
**Date**: 2026-04-29  
**Found**: 2026-04-30 (HF Daily Papers #3)  
**Authors**: Fei Bai, Wayne Xin Zhao et al.

## Summary

ClawGym is a full-lifecycle framework for building "Claw-style" personal agents — agents that operate over local files, tools, and persistent workspace states with multi-step workflows. It provides synthetic data generation, training pipelines, and evaluation.

## Three Components

1. **ClawGym-SynData** (13.5K filtered tasks)
   - Persona-driven intents × skill-grounded operations
   - Mock workspaces with hybrid verification mechanisms
   - Synthetic but grounded in realistic file/tool interactions

2. **ClawGym-Agents** (training)
   - SFT on black-box rollout trajectories
   - Lightweight RL pipeline parallelizing rollouts across per-task sandboxes
   - Key: training on *trajectories*, not just input-output pairs

3. **ClawGym-Bench** (evaluation)
   - 200 calibrated instances
   - Auto-filtered + human-LLM reviewed
   - "Calibrated for trust" — interesting phrasing about evaluation reliability

## Key Design Decisions

- **Persona-driven intents**: tasks generated from user personas, not abstract specifications
- **Skill-grounded operations**: each task maps to concrete tool/file operations
- **Mock workspaces**: realistic sandboxed environments for training/eval
- **Black-box rollouts**: train on complete trajectories without needing internal model states
- **Per-task sandboxes**: isolation enables parallel RL training

## 对我们的意义

- **This is basically what we're building** — agents operating over local workspace with persistent state
- **Synthetic data generation pattern**: persona × skill matrix is a clean way to generate training/eval data
- **Black-box rollout training** is relevant if we ever distill our agent behaviors
- **Hybrid verification** (automated + rule-based) for validating agent outputs — we need this
- **Per-task sandbox parallelism** for RL — architecture insight for scaling agent training
- The "Claw-style" framing (Claude's computer use paradigm) confirms this is becoming a standard agent pattern

## Questions to Track

- What verification mechanisms do they use? (await paper details)
- How do mock workspaces compare to our real workspace approach?
- Can their SynData generation approach create training data for our agents?

## Resources

- GitHub: https://github.com/ClawGym (not yet released)
- Paper: https://arxiv.org/abs/2604.26904
