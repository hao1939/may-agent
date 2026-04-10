# DD#724: Planner-Auditor Twin — Agentic Discharge Planning with Calibrated Confidence

**Paper**: arXiv:2601.21113 — "Planner-Auditor Twin: Agentic Discharge Planning with Calibrated Confidence"  
**Authors**: (Healthcare AI / Agentic Systems group, Jan 2026)  
**Scout Rating**: ★★★★ EXCELLENT  
**Gap Addressed**: CR#324 Gap 1 — **Signal Calibration**

---

## Summary

Introduces a dual-agent architecture where a Planner agent generates multi-step plans and a paired Auditor agent provides calibrated confidence scores using Brier Score and Expected Calibration Error (ECE) as training objectives. The Auditor is trained not just to predict correctness but to produce *well-calibrated* probability estimates — meaning a 70% confidence prediction should be correct 70% of the time.

## Key Contributions

1. **Explicit calibration training**: Auditor agent optimized on Brier Score (proper scoring rule) rather than binary accuracy, producing genuinely calibrated confidence
2. **Dual-agent architecture**: Planner and Auditor are separate models, preventing the self-assessment bias documented in DD#719 (LLM debate overconfidence)
3. **Self-improvement loop**: Calibration feedback from the Auditor drives iterative plan refinement — plans with low-confidence steps get re-planned
4. **ECE as operational metric**: Expected Calibration Error measured across confidence bins, providing actionable reliability curves

## Connection to CR#324 Gap Analysis

**Gap 1 (Signal Calibration)**: CR#324 identified that our verification DSL audits *decisions given scores* but never checks whether the scores themselves are accurate. This paper directly addresses this by training a dedicated agent whose entire purpose is producing well-calibrated scores.

**Concrete implications for our stack**:
- The Auditor role maps to a "calibration monitor" in the verification orchestration stack
- Brier Score as the training/evaluation metric provides a principled alternative to our current uncalibrated confidence signals
- The dual-agent pattern (separate Planner and Auditor) prevents the self-assessment bias that makes single-agent confidence unreliable

## Key Insights

1. **Calibration ≠ Accuracy**: An agent can be highly accurate but poorly calibrated (always says 95% confidence regardless of actual correctness). This paper separates the two concerns.
2. **Proper scoring rules matter**: Brier Score incentivizes truthful probability reporting; log-loss or accuracy do not. Design choice has downstream implications for verification budget allocation (DD-701's tie-rate optimization depends on calibrated scores).
3. **Separation of concerns**: The Planner never needs to self-assess; the Auditor never needs to plan. This prevents the "confidence escalation" problem (DD#719) where agents become more confident when challenged.

## Limitations

- Healthcare domain (discharge planning) — transfer to software engineering agentic tasks not validated
- Auditor training requires ground-truth correctness labels, which are scarce for open-ended agent tasks
- Does not address calibration drift over time (CR#324 Gap 2 — dynamic profiles)

## Cross-References

- **CR#324**: Gap 1 (Signal Calibration) — directly addressed
- **DD#719**: LLM Debate Overconfidence — dual-agent pattern prevents confidence escalation
- **DD#717**: HTC Agentic Confidence Calibration — complementary trajectory-level approach
- **DD-701**: Tie-rate budget optimization depends on calibrated signals
- **KE-104**: Complete Verification Architecture — Auditor fills the calibration gap

---
*Scout DD#724 | 2026-04-10 | CR#324 Gap-Filling Research*
