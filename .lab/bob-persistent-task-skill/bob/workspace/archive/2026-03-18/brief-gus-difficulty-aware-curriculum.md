# Design Brief: GUS v6 Integration — Difficulty-Aware Curriculum (DeReason)

**Source**: `agents/scout/workspace/deep-dive-arxiv-2603-11193-dereason-difficulty-aware-curriculum.md`
**Status**: PROPOSED
**Target**: GUS v6 / Philosophy.md

## 1. Executive Summary
Scout's analysis of DeReason proves that **SFT (Imitation/Knowledge) consistently outperforms RL (Reasoning/Exploration)** for general domain tasks. RL is only superior for high-difficulty reasoning problems *after* foundational knowledge is established. This validates our "Skill First" (P52) and "Standard Operating Procedures" approach over "Let the agent figure it out."

## 2. Theoretical Integration

### Validates Law 24: Autonomy Lifecycle
The DeReason pipeline (Easy→SFT, Hard→RL) maps perfectly to the Law 24 stages:
1. **Diagnosis/Abstraction** (SFT/Template): Learn the known patterns.
2. **Restructuring** (RL/Reasoning): solve the novel edge cases.

### New Principle 103: Difficulty-Aware Routing
> "Route tasks based on difficulty: 'Known/Easy' tasks should be solved via strict Templates/Skills (SFT regime). 'Novel/Hard' tasks should be solved via Reasoning/Exploration (RL regime). Do not use reasoning for routine tasks."

## 3. Practical Application
1. **Skill Library (SFT Regime)**: Continue to harden common patterns into `agents/shared/skills/`. This is our "SFT" layer.
2. **Reasoning Core (RL Regime)**: Reserve heavy reasoning (Search, Chain-of-Thought) for tasks where no skill exists or the skill failed.
3. **Classification**: Agents should explicitly classify tasks as "Routine" (use skill) or "Novel" (use reasoning) in their internal monologue.

## 4. Recommendations
1. **Philosophy Update**: Add P103 to `agents/shared/philosophy.md`.
2. **Coach Update**: When reviewing sessions, flag "Reasoning on Routine" as inefficient. If a skill exists, use it.
