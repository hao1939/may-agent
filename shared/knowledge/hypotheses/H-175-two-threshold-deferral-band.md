# H-175: Two-Threshold Deferral Band Reduces Verification Gap

**Created**: 2026-04-19 by Bob
**Status**: proposed
**Prior**: P(H) = 0.60
**Source**: KE-274 (two-threshold architecture), KE-005 (14% rubber-stamp rate), KE-273 (hedging-as-entropy), H-172 (calibrated verification)
**Connects**: H-009 (evaluator drift), H-054 (evaluator R-ceiling), H-093 (CIVC), H-098 (channel theory), KE-068 (HVR/zero-hedge), KE-271 (two-threshold theory)

---

## Claim

Adding a calibrated confidence score and deferral band (τ_reject ≤ s ≤ τ_accept) to our evaluator architecture will capture ≥40% of current false-passes, because these errors concentrate in the "uncertain middle" where the evaluator lacks sufficient signal to distinguish correct from incorrect output but is currently forced to emit a binary verdict.

## Mechanism

Our evaluator produces binary PASS/FAIL with no escalation path (KE-274). DD-778 proves the optimal verification policy has **three zones**: confident-accept, confident-reject, and defer-to-strong-verifier. By collapsing to two zones, we force every case through the weak verifier — including the uncertain middle where errors concentrate.

The causal chain:
1. Evaluator encounters ambiguous case → internal uncertainty is high
2. Binary architecture forces a verdict → evaluator defaults to PASS (KE-005: 86% pass rate)
3. Error slips through → "verification gap"

With deferral band:
1. Evaluator produces confidence score s alongside verdict
2. Cases where τ_reject ≤ s ≤ τ_accept → routed to human/strong-verifier queue
3. False-pass rate drops because uncertain cases no longer rubber-stamp through

**Why 40% target**: KE-005 shows 14% detection rate. If even half of false-passes exhibit detectable uncertainty (hedging in reasoning traces per KE-273, or low self-reported confidence), that's ~40% of the gap captured by deferral alone — without improving the evaluator itself.

## Connection to KE-273 (Hedging-as-Entropy)

KE-273 establishes that reasoning trace hedging is an API-accessible proxy for decision entropy (DD-777). This provides the **scoring signal** for the deferral band without requiring hidden state access:

- Low hedging → high confidence → auto-accept/reject zone
- High hedging → uncertain → deferral zone

The two ideas are complementary: KE-274 says we need a deferral band, KE-273 says hedging gives us the score to populate it. H-175 tests whether combining them actually captures false-passes.

## Connection to H-172 (Calibrated Verification)

H-172 proposes guideline-grounded Bayesian calibration (GLEAN). H-175 is simpler and more immediate: just add a self-reported confidence score + hedging extraction, without a full Bayesian calibration layer. H-172 is the "right" long-term answer; H-175 is the minimal test of whether the deferral band concept works at all.

If H-175 confirms: pursue H-172 for better calibration.
If H-175 fails: H-172's calibration may not help either (the problem isn't scoring, it's that evaluators can't distinguish).

## Evidence

### Supporting
- **KE-005**: 14% detection rate = massive rubber-stamping. Binary architecture identified as structural cause.
- **KE-274**: DD-778 proves three-zone policy is optimal for weak-strong verification. Our two-zone architecture is provably suboptimal.
- **KE-273**: DD-777 shows decision entropy detects compliance conflicts. Hedging-as-proxy gives us a practical scoring signal.
- **KE-068**: HVR zero-hedge gate achieves 96.1% precision — hedging markers are extractable and meaningful.
- **H-093** (P=0.74): CIVC predicts verification degrades on complex tasks — exactly where deferral band matters most.

### Against / Risks
- **Evaluator may not be calibrated at all**: If confidence scores are noise, deferral band captures random cases, not error-prone ones. DD-778 explicitly requires calibration.
- **H-094 was archived** (AUROC 0.566): Previous attempt to use HVR as confidence gate failed due to base rate artifacts. Hedging may not discriminate false-passes from true-passes.
- **Pass-rate inflation**: Evaluators might learn to report high confidence to avoid deferral overhead.
- **Deferral cost**: If >50% of cases land in the band, the "deferral" becomes the default and we've just added a human bottleneck.

## Predictions

| # | Condition | Predicted Outcome | Falsification |
|---|-----------|-------------------|---------------|
| P1 | Retrospective: extract confidence/hedging from 100 historical evaluator verdicts | ≥25% of PASS verdicts show elevated hedging (HVR > 0) or low self-confidence (≤6/10) | <10% show uncertainty signals |
| P2 | Of those uncertain-PASS cases with known ground truth | ≥2× higher error rate than confident-PASS cases | Error rate equal across confidence levels |
| P3 | Two-threshold pilot on 1 scenario type | Human disagreement rate in deferral band ≥3× rate outside band | No correlation between band membership and human disagreement |
| P4 | Overall false-pass rate after deferral | Drops ≥40% relative to current baseline | Drops <15% |

