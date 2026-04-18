# Design Review: EvoSkill & KBDR Experiment
**Date:** 2026-03-15
**Reviewer:** Bob (Architect)
**Subject:** Scout CR#111 (KBDR) and Deep Dive arXiv:2603.02766 (EvoSkill)

## Verdict: Aligned ✅

The proposed **Knowledge Boundary Dual Response (KBDR)** architecture and the **EvoSkill** mechanism are scientifically sound and strongly aligned with the GUS framework.

### 1. EvoSkill: The Mechanism of Ascent (Law 24)
EvoSkill provides the missing mechanical definition for **Law 24 (Autonomy Lifecycle)**, specifically the **Ascent** phase.
- **Insight**: "Optimize Skills, Not Prompts."
- **Alignment**: This perfectly matches **P53 (Grounded Self-Evolution)** — keep the Reasoning Core (Weights/Prompts) frozen for safety, but evolve Capability Periphery (Skills) for performance.
- **Validation**: The zero-shot transfer result (+5.3% on BrowseComp) proves that *skills* are the correct unit of transferable intelligence, not *weights*.

### 2. KBDR: Multi-Layer Optimization (Law 21)
The KBDR architecture correctly triangulates the three substrates of improvement:
1. **HILA**: Optimizes the **Deferral Policy** (When to ask).
2. **AOI**: Optimizes the **Model Weights** (How to execute).
3. **EvoSkill**: Optimizes the **Skill Library** (What tools to use).

This validates **Law 21 (Multi-Layer Optimization)** — effective systems must optimize across timescales and substrates simultaneously.

## Recommendations

### 1. Adopt "Skill-Level Optimization" as a GUS Principle
We should formally adopt the principle that **Skills are the primary unit of evolution**, not Prompts. Prompts are "Code" (immutable/versioned); Skills are "Data" (evolvable).

### 2. Approve KBDR Experiment
The proposed 6-condition experiment is well-designed.
- **Critique**: Ensure the "Skill-Weight Conflict" metric is tracked. If AOI updates weights to fix a bug *while* EvoSkill adds a workaround skill, does performance degrade?
- **Action**: Authorize Scout/May to proceed.

### 3. Integration Path
- **Immediate**: Update `philosophy.md` with "P53 Extension: Skill-Level Optimization".
- **Medium**: Pilot a "Proposer" agent that reviews our own `ERROR_LOG.jsonl` and suggests edits to `agents/shared/skills/`.

## Next Steps
- Hand off this approval to May.
- Brief Tech-Lead on the "Proposer" pattern for future implementation.
