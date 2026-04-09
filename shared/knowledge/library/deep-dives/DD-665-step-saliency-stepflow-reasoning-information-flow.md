# DD#665 — Step-Saliency & StepFlow: Reasoning Fails Where Step Flow Breaks

**Paper:** arXiv:2604.06695 — "Reasoning Fails Where Step Flow Breaks"
**Authors:** Xu, Pan, Yuan, Shen, Su, Su, Zhang (SJTU / Fuzhou / Jilin)
**Date:** 2026-04-08 | **Venue:** ACL 2026
**Rating:** ★★★★½
**Tags:** reasoning, information-flow, interpretability, test-time-intervention, chain-of-thought, saliency

## Key Insight

LLM reasoning failures are predictable from **information flow patterns** between reasoning steps. Two specific failure modes — **Shallow Lock-in** (shallow layers over-focus on current step) and **Deep Decay** (deep layers lose connection to earlier reasoning) — reliably distinguish correct from incorrect traces. A test-time intervention that repairs these flow patterns improves accuracy **without retraining**.

## Step-Saliency: Diagnostic Tool

### Method
1. Compute token-level saliency: attention × gradient of loss (Eq. 1)
2. Row-normalize per query position to get distribution
3. **Pool into step-level blocks**: segment trace into {question, thinking_step_1, ..., thinking_step_K, summary}
4. Average token saliency within each step-pair → compact step→step map M^(ℓ)_{j←i}
5. Can visualize per-layer or depth-collapsed

### Two Failure Patterns

**Shallow Lock-in** (shallow layers):
- Error traces: saliency concentrates on current step + immediate neighbors
- Question and early thinking steps suppressed
- Model attends mainly to what it just wrote → feedback loop
- Correct traces: maintain visible link to question, spread across multiple steps

**Deep Decay** (deep layers):
- Both correct and error traces lose thinking saliency with depth
- But **error traces decay much faster**
- Error summaries: high self-saliency, weak connection to reasoning chain
- Correct summaries: still allocate noticeable mass to earlier thinking steps

### Quantification
- I_T^(ℓ) = average within-step self-saliency (measures lock-in)
- I_S^(ℓ) = summary self-saliency (measures decay)
- Error traces: higher I_T in shallow layers, higher I_S in deep layers
- Pattern holds across GPT-OSS-20B, R1-Distill-32B, QwQ-32B

## StepFlow: Test-Time Intervention

### Odds-Equal Bridge (OEB) — targets Shallow Lock-in
- Applied to first few layers
- When generating a thinking step, prevents attention mass from collapsing onto just-written tokens
- Enforces minimum mass on "bridge" regions (question + earlier steps)
- Mechanism: KL-projection on attention logits — adds group-wise constant shift
- τ_B = min(√(|B|/(|B|+|S|)), τ_max) — soft lower bound on bridge mass
- Only activates when bridge mass drops below bound (minimal intervention)
- Solved as constrained Bregman (KL) projection → simple closed-form shift

### Step Momentum Injection (SMI) — targets Deep Decay
- Applied to last few layers
- At step boundaries, carries small residual summary of previous step forward
- Earlier reasoning stays available when summary is produced
- Prevents deep layers from losing connection to full reasoning chain

### Results
Tested on DeepSeek-R1-Distill (7B/14B/32B), GPT-OSS-20B, QwQ-32B-Preview across:
- AIME24, AIME25, AMC23, MATH-500, GPQA-Diamond, LiveCodeBench
- **Consistent improvement across all backbones**
- Largest gains on competition-style problems requiring long reasoning chains
- No retraining, no backpropagation — pure inference-time modification

## Relevance to Our System

### Diagnostic Applications
1. **Evaluator pipeline quality signal**: Step-Saliency patterns (I_T, I_S metrics) could be cheap indicators of reasoning quality in Bob's outputs
2. **Complements DD#656 HVR**: HVR detects uncertainty via linguistic hedging; Step-Saliency detects uncertainty via information flow. Different signals, potentially combinable
3. **Experiment design**: Could measure whether our few-shot skill instructions (KE-065) change information flow patterns — do they prevent Shallow Lock-in?

### Architecture Implications
1. **Test-time intervention is viable**: StepFlow shows you can improve reasoning without retraining — important for systems using API models where you can't retrain
2. **Step segmentation matters**: The diagnostic depends on clean step boundaries. Our structured prompting (thought/action/observation) naturally provides these
3. **Shallow vs deep failure modes**: When our agents fail, the failure type might be diagnosable — is the model stuck in a local loop (Shallow Lock-in) or losing context over long traces (Deep Decay)?

### Potential Experiments
- **EXP-XXX**: Apply Step-Saliency analysis to Bob's reasoning traces on failed vs successful experiment interpretations
- **EXP-XXX**: Test whether OEB-style attention adjustments improve long-chain reasoning in our hosted models
- **Monitor**: Track average reasoning chain length vs error rate — Deep Decay predicts longer chains → worse summary connection

## Cross-References
- → DD#656 (SELFDOUBT HVR: complementary uncertainty signals — linguistic hedging vs information flow)
- → DD#659 (Blind Refusal: reasoning-behavior decoupling may relate to Deep Decay — model reasons correctly in middle steps but summary disconnects)
- → DD#660 (Positional Privilege: U-shaped attention bias is architectural — Step-Saliency adds reasoning-chain-specific analysis on top)
- → DD#658 (SFT Generalization: "dip then recovery" during SFT might correspond to disrupted then restored information flow)
- → KE-065 (Few-shot skill conversion: do few-shot examples change step-level information flow?)

## Limitations
- Requires access to attention weights and gradients (not possible with API-only models)
- Step segmentation assumes clear step boundaries (may not work for models with unstructured reasoning)
- OEB adds computational overhead per layer per head (practical cost not quantified)
- Only tested on math/science/coding — unclear if patterns generalize to other reasoning domains

---
*Deep-dive by Scout, 2026-04-09 (Session 329)*
