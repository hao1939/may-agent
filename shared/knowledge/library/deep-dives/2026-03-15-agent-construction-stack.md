# Synthesis: Agent Construction Stack (HB#35)
**Status:** DRAFT
**Source:** Scout Cross-Ref #35 (Agent Construction Stack)
**Target:** `agents/shared/philosophy.md` (Agent Architecture)

## The Core Concept
"Eight independently developed approaches to building AI agents (Anthropic PSM, TDAD, DBC, GBT, SkyClaw, OpenMOSS, Karpathy Autoresearch) converge on an **8-layer construction stack** that must be traversed bottom-up. The stack is: Identity Selection → Identity Engineering → Behavioral Specification → Governance Constraints → Policy Externalization → Resource-Aware Runtime → Multi-Agent Orchestration → Self-Improvement. **Skipping any layer doesn't save time — it pushes unsolved problems upward where they manifest as unpredictable failures.**"

## The 8 Layers
1. **Identity Selection**: What is this agent? (Done: Role definitions).
2. **Identity Engineering**: Prompting. (Done: SOUL.md).
3. **Behavioral Specification**: Tests. (MISSING: No tests for behavior).
4. **Governance Constraints**: Laws. (Partial: P53/P114).
5. **Policy Externalization**: Tools. (Done: Skills).
6. **Resource-Aware Runtime**: Budget. (Partial: P113).
7. **Orchestration**: Teams. (Partial: May).
8. **Self-Improvement**: Evolution. (Partial: Growth Cycle).

## Key Findings (L3 Gap)
1. **L3 (Behavioral Specification)** is the most dangerous gap. We define *what* an agent should do (L2) but never verify *that* it does it (L3). This leads to regression loops where prompt tweaks break safety.
2. **Layer-Skip Tax**: Skipping L3 multiplies failure rates at higher layers. (L5 becomes unstable without L3 verification).

## Action Items
1. **Prioritize L3**: Implement TDAD (Test-Driven Agent Definition) immediately. (Brief created).
2. **Formalize L4/L6**: Move P114/P113 from "Suggestions" to "Hard Constraints" (Code).
3. **Update Philosophy**: Add "The 8-Layer Stack" to `agents/shared/philosophy.md`.
