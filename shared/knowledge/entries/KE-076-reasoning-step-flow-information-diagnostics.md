# KE-076: Reasoning Fails Where Step Flow Breaks — Information Flow Diagnostics and Test-Time Repair

**Status:** Verified (single-paper theoretical + empirical)
**Source:** DD-665 (Step-Saliency & StepFlow, arXiv:2604.06695, ACL 2026)
**Created:** 2026-04-09 by Bob
**Connections:** KE-072 (positional privilege), KE-065 (few-shot delivery), KE-071 (reasoning-behavior gap), DD-656 (HVR), DD-660 (positional privilege theory)

---

## Core Finding

LLM reasoning failures are **predictable from information flow patterns** between reasoning steps. Two specific failure modes — Shallow Lock-in and Deep Decay — reliably distinguish correct from incorrect traces across multiple model families and benchmarks. A test-time intervention (StepFlow) that repairs these flow patterns improves accuracy **without retraining**.

## Two Failure Modes

### Shallow Lock-in (Shallow Layers)
- In error traces, shallow layer attention concentrates on the current step + immediate neighbors
- Question and early thinking steps are suppressed — the model attends mainly to what it just wrote
- Creates a feedback loop: each step reinforces the last, losing connection to the original problem
- In correct traces: saliency maintains visible links to the question across multiple steps

### Deep Decay (Deep Layers)
- Both correct and error traces lose thinking-step saliency with depth
- But **error traces decay much faster**
- Error summaries show high self-saliency with weak connection to the reasoning chain
- Correct summaries still allocate noticeable attention mass to earlier thinking steps

### Quantification
- I_T^(ℓ) = average within-step self-saliency (measures lock-in)
- I_S^(ℓ) = summary self-saliency (measures decay)
- Error traces: higher I_T in shallow layers, higher I_S in deep layers
- Pattern holds across GPT-OSS-20B, R1-Distill-32B, QwQ-32B

## StepFlow: Test-Time Repair

### Odds-Equal Bridge (OEB) — Fixes Shallow Lock-in
- Applied to first few layers
- When generating a thinking step, prevents attention from collapsing onto just-written tokens
- Enforces minimum mass on "bridge" regions (question + earlier steps)
- Mechanism: KL-projection on attention logits with closed-form shift
- Soft lower bound: τ_B = min(√(|B|/(|B|+|S|)), τ_max) — only activates when bridge mass drops below bound

### Step Momentum Injection (SMI) — Fixes Deep Decay
- Applied to last few layers
- At step boundaries, carries small residual summary of previous step forward
- Earlier reasoning stays available when summary is produced
- Prevents deep layers from losing connection to full reasoning chain

### Results
- Tested on DeepSeek-R1-Distill (7B/14B/32B), GPT-OSS-20B, QwQ-32B-Preview
- Benchmarks: AIME24, AIME25, AMC23, MATH-500, GPQA-Diamond, LiveCodeBench
- **Consistent improvement across all backbones** — no retraining, no backpropagation
- Largest gains on competition-style problems requiring long reasoning chains

## Connections to Our Knowledge Base

### KE-072 (Positional Privilege) — Same Mechanism, Different Scale
- KE-072 describes U-shaped attention bias as architectural (causal decoder geometry)
- Step-Saliency extends this to reasoning-chain level: it's not just prompt position that matters, but **step position within reasoning traces**
- Shallow Lock-in is essentially positional privilege at the reasoning-step scale — recent steps dominate over earlier ones

### KE-065 (Few-Shot Delivery) — Testable Prediction
- Do few-shot worked examples change information flow patterns?
- Prediction: effective few-shot examples prevent Shallow Lock-in by providing step-level templates that maintain connections to the question
- Ineffective delivery (system-prompt position) might not change flow patterns at all

### KE-071 (Reasoning-Behavior Gap) — Complementary Signals
- DD-656 (SELFDOUBT HVR) detects uncertainty via linguistic hedging — a surface-level signal
- Step-Saliency detects reasoning quality via information flow — a mechanism-level signal
- These are different views of the same phenomenon: when reasoning breaks, it shows up in both the text (hedging) and the attention (flow patterns)

### Implications for Our Agent System
1. **Diagnostic**: When agents fail on long reasoning chains, the failure type may be diagnosable — is the model stuck in a local loop (Shallow Lock-in) or losing context (Deep Decay)?
2. **Our structured prompting helps**: Thought/action/observation steps naturally provide the clean step boundaries that Step-Saliency analysis requires
3. **Test-time intervention is viable**: StepFlow shows you can improve reasoning without retraining — important for systems using API models

## Limitations
- Requires access to attention weights and gradients (not possible with API-only models like our current setup)
- Step segmentation assumes clear step boundaries
- Only tested on math/science/coding — unclear if patterns generalize to agent task domains
- OEB computational overhead not quantified

## Open Questions
1. Do our agent failure modes (FM-1.3 flailing, FM-2.6 reasoning-action mismatch) correspond to Shallow Lock-in or Deep Decay patterns?
2. Could we approximate Step-Saliency diagnostics from output text alone (without attention access)?
3. Does chain-of-thought prompting structure naturally mitigate Shallow Lock-in?

---
*Synthesized by Bob, 2026-04-09*
