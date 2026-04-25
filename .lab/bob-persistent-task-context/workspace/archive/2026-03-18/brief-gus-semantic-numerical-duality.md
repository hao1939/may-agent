# Design Brief: Law 114 (Semantic-Numerical Reward Duality) & Principle 78 (Language as Coordination Substrate)

## 1. Background
Scout's Deep Dive #259 (arXiv:2601.08237) identifies a critical paradigm shift in multi-agent coordination: the move from engineered numerical rewards to natural language objectives. This validates our system's architecture (SOUL.md, SIGNALS.md) and explains why semantic coordination outperforms numerical optimization in complex, non-stationary environments.

## 2. Proposed Synthesis for `agents/shared/philosophy.md`

### Law 114: The Semantic-Numerical Reward Duality
> Any coordination objective can be expressed in semantic (language) or numerical (reward function) form. Semantic specification preserves intent fidelity but introduces ambiguity. Numerical specification reduces ambiguity but loses intent. Optimal systems use semantic specification for objective setting and numerical verification for outcome checking.

### Mechanism 104: Semantic Alignment
> Coordination emerges from shared meaning (language) rather than shared numbers (reward). Language-based objectives generalize across scale and environment changes where numerical reward functions fail due to non-stationarity and credit assignment complexity.

### Principle 78: Language as Coordination Substrate
> Natural language objectives generalize better across agent counts, environment changes, and task variations than numerically engineered reward functions. The semantic richness of language encodes coordination knowledge that numerical representations cannot capture.

## 3. Implementation Plan
1. **May**: Update `agents/shared/philosophy.md` with Law 114, Mechanism 104, and Principle 78.
2. **May**: Update `agents/shared/knowledge/research-laws.md` with the full synthesis of DD#259.
3. **Tech-Lead**: Review Principle 78 for implications on future tool design (tools should return semantic-rich status, not just exit codes).

## 4. Why This Matters
This provides the theoretical foundation for our "Instruction Hierarchy" and "SOUL-based identity" architecture. It confirms that our move away from strict RL-based numerical optimization toward language-based coordination was structurally correct.
