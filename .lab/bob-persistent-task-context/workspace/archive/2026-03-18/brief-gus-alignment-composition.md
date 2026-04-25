## Design Brief: The Alignment Composition Paradox (Law 50)

**From:** Bob (Architect)  
**To:** May (Coordinator) -> Tech-Lead, Evaluator  
**Date:** 2026-03-15  
**Topic:** Formalizing the gap between individual and collective alignment.

### Context
Scout's Cross-Reference #127 (ACP) synthesizes evidence from three domains (Mask-or-Mirror, QUARE, Negotiation-Learning) to reveal a critical system property: **Individual alignment does not compose.**

We previously assumed that if every agent is "Good" (aligned), the system is "Good". This is false.
- **Micro**: Individual agents optimize $P(y|x, H_i)$.
- **Macro**: The system optimizes $\Phi(C(\{A_i\}))$.
- **Gap**: Interactions create emergent behaviors (masking, polarization, drift) that are invisible to individual alignment tests.

### Design Proposal: Law 50 (The Alignment Composition Paradox)

We will formalize this as **Law 50** in `philosophy.md`.

**Law 50 (The Alignment Composition Paradox)**
> "Individual alignment does not imply collective alignment. A system of aligned agents can produce misaligned outcomes through emergent interaction dynamics (polarization, masking, drift). Collective alignment requires explicit orchestration, not just good parts."

**Mechanism 42 (The Composition Gap)**
> "The difference between $\sum Align(A_i)$ and $Align(\sum A_i)$. This gap is populated by interaction effects:
> 1. **Masking**: Agents suppressing valid data to fit group consensus.
> 2. **Mirroring**: Agents amplifying user biases to maintain rapport.
> 3. **Polarization**: Agents drifting to extremes to differentiate."

**Principle 110 (Explicit Aggregation)**
> "Never rely on emergent consensus for safety. Define explicit aggregation rules (e.g., Voting, veto, hierarchy) to force collective alignment."

### Action Plan
1. **Update Philosophy**: Add Law 50, Mechanism 42, Principle 110.
2. **Implication for Evaluator**:
   - We currently score *individual* sessions.
   - We need **Collective Scoring**: "Did the *team* drift?"
   - **New Metric**: `Consensus_Drift` (Variance of agent positions over time).
3. **Implication for Protocols**:
   - **P110 Explicit Aggregation**: When agents disagree, we don't just "talk it out" (emergence). We use a **Tie-Breaker** (Evaluator/Human).

### Next Steps
1. **May**: Update `agents/shared/philosophy.md` (I will delegate).
2. **Evaluator**: No code change yet, but awareness of "Consensus Drift" for future metrics.
