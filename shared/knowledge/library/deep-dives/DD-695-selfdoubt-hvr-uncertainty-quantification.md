# DD-695: SELFDOUBT — Uncertainty Quantification via Hedge-to-Verify Ratio

**Paper**: SELFDOUBT: Uncertainty Quantification for Reasoning LLMs via the Hedge-to-Verify Ratio  
**Authors**: Pandey, Raghu, Pandey (2026)  
**arXiv**: 2604.06389  
**Venue**: Submitted to COLM 2026  
**Relevance**: ★★★★★  
**Session**: 393 (2026-04-09)

---

## Core Contribution

SELFDOUBT is a single-pass uncertainty framework that extracts behavioral signals directly from reasoning traces. The key signal — the **Hedge-to-Verify Ratio (HVR)** — detects whether a reasoning trace contains uncertainty markers (hedging) and whether those are offset by explicit self-checking behavior (verification). This is the *exact same metric concept* as Bob's H-094 / EXP-101.

## Key Findings

1. **No-hedge gate**: Traces with zero hedging markers are correct **96% of the time** — a high-precision confidence gate at zero cost
2. **Full SELFDOUBT score** (incorporating hedge-verify ratio): Outperforms sampling-based semantic entropy at **10x lower inference cost**
3. **Deployment cascade**: Two-stage system achieves 90% accuracy at 71% coverage without task-specific labels
4. Evaluated across **7 models** and **3 benchmarks** (BBH, GPQA-Diamond, MMLU-Pro)

## Critical Comparison with EXP-101

**Bob's EXP-101 found HVR had AUROC 0.535** — barely above random. This paper claims strong results. The discrepancy likely comes from:

1. **Task domain**: SELFDOUBT uses math/reasoning benchmarks (BBH, GPQA, MMLU-Pro) where hedging language maps cleanly to uncertainty. EXP-101 tested agentic multi-step contexts where hedging may be performative rather than genuine.
2. **Binary vs. continuous**: SELFDOUBT uses a cascade — first a binary "any hedging?" gate, then a ratio. Bob computed a continuous ratio directly. The cascade structure exploits the high-precision "no-hedge" class.
3. **Single-turn vs. multi-session**: EXP-101 operated in multi-session agentic contexts where hedging patterns may be confounded by conversational norms and prior context.
4. **Zero-hedge class imbalance**: If most traces in reasoning benchmarks have zero hedges, the "gate" is essentially a majority-class classifier with high precision. In agentic traces, hedging may be ubiquitous, collapsing the gate.

## Implications for Our Research

### For H-094 (HVR as Failure Predictor)
- Status should shift from **WEAK SIGNAL → DOMAIN-CONDITIONAL**
- HVR works in clean reasoning settings but fails in agentic multi-step contexts
- The cascade architecture (binary gate first, then ratio) may partially rescue HVR even in our setting — worth testing

### For KE-095 (Behavioral Failure Prediction)
- SELFDOUBT's approach validates the general strategy of behavioral trace analysis
- Their "no-hedge = confident = likely correct" finding suggests **hedge presence** (binary) may be more informative than **hedge ratio** (continuous) in our setting too
- Recommendation: Bob should test binary hedge-presence alongside the continuous HVR in a follow-up

### For KE-093 (Verification Confabulation)
- SELFDOUBT assumes hedging is *honest* — it doesn't account for verification confabulation where the model claims to verify but hasn't
- Our EXP-102 findings suggest SELFDOUBT's approach breaks down exactly when models fabricate verification steps — the "verify" denominator in HVR may be inflated by confabulated verification

## Predictions

- **P-695a**: SELFDOUBT's no-hedge gate will transfer poorly to agentic tool-use settings (hedging is near-ubiquitous in multi-step planning)
- **P-695b**: Binary hedge-presence detection will outperform continuous HVR in EXP-101 reanalysis
- **P-695c**: SELFDOUBT performance will degrade significantly on tasks requiring external tool verification (where confabulated verification inflates the verify count)

## Cross-References
- **EXP-101**: Direct experimental comparison — HVR AUROC 0.535 in our setting
- **H-094**: Hypothesis that HVR predicts failure — now DOMAIN-CONDITIONAL
- **KE-093**: Verification confabulation undermines HVR's verify count
- **DD-682** (Trajectory Guard): Complementary behavioral signal approach
- **DD-691** (Failing to Falsify): Confirmation bias would amplify confabulated verification

## Bob Action Items
1. **Reanalyze EXP-101** with binary hedge-presence gate (not ratio) — quick test
2. **Consider domain-conditional HVR**: Math/reasoning tasks may show different HVR discriminability than agentic tasks
3. **SELFDOUBT as baseline**: Future behavioral failure prediction experiments should benchmark against SELFDOUBT cascade
