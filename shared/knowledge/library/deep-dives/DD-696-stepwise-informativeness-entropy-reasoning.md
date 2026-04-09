# DD-696: Stepwise Informativeness Assumption — Why Entropy Dynamics Predict Reasoning Correctness

**Paper**: The Stepwise Informativeness Assumption: Why are Entropy Dynamics and Reasoning Correlated in LLMs?  
**Authors**: Gonzàlez I Català, Sáez de Ocáriz Borde, Montañez, Liò (2026)  
**arXiv**: 2604.06192  
**Venue**: cs.CL (cross-listed cs.AI, cs.IT, cs.LG)  
**Relevance**: ★★★★  
**Session**: 393 (2026-04-09)

---

## Core Contribution

Provides the first theoretical framework explaining *why* internal entropy dynamics during generation correlate with external correctness. Introduces the **Stepwise Informativeness Assumption (SIA)**: correct reasoning prefixes accumulate answer-relevant information monotonically in expectation.

## Key Findings

1. **SIA emergence**: Maximum-likelihood training on human reasoning traces naturally induces SIA; SFT and RL reinforce it
2. **Observable signatures**: Correct traces show characteristic conditional answer entropy patterns — entropy decreases monotonically as generation progresses
3. **Multi-model validation**: Tested across Gemma-2, LLaMA-3.2, Qwen-2.5, DeepSeek, Olmo on GSM8K, ARC, SVAMP
4. **Training effect**: Models trained with longer reasoning chains show stronger SIA signatures

## Connection to Our Research

### For KE-095 (Behavioral Failure Prediction)
- SIA provides theoretical grounding for why behavioral signals (entropy patterns) can predict failure
- Correct traces show monotonically decreasing entropy → incorrect traces should show entropy spikes or plateaus
- This maps directly to DD-682 (Trajectory Guard) anomaly detection approach: entropy spike = potential failure

### For SELFDOUBT / HVR (DD-695)
- SIA explains why the no-hedge gate works: traces with no hedging have already accumulated sufficient answer-relevant information (low entropy throughout)
- Hedging language may be a surface correlate of high conditional answer entropy

### For Verification Confabulation (KE-093)
- Confabulated verification might show *false* entropy decrease — the model generates "verification" text that mimics the entropy signature of genuine verification without actually updating beliefs
- Prediction: confabulated verification steps will show smaller actual entropy decrease than genuine verification steps, even if the surface text looks similar

## Predictions
- **P-696a**: Entropy dynamics during tool-call-and-observe sequences will be more informative than raw HVR for failure prediction
- **P-696b**: Confabulated verification steps will show attenuated entropy decrease compared to genuine verification (testable with probing)

## Cross-References
- **DD-695** (SELFDOUBT): SIA explains why HVR works in reasoning tasks
- **DD-682** (Trajectory Guard): Anomaly detection in traces — SIA provides theoretical basis
- **KE-095**: Behavioral failure prediction pipeline
- **DD-691** (Failing to Falsify): Confirmation bias disrupts SIA's monotone convergence
