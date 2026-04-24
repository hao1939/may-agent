# Brief: GUS v6 — Principle 83 (Interaction Debt)

**Source**: Scout CR#107 "Interaction Debt Accumulation Model"
**Target**: `agents/shared/philosophy.md` (GUS v6 Update)
**Status**: Ready for Implementation

## Context
Scout's synthesis of 6 papers (including DD#237, DD#236, CR#14) reveals a fundamental law of multi-agent systems: **Interaction Debt**.
Just as technical debt accumulates from hasty code, interaction debt accumulates from multi-turn constraints.

**The Law**: Interaction Debt scales **O(T × N²)** where T=turns and N=agents.
Without explicit management, every conversation eventually collapses under the weight of untracked constraints, regardless of model intelligence.

## Proposed Philosophy Updates

### New Principle: P83 Invariant Extraction
> **P83 Invariant Extraction**: In any multi-turn or multi-agent interaction, constraints must be explicitly extracted from the conversation flow and maintained as first-class objects (Invariants).
> * **Why**: Models "forget" constraints over time (Constraint Forgetting) and drift from their own history (Self-Consistency Erosion).
> * **Mechanism**: Do not rely on the chat history to hold the rules. Extract the rules to a file (`.state/`, `todo.md`, `brief.md`) and validate against that file, not the chat.

### New Principle: P86 Interaction Debt
> **P86 The Interaction Debt Limit**: Every conversation has a "Catastrophic Threshold" defined by `T × N² ≈ K`.
> * **Implication**: Long conversations are an anti-pattern. Infinite context windows do not solve this; they exacerbate "Constraint Multiplication."
> * **Action**: Aggressively prune context. Reset sessions frequently. Use "Context Separation" (P84) to break the accumulation curve.

### Updates to Existing
- **Refine P47 (Separation)**: Explicitly mention "Constraint Separation" — the agent generating content should not be the one tracking constraints.
- **Refine P42 (Minimalism)**: Frame minimalism not just as aesthetic, but as "Debt Reduction." Fewer words = fewer implicit constraints to track.

## Implementation Implications
1. **The Brief is the Invariant**: This validates our "Brief-first" workflow. The brief *is* the extracted invariant.
2. **Session Resets**: We should formalize "Turn Budgeting." If a task takes >15 turns, it's likely drowning in debt. Reset and summarize.
3. **Consolidation**: The "Consolidate Memory" skill is now a critical "Debt Repayment" mechanism.

## Next Steps
1. Add P83 and P86 to `agents/shared/philosophy.md`.
2. Brief Tech-Lead on "Turn Budgeting" (Task: Alert if session > 20 turns).
