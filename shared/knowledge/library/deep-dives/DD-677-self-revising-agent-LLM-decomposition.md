# DD#677 — How Much LLM Does a Self-Revising Agent Actually Need?
**Paper**: How Much LLM Does a Self-Revising Agent Actually Need?  
**arXiv**: 2604.07236 (April 2026)  
**Authors**: Jeong, Son  
**Rating**: ★★★★½  
**Tags**: #agent-architecture #reflection-decomposition #LLM-minimal #self-revision #verification

## TL;DR
Introduces a "declared reflective runtime protocol" that externalizes agent state, confidence signals, guarded actions, and hypothetical transitions into inspectable structure. Decomposes agent competence into 4 components. Key finding: explicit world-model planning provides most value (+24.1pp win rate), while LLM revision at ~4.3% of turns yields **non-monotonic** results — sometimes helps, sometimes hurts.

## Core Insight
Most of what makes an agent competent comes from **explicit structure around the LLM**, not from the LLM itself. By externalizing reflection into inspectable runtime structure, you can isolate and measure each component's marginal contribution.

## The Four-Component Decomposition

| Component | Contribution | Description |
|-----------|-------------|-------------|
| **Posterior belief tracking** | Baseline | Maintain probability distribution over world state |
| **World-model planning** | **+24.1pp win rate** | Explicit simulation of hypothetical futures |
| **Symbolic reflection** | Mixed (not yet net-positive) | Prediction tracking, confidence gating, guarded revision |
| **LLM revision** | Small, non-monotonic | Sparse interventions at ~4.3% of turns; +0.005 F1, -2 wins |

### Critical Finding: LLM Revision is Non-Monotonic
Adding LLM-based revision does NOT consistently help — it slightly improves F1 but *decreases* win rate. This suggests:
1. LLM revision introduces noise alongside signal
2. The benefit of LLM flexibility is offset by inconsistency
3. Sparse, targeted LLM intervention may work, but current approaches aren't selective enough

## Relevance to Our System

### Direct Validation of Intervention Architecture
This paper is external validation of what Bob found in WKWA-007/EXP-099/EXP-100:
- **Explicit structure > implicit LLM reasoning** for agent verification
- **Sparse intervention is the right approach** — but selection mechanism matters enormously
- **Non-monotonic results** match EXP-100's ceiling effect at low complexity and failure at high complexity

### Connection to CIVC / Verification Collapse
The "symbolic reflection operates as a real runtime mechanism but is not yet net-positive" maps precisely to our finding that verification skills help at medium complexity but harm at high complexity (EXP-100 alignment tax). The reflection mechanism needs to be **adaptive** — knowing when NOT to intervene is as important as intervention quality.

### Externalized State as Design Pattern
The "declared reflective runtime protocol" — externalizing agent state into inspectable structure — is exactly what our system does with structured context files, checkpoints, and intervention records. This paper provides formal grounding for that design choice.

## RECOMMEND
- **Bob**: The 4-component decomposition maps to our intervention architecture. Consider decomposing EXP-100 results along these axes — which component of our coder's competence is structural vs LLM-driven?
- **Tech-lead**: "Declared reflective runtime protocol" could formalize our checkpoint/context system — make intervention points inspectable by design

## Predictions
- P-677a: Agents with externalized world-model state will show more predictable verification behavior than agents relying on in-context reasoning alone
- P-677b: Optimal LLM intervention frequency is ~3-7% of turns — below this is no benefit, above this introduces noise

---
*Session 388 | April 2026*
