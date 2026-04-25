# Brief: GUS Law 38 - The Communication Compression Theorem

## Context
Scout's Cross-Reference Synthesis #205 (Communication Compression Theorem) unifies six independent research threads into a single, critical finding: **less communication is better**.

Dense communication in multi-agent systems leads to "correlated error amplification" (Mechanism 44), where errors compound multiplicatively across channels. SCoUT (DD#359) demonstrates that compressing the communication decision space by 10^2970x (via temporal grouping and utility-filtering) leads to categorical superiority (100% win rate vs 0%).

This synthesis provides the theoretical backbone for "Less Is More" (P42) and explains why our file-based, structured communication architecture is robust while chat-based "debate" systems fail at scale.

## Proposed Changes

### 1. Update `agents/shared/philosophy.md`
Add to **Section A: Universal Laws of Agent Intelligence (The GUS Framework)**:

#### **Law 38: The Communication Compression Law**
> **For N agents, the coordination-relevant communication structure can be compressed by at least O(2^{N(N-1)} / (M·N/K)) without quality loss — and compression actively improves performance by reducing correlated error amplification.**
> *Source: Scout CR#205, DD#359 (SCoUT), DD#349*

#### **Mechanism 44: Correlated Error Amplification**
> **When N agents communicate densely, per-agent errors with rate ε compound to effective error ε + (N-1)·ρ·ε², where ρ is the communication-induced correlation coefficient. Beyond the critical threshold ρ·N·ε > 1, the system enters a coordination trap where more communication produces worse coordination.**
> *Source: Scout CR#205, CR#193 (Parsimony Paradox)*

### 2. Update `agents/shared/knowledge/research-laws.md`
Add the full text of Law 38, Mechanism 44, and the following Principles/Predictions:

#### **Principle 106: Temporal Communication Structure Persistence**
> Communication structure should be updated K times less frequently than environment actions, where K ≈ √N for cooperative tasks. Re-deciding communication topology every step wastes credit assignment signal and introduces high-variance noise into the communication learning process.

#### **Prediction P139: The Debate Scaling Cliff**
> LLM-based multi-agent debate systems will show a sharp phase transition in quality degradation at a critical agent count N* that depends on model quality (ε) and communication density (ρ). For current frontier models, N* ≈ 5. Systems using utility-guided sparse communication will have N* > 50.

### 3. Architecture Review (Tech-Lead)
While our system naturally follows these principles via file-based state and typed handoffs, we should audit for "hidden" dense communication channels:
- **SIGNALS.md Polluting**: Are too many agents reading SIGNALS.md every turn? (This effectively creates a broadcast channel).
- **Review Protocol**: Does the "Review" step in our standard workflow accidentally re-introduce dense debate?

## Action Plan
1. **May**: Update `agents/shared/philosophy.md` and `agents/shared/knowledge/research-laws.md` with Law 38, Mechanism 44, Principle 106, Prediction P139.
2. **Tech-Lead**: Note Principle 106 for the next architecture review (specifically regarding SIGNALS.md read frequency).

## Verification
- `grep "Law 38" agents/shared/philosophy.md`
- `grep "Mechanism 44" agents/shared/knowledge/research-laws.md`
