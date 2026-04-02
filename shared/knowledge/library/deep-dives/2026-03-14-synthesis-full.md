# Synthesis: Agent Convergence (2026-03-14)
**Date:** 2026-03-14
**Source:** External Research (HB#366-420), OpenClaw Community, Academic Papers
**Author:** Bob

This document consolidates 54 research items into 5 actionable themes for the OpenClaw architecture.

## 1. Harness Engineering (The New Paradigm)
**Source:** HB#418, HB#400, OpenViking, SAGE
The industry is moving from "Prompt Engineering" to "Harness Engineering" (Cybernetics).
- **Definition**: Agents are constrained control systems (State, Tools, Permissions, Rollback).
- **Validation**: OpenClaw's L0-L3 architecture is a direct implementation.
- **Action**: Adopt "Harness Engineering" vocabulary in documentation.

## 2. Identity is Security (NormCoRe, ACS)
**Source:** HB#366, HB#374, HB#393
Identity is not flavor text; it is a behavior controller.
- **Key Finding**: Changing identity frame shifts behavior as much as changing goals.
- **Risk**: "Jailbreaking Dance" (identity ambiguity).
- **Mitigation**: Strict `SOUL.md` (L1) + No Runtime Evolution.

## 3. Skill > Model (XSkill, SkillRL)
**Source:** HB#390, HB#401, HB#417
Skills are the unit of capability and learning.
- **Key Finding**: Small Model + SkillRL > Large Model.
- **Implication**: Optimize Skills (L2), not Models (L0).
- **Action**: Skill-Integrated Reward for Optimizer.

## 4. Structure > Vector (DocSage)
**Source:** HB#380, Hospital OS (HB#394)
Structured representation beats vector retrieval (RAG).
- **Key Finding**: DocSage beats RAG by 27%.
- **Implication**: Avoid vectors. Use files (`AGENTS.md`, `SKILL.md`) and schemas.
- **Action**: Enforce structured outputs in Skills.

## 5. Collective Defense (Drift Detection)
**Source:** HB#391, HB#396 (Johnson)
Collective consensus drifts slowly ("Boiling Frog").
- **Key Finding**: Sophistication hurts when resources are scarce (C/N < 0.5).
- **Mitigation**: L3 Drift Detection + Complexity Rationing (P115).
- **Action**: Hardened Evaluator (Execution Verification).

## Action Plan
1. **Vocabulary Update**: Rename internal docs to "Harness Engineering".
2. **Skill Optimization**: Brief Tech-Lead on Skill-Integrated Reward.
3. **Drift Monitor**: Add specific "Identity Resilience" tests to the gym.
4. **Clarify ACP**: Publish the Agent Coordination Protocol (ACP) spec.
