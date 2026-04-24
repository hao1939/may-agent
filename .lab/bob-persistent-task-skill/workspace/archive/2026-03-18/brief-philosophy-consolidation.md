# Design Brief: Philosophy Simplification and Consolidation (GUS v7)

**Source Artifacts**: `agents/shared/philosophy.md`
**Goal**: Create a <300 line "Living Constitution" (`philosophy-v2.md`) and move all research/theory to `agents/shared/knowledge/research-laws.md`.

## 1. The Strategy: Separation of Concerns
Currently, `philosophy.md` mixes three things:
1.  **Directives**: "Do X" (Rules/Laws)
2.  **Theory**: "Why X works" (Mechanisms/Patterns)
3.  **Predictions**: "What will happen" (Forecasts)

This violates **Principle 42 (Minimalism)**. The operational agents (Coder, Tech-Lead) need Directives. The research agents (Scout, Bob) need Theory.

## 2. The Split
We will create two files:
-   `agents/bob/workspace/philosophy-v2.md` (Target: `agents/shared/philosophy.md`): The "Constitution". Contains only actionable principles.
-   `agents/shared/knowledge/research-laws.md`: The "Library". Contains the full GUS framework (Laws 1-107, Mechanisms 1-92, Predictions 1-93).

## 3. Consolidation Rules
1.  **Merge Duplicates**: 
    -   P114 (Experience Replay) and P110 (Active Recall) → Merge into **P114 Active Experience Replay**.
    -   P82 (Explicit Handoffs) and P105 (Typed Coordination) → Merge into **P82 Typed Handoffs**.
    -   P53 (Evolution Boundaries) and P118 (Zombie Code) → Merge into **P53 Immutable Core**.
2.  **Remove Non-Actionable**:
    -   Remove "P24 Scaling Decision Function" (Theory).
    -   Remove "P125 Effective Temperature" (Theory).
    -   Remove "P39 Governance Layer as Moat" (Theory).
3.  **Prioritize "Hao Direct"**:
    -   Principles 0-11 (The "Hao 12") remain verbatim at the top.

## 4. The New Structure (Philosophy v2)
1.  **Foundation**: The "Hao 12" (P0-P11).
2.  **Universal Standards**: How every agent acts (P1, P5, P7, P53, P82).
3.  **System Architecture**: How the machine works (P12, P13, P89, P176).
4.  **Intelligence & Safety**: How we think (P51, P114, P84, P109).

## 5. Execution Plan
1.  Create `research-laws.md` by extracting all "Law", "Mechanism", and "Prediction" entries from my workspace briefs and the old philosophy.
2.  Draft `philosophy-v2.md` by filtering `philosophy.md` through the consolidation rules.
3.  Handoff both to May.

## 6. Next Actions
-   [ ] Create `agents/shared/knowledge/research-laws.md`.
-   [ ] Create `agents/bob/workspace/philosophy-v2.md`.
