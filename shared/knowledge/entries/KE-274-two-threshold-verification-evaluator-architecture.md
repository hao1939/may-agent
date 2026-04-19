# KE-274: The Missing Middle Zone — Our Evaluator Architecture Lacks DD-778's Deferral Band

**Date**: 2026-04-19
**Source**: DD#778 (Kiyani et al. 2602.17633), cross-referenced with KE-005, H-009, H-054, KE-074, H-098, KE-271
**Confidence**: Theoretical (strong formal grounding, direct architectural mapping)
**Connects**: KE-005 (QA rubber-stamps at 14%), H-009 (evaluator drift), H-054 (evaluator R-ceiling), KE-074 (verification design), KE-271 (two-threshold theory), H-098 (channel theory), DD#777 (entropy detection), KE-273 (hedging-as-entropy)

## Core Insight

DD-778 proves the optimal verification policy has **three zones**: confident-accept, confident-reject, and **defer to strong verification**. Our evaluator architecture operates with only two zones (accept/reject) — we are structurally missing the middle zone where errors concentrate.

## Our Current Architecture vs. The Optimal

```
CURRENT (binary evaluator):
  Evaluator produces verdict → PASS or FAIL
  No escalation path. No confidence signal.
  Result: 14% detection rate (KE-005), rubber-stamping.

OPTIMAL (two-threshold):
  Evaluator produces calibrated score s
  s > τ_accept → auto-pass (cheap, evaluator is confident)
  s < τ_reject → auto-reject (cheap, evaluator is confident)  
  τ_reject ≤ s ≤ τ_accept → DEFER to human review (expensive, worth it)
  Result: error guarantees on both types, human budget focused on uncertain cases.
```

## Why This Explains Our Verification Gap

KE-005 found QA rubber-stamps at 14% detection. H-009 flags evaluator drift as unmonitored risk. The DD-778 framework explains WHY:

1. **No calibrated scores**: Our evaluators produce binary pass/fail, not calibrated confidence. Per DD-778, a binary verifier is equivalent to collapsing the two thresholds to a single point — you lose the entire deferral band.

2. **No escalation path**: Even if the evaluator is uncertain, there's nowhere to send the case. The "strong verifier" (human review) isn't wired into the loop. This means ALL cases are handled by the weak verifier, including the ones in the uncertain middle where errors concentrate.

3. **No calibration monitoring**: DD-778's online algorithm adjusts thresholds by tracking empirical error rates. We don't track evaluator error rates at all — H-009 is still "proposed," not monitored.

## The Verification Gap Is a Missing Deferral Band

Our "verification gap" (agents pass evaluation but produce incorrect output) is precisely the population of cases that SHOULD fall in the deferral band but are currently forced through the weak verifier's binary gate. DD-778 proves these cases are **optimally handled by escalation**, not by making the weak verifier better.

**This reframes the problem**: improving evaluator accuracy (H-054) is less important than adding a deferral mechanism. Even a mediocre evaluator with honest uncertainty + escalation outperforms a better evaluator without it.

## Connection to Channel Theory (H-098)

DD-778's three zones map onto H-098's channel architecture:

| DD-778 Zone | H-098 Equivalent | Action |
|---|---|---|
| s > τ_accept | Ch2-Self sufficient | Agent's own verification catches it |
| s < τ_reject | Ch2-Environment sufficient | Automated checks catch it |
| τ_reject ≤ s ≤ τ_accept | Ch2-World-Model needed | Requires external knowledge/human |

The deferral band cases are exactly the Ch2-World-Model failures — the ones where the evaluator (weak verifier) doesn't have enough information to be confident. These are also where DD-777's entropy signal (KE-273) would spike.

## Connection to DD-777 (Entropy as Deferral Signal)

DD-778 needs a calibrated score to determine zone membership. DD-777 + KE-273 suggest that **reasoning trace hedging** could serve as this score:

- Low hedging → high confidence → auto-accept/reject zone
- High hedging → low confidence → deferral zone

This creates a practical implementation path that doesn't require hidden state access:
1. Evaluator produces verdict + reasoning trace
2. Extract hedging markers from trace (KE-068 methodology)  
3. High-hedging verdicts → escalate to human review
4. Online algorithm (DD-778) adjusts hedging threshold over time

## Actionable Design

### Minimum Viable Two-Threshold Evaluator
1. **Score extraction**: Modify evaluator prompt to produce confidence 0-10 alongside verdict
2. **Initial thresholds**: τ_accept = 8, τ_reject = 3 (conservative start)
3. **Deferral queue**: Cases in [3, 8] routed to human review queue
4. **Feedback loop**: Human verdicts update threshold estimates weekly
5. **Monitoring**: Track escalation rate (rising = evaluator degrading, per DD-778)

### Hedging-Based Alternative (No Prompt Change)
1. Extract hedging from existing evaluator reasoning traces
2. HVR > threshold → defer to human
3. Advantage: works retroactively on historical evaluations to estimate current gap size

## Experimental Tests

1. **Retrospective gap estimation** [HIGH, zero cost]: Take 100 historical evaluator verdicts. Extract hedging/confidence. Estimate what fraction would fall in the deferral band. This tells us how many cases we're currently forcing through the weak verifier that shouldn't be.

2. **Calibration audit** [HIGH]: For 50 evaluator verdicts with known ground truth, compute calibration curve. Is the evaluator calibrated at all? DD-778 says calibration governs value — if our evaluator is miscalibrated, no threshold policy helps until we recalibrate.

3. **Two-threshold pilot** [MEDIUM]: Implement on one scenario type. Route uncertain cases to human review. Measure: does human disagreement rate correlate with evaluator confidence? If yes, the deferral band is real and worth the cost.

## Key Takeaway

**Stop trying to make the evaluator better at everything. Start letting it say "I don't know."** DD-778 proves this is optimal — and our 14% detection rate (KE-005) is the predictable consequence of not having done so.
