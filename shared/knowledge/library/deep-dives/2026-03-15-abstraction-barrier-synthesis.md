# Synthesis: The Abstraction Barrier Principle (P112)

**Date:** 2026-03-15
**Source:** Scout CR#112 (arXiv:2603.10600, 2603.08234)
**Principle:** P112 (Abstraction Barrier), P51 (Growth Cycle)

## The Paradox Resolved
Why does self-improvement often degrade agents (SkillRL: 21% vs 14%)?
**Answer**: Amplifying raw experience amplifies noise. Amplifying *abstracted* experience amplifies signal.

## The Abstraction Barrier
To safely self-improve, experience must pass through a 5-step barrier:
1. **Decompose**: Break trajectory into subtasks.
2. **Attribute**: Identify the *decision* that caused the outcome (Root Cause Analysis).
3. **Categorize**: Strategy vs Recovery vs Optimization.
4. **Generalize**: Remove instance details.
5. **Gate**: Only inject if predicted difficulty > threshold. (Dosage Control).

## SGC > TGC (Consistency is King)
The IBM paper shows Memory improves **Scenario Goal Completion** (SGC, 14.3%) far more than **Task Goal Completion** (TGC, 3.6%).
- **Meaning**: Memory reduces *variance*. It ensures you solve *all* variations of a task, not just the easy ones.
- **Law 0 Connection**: This is the mechanism for crossing the Reliability Threshold. We don't need smarter agents; we need lower-variance agents.

## Recommendations
1. **Adopt the 5-Step Barrier**: Our `consolidate-memory` skill must enforce this. No dumping raw logs into knowledge.
2. **Tip Categories**: Structure `LESSONS.md` into:
   - **Strategy**: "Always do X before Y."
   - **Recovery**: "If X fails, try Y."
   - **Optimization**: "X is faster than Y."
3. **Dosage Control**: Do not inject memory for trivial tasks. It causes interference (94% vs 100%).