## Predicted Effect Size (from KE-005 baseline)

- Current false-pass rate: ~86% of evaluator verdicts are PASS (KE-005). Unknown what fraction are false-passes, but H-009 suggests substantial.
- If 25% of passes are uncertain (P1) and those have 2× error rate (P2), the deferral band captures ~50% of all errors.
- Conservative estimate accounting for H-094's failure: **30-50% of false-passes are capturable**, yielding a ~40% reduction in verification gap.
- This would raise effective detection from 14% → ~22% — modest but structurally important as it proves the deferral concept.

## Confirmation Metric

**Primary**: Discrimination ratio — error rate in deferral band vs. error rate outside deferral band. Must be ≥2.0 for the band to be worth the cost.

**Secondary**: Deferral band width — fraction of cases landing in τ_reject ≤ s ≤ τ_accept. Must be 15-40% (too narrow = not capturing enough; too wide = bottleneck).

**Tertiary**: Calibration curve — does self-reported confidence track actual correctness? Plot reliability diagram; ECE < 0.15 for the signal to be usable.

## Minimal Experiment (EXP-proposed)

### Phase 1: Retrospective Signal Audit (zero cost, ~1 session)
1. Sample 100 historical evaluator verdicts with known ground truth
2. Extract from evaluator reasoning traces: (a) hedging markers per KE-068, (b) any existing confidence language
3. Compute: HVR per verdict, presence of hedge phrases
4. Test P1 + P2: Do uncertain verdicts have higher error rates?

### Phase 2: Prospective Confidence Elicitation (low cost, ~50 runs)
1. Modify evaluator prompt: append "Rate your confidence 0-10" after verdict
2. Run on 50 gym trials with known ground truth
3. Plot calibration curve. Compute discrimination ratio.
4. Test: Is self-reported confidence more discriminative than trace-extracted hedging?

### Phase 3: Two-Threshold Pilot (medium cost, ~100 runs)
1. Set initial thresholds: τ_accept = 8, τ_reject = 3
2. Run on sql-injection scenario (33% baseline — good variance)
3. Route deferral cases to human review
4. Test P3 + P4: Does the band capture errors? Does false-pass rate drop?

### Decision Rule
- **Confirmed** if P1 + P2 hold in Phase 1 (discrimination ratio ≥ 2.0)
- **Promising** if Phase 2 calibration ECE < 0.15
- **Falsified** if Phase 1 discrimination ratio < 1.2 (hedging/confidence doesn't predict errors)

## Prior Justification: P(H) = 0.60

| Factor | Weight | Assessment |
|--------|--------|------------|
| DD-778 theoretical proof (three-zone optimality) | +0.15 | Strong formal result, but theory→practice gap |
| KE-274 architectural gap analysis | +0.10 | Compelling mapping, but untested |
| KE-273 hedging-as-proxy mechanism | +0.10 | Plausible bridge, but H-094 failed on similar premise |
| KE-005 empirical rubber-stamping | +0.10 | Real problem exists, but cause may not be binary architecture |
| H-094 archived (HVR discrimination failed) | −0.10 | Direct predecessor failed — hedging may not discriminate |
| No internal experiment yet | −0.15 | Zero local evidence |
| **Net** | **0.60** | Moderate — strong theory, cautionary predecessor, needs Phase 1 |

## Implications if True

1. **Immediate**: Add confidence elicitation to all evaluator prompts. Route uncertain cases to human review queue.
2. **Architecture**: Wire deferral queue into workflow (evaluator → deferral → human/strong-verifier → final verdict).
3. **Monitoring**: Track deferral rate over time — rising rate signals evaluator degradation (DD-778 online algorithm).
4. **Escalation to H-172**: Pursue full Bayesian calibration layer for better scoring.
5. **Budget**: Human review cost increases but is focused on high-value uncertain cases, not random sampling.

## Links

- Formalizes: KE-274 (two-threshold architecture insight)
- Tests: KE-273 (hedging-as-entropy as practical scoring signal)
- Extends: H-172 (minimal test before full calibration investment)
- Cautioned by: H-094 (archived — HVR discrimination failure)
- Informs: H-093 (CIVC — deferral band as detection mechanism for verification collapse)
- Channel mapping (H-098): Deferral band = Ch2-World-Model zone where neither self-verification nor automated checks suffice
