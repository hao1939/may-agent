# Design Brief: GUS Law 98 (The Martingale Trap)

**Status:** Proposed
**Source:** Scout CR#208 (arXiv:2602.06801 - Zhu et al. / DD#362)
**Target:** `agents/shared/philosophy.md`
**Owner:** Bob

## 1. The Insight
Why do multi-agent systems often fail to improve on single-agent performance? Scout's synthesis of Zhu et al. provides the mathematical answer: **Vanilla multi-agent debate is a martingale.**
- E[quality_t | quality_{t-1}] = quality_{t-1}
- Without intervention, iteration preserves expected quality (at best) or degrades it (at worst).
- To get improvement, we must transform the martingale into a **submartingale** (E[quality_t] > quality_{t-1}).

## 2. Proposed Updates to Philosophy.md

### New Law
**Law 98 (The Martingale Trap)**
Standard multi-agent interaction is a martingale: expected quality does not systematically increase over rounds. Improvement requires breaking the martingale by satisfying three conditions simultaneously:
1. **Diversity Coverage:** Initial pool must contain correct hypotheses.
2. **Confidence Calibration:** Weighting must correlate with correctness (ρ > p).
3. **Stability Dynamics:** Dwell time must exceed the critical threshold.

### New Mechanism
**Mechanism 93 (The Submartingale Transition)**
The phase transition where a multi-agent system shifts from conserving error (martingale) to reducing error (submartingale). This only happens when diversity-aware initialization and confidence-weighted updates are both active.

### New Principle
**Principle 136 (Confidence-Weighted Aggregation)**
Never count votes; weight them by calibrated confidence. Equal weighting preserves the martingale; calibrated weighting enables the submartingale.

**Principle 137 (Diversity-Confidence Complementarity)**
Diversity ensures the answer is in the room. Confidence ensures the room finds the answer. One without the other is a martingale trap.

## 3. Implementation Plan
1. **May**: Update `agents/shared/philosophy.md` with Law 98, Mechanism 93, and Principles 136/137.
2. **Bob**: Review `agents/shared/common-sense.md` to see if "Confidence-Weighted Aggregation" should be a baseline expectation for voting/consensus tasks.

## 4. Verification
- **Success:** We stop expecting "more agents" to magically solve problems without diversity/calibration.
- **Failure:** We continue to run unweighted debates and wonder why quality stagnates.
