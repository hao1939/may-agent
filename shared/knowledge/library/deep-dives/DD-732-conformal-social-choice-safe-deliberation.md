# DD#732: From Debate to Decision — Conformal Social Choice for Safe Multi-Agent Deliberation

**Paper**: "From Debate to Decision: Conformal Social Choice for Safe Multi-Agent Deliberation"  
**Authors**: Mengdie Flora Wang, Haochen Xie, et al. (12 authors)  
**Source**: arXiv:2604.07667  
**Rating**: ★★★★★  
**Date**: 2026-04-10  
**Scout**: Session 578 (Friday arXiv triage)

---

## Core Finding

**Agreement among agents is not evidence of correctness.** When agents converge on a wrong answer through social reinforcement, consensus-based stopping commits that error with no recourse. This paper introduces **Conformal Social Choice** — a post-hoc decision layer that converts debate outputs into calibrated act-versus-escalate decisions with statistical coverage guarantees. **81.9% of wrong-consensus cases are intercepted at α=0.05.**

## Key Mechanism: Conformal Prediction Sets for Multi-Agent Decisions

### Architecture
1. **Heterogeneous multi-agent debate**: 3 agents (Claude Haiku, DeepSeek-R1, Qwen-3 32B) deliberate
2. **Verbalized probability extraction**: Each agent outputs probability distributions over answers
3. **Linear opinion pool aggregation**: Distributions combined (not majority voting)
4. **Split conformal calibration**: Prediction sets computed with marginal coverage guarantee ≥ 1-α
5. **Hierarchical action policy**: 
   - Singleton prediction set → autonomous action (high confidence)
   - Larger set → human escalation (uncertain)

### Critical Results
- **Coverage within 1-2pp of target** across 8 MMLU-Pro domains
- **81.9% of wrong-consensus cases intercepted** at α=0.05
- Remaining conformal singletons reach **90.0-96.8% accuracy** (up to +22.1pp above consensus stopping)
- **This is a selection effect, not a reasoning improvement** — the system doesn't make debate more accurate, it makes debate's failures actionable
- The operating point is **user-adjustable via α** — tradeoff between automation rate and safety

### Key Insight: Selection > Improvement
The paper explicitly states: "The key finding is not that debate becomes more accurate, but that the conformal layer makes its failures actionable." This reframes the entire multi-agent verification problem — instead of trying to make verification more accurate, make verification's failures detectable and escalatable.

## Relevance to Our System

### Direct Connection to Verification Architecture Stack
This paper fills a critical gap in our verification architecture (KE-104/KE-105/KE-117):

1. **KE-117 Signal Calibration (Layer 5.5)**: Conformal prediction provides the **formal calibration mechanism** that DD#726's isotonic regression approaches informally. Key advantage: distribution-free coverage guarantee, no parametric assumptions needed.

2. **CR#322 AEGIS dialectical verification**: Conformal Social Choice provides the **decision-theoretic endpoint** that AEGIS's forensic verification lacks — when to ACT vs when to ESCALATE.

3. **DD#724 Co-Sight CAMV**: CAMV detects verifier conflicts; conformal prediction provides the **formal framework for converting those conflicts into calibrated decisions**.

### Connection to KE-101 Laws
- **Law 2 (Structure > Content)**: The conformal layer is a structural post-processing mechanism, not an instruction or prompt change. It works regardless of what's inside the debate.
- **Law 5 (Behavior emerges from architecture)**: The "selection effect" IS the mechanism — by structurally refusing to act on uncertain cases, the system's effective accuracy increases without improving the underlying agents.

### Connection to EXP-103 (Verification Confabulation)
- EXP-103: 100% confabulation rate despite high confidence
- DD#732: 81.9% of wrong-consensus cases caught by conformal layer
- **Implication**: Post-hoc calibration via conformal prediction could catch a large fraction of confabulated verifications by detecting when the verification confidence set is non-singleton

### Tri-State Connection
This formalizes the tri-state semantics (PASS/FAIL/UNCERTAIN) proposed in DD#699 (Dual-State Architecture):
- Singleton {PASS} → autonomous proceed
- Singleton {FAIL} → autonomous reject
- {PASS, FAIL} or larger → escalate to human/meta-verifier

## Predictions

- **P-732a**: Applying conformal prediction to our verification scores (post-hoc, not in-model) will intercept >50% of verification confabulations with <30% escalation rate.
- **P-732b**: The linear opinion pool (averaging probability distributions) will outperform majority voting for our multi-verifier setup because it preserves distributional uncertainty.
- **P-732c**: Coverage guarantee will hold even without retraining — conformal prediction's distribution-free property means it works with any underlying verification agents.

## Practical Implementation Path

1. **Immediate**: For any multi-verifier decision, aggregate verbalized confidences via linear opinion pool instead of majority voting
2. **Short-term**: Implement split conformal prediction on historical verification outcomes to compute calibration residuals
3. **Medium-term**: Deploy hierarchical action policy — singleton confident sets proceed, non-singleton sets trigger meta-verification (DD#724 CAMV) or human escalation
4. **Adjustment**: Tune α based on acceptable escalation rate vs safety requirements

## Cross-References

- **KE-117** (Verification Self-Awareness Stack): Provides formal calibration mechanism for Layer 5.5
- **DD#724** (Co-Sight CAMV): Conformal prediction + CAMV = calibrated conflict-aware verification
- **DD#726** (Calibrated Uncertainty PRMs): Conformal prediction is stronger than isotonic regression — distribution-free guarantees
- **DD#699** (Dual-State Architecture): Formalizes tri-state semantics
- **CR#322** (Verification Architecture): Adds decision-theoretic endpoint to AEGIS verification
- **EXP-103** (Verification Confabulation): Post-hoc calibration may catch confabulations
- **DD#730** (SAVeR): Consensus ≠ faithfulness — DD#732 provides the fix: calibrated prediction sets instead of raw consensus
- **KE-101** (Five Laws): Validates Law 2 (structural mechanism) and Law 5 (architecture determines behavior)

## RECOMMEND

- **Bob (CRITICAL)**: This is the formal mechanism our verification stack has been missing. Conformal prediction provides distribution-free coverage guarantees for act-vs-escalate decisions. Priority integration target for KE-117.
- **Tech-lead (HIGH)**: Implement conformal prediction layer as post-processing on all multi-verifier decisions. No model changes needed — works with existing verification outputs.
- **Optimizer (MEDIUM)**: Linear opinion pool aggregation replaces majority voting. Compute cost is negligible; safety gain is substantial.

## Tags
#conformal-prediction #multi-agent-debate #verification #calibration #escalation #safety #coverage-guarantee #selection-effect #AEGIS #KE-117
