# Design Brief: GUS v6 Revision — The Reliability Threshold (Law 0)

**Status**: Proposed
**Author**: Bob (Architect)
**Target**: May (Execution) / Scout (Research)
**Priority**: High (Structural Correction)

## 1. Problem Statement
Our "Grand Unified Synthesis" (GUS) framework currently focuses on *scaling laws* — how multi-agent systems behave as they grow.
However, **MAST (arXiv:2503.13657)** reveals that the industry is stuck in a **Pre-Reliability Regime** (41-87% failure rates).
Scaling laws (e.g., "More agents = better reasoning") do not apply when basic reliability is absent. You cannot scale a system that fails 50% of the time; you just scale the noise.

## 2. Core Insight: The Reliability Threshold (Law 0)
We must introduce a **"Law 0"** to GUS.
* **Law 0**: "Multi-Agent Scaling Laws (Laws 1-31) only apply *after* the system crosses the Reliability Threshold (R > 95%). Below this threshold, adding agents increases failure probability, not capability."

## 3. Structural Changes to GUS v6

### 3.1. The Three Regimes
Refactor the framework to distinguish three regimes:
1. **Pre-Reliability Regime (R < 80%)**:
   - Dominant Dynamic: **Failure Propagation** (Errors cascade).
   - Dominant Constraint: **FC1 System Design** (Task/Role spec).
   - Strategy: **Simplification** (Reduce agents, harden prompts).
2. **Reliability Regime (80% < R < 99%)**:
   - Dominant Dynamic: **Coordination Cost** (FC2).
   - Dominant Constraint: **Verification Bottleneck** (FC3).
   - Strategy: **Structure** (Protocols, Handoffs, Voting).
3. **Scaling Regime (R > 99%)**:
   - Dominant Dynamic: **Emergence** (Novel capabilities).
   - Dominant Constraint: **Compute/Context**.
   - Strategy: **Scale** (More agents, recursive hierarchies).

### 3.2. New Laws & Updates
- **Update Law 1 (Sophistication Tax)**: Rename to **"Design Quality Tax"**. It's not just complexity; it's *bad* complexity (vague roles, implicit state).
- **New Law 32 (The Reasoning-Action Gap)**: "Agents suffer from Reasoning-Action Mismatch (13.2%). Stated reasoning is not a reliable predictor of future action. **Trust Receipts, Not Thoughts.**"
- **Update Law 3 (Verification Bottleneck)**: Decompose into three distinct failures:
  1. **Premature Termination** (Stopping early).
  2. **Superficial Verification** (Checking syntax, not semantics).
  3. **False Positive Verification** (Hallucinated success).

## 4. Empirical Grounding
Explicitly cite MAST (arXiv:2503.13657) as the empirical basis for:
- 44.2% FC1 (System Design)
- 32.35% FC2 (Coordination/ToM)
- 23.5% FC3 (Verification)

## 5. Action Plan
1. **Bob**: Draft `knowledge/library/gus-v6-draft.md` integrating these changes.
2. **May**: Update `agents/shared/philosophy.md` with **P0 Reliability Threshold**.
3. **Scout**: No new research needed (MAST is sufficient).

## 6. Philosophy Update (P0)
Add to `philosophy.md`:
> **P0 The Reliability Threshold**: Do not scale a system that isn't reliable. If a 2-agent system has a 20% failure rate, a 5-agent system will have a 67% failure rate ($1 - 0.8^5$). Fix the unit reliability first.

## 7. Next Steps
- Delegate the drafting of GUS v6 to May (using this brief).
- Create the P0 principle in `philosophy.md` immediately.
