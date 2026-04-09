# KE-077: Step-Saliency — Reasoning Failures Are Predictable from Information Flow Patterns

**Status**: Empirically Supported (ACL 2026, tested on 5 model families across 6 benchmarks)
**Source**: DD-665 (Step-Saliency & StepFlow: Reasoning Fails Where Step Flow Breaks — Xu et al., SJTU/Fuzhou/Jilin)
**Confidence**: High (reproducible across GPT-OSS-20B, R1-Distill-7B/14B/32B, QwQ-32B; peer-reviewed ACL 2026; test-time intervention shows consistent improvement without retraining)
**Created**: 2026-04-09

---

## One-Sentence Summary

LLM reasoning failures are **predictable and repairable** from information flow patterns between reasoning steps: two specific failure modes — Shallow Lock-in (shallow layers over-focus on current step) and Deep Decay (deep layers lose connection to earlier reasoning) — reliably distinguish correct from incorrect traces, and a test-time intervention (StepFlow) that repairs these patterns improves accuracy without retraining.

---

## The Finding

### Step-Saliency: A Diagnostic Tool for Reasoning Quality

**Method:** Compute attention × gradient saliency, pool into step-level blocks (question → thinking_step_1 → ... → thinking_step_K → summary), create compact step→step map per layer.

### Two Failure Modes

**1. Shallow Lock-in (shallow layers)**
- Error traces: saliency concentrates on current step + immediate neighbors
- Question and early thinking steps are suppressed
- The model attends mainly to what it just wrote → **feedback loop**
- Correct traces: maintain visible link back to question, spread attention across multiple steps
- Measured by: I_T^(ℓ) = average within-step self-saliency

**2. Deep Decay (deep layers)**
- Both correct and error traces lose thinking saliency with depth
- But **error traces decay much faster**
- Error summaries: high self-saliency, weak connection to reasoning chain
- Correct summaries: still allocate noticeable attention mass to earlier thinking steps
- Measured by: I_S^(ℓ) = summary self-saliency

### Pattern Consistency
Error traces show: higher I_T in shallow layers, higher I_S in deep layers — pattern holds across **all five model families tested** (GPT-OSS-20B, R1-Distill-7B/14B/32B, QwQ-32B).

### StepFlow: Test-Time Repair

**Odds-Equal Bridge (OEB) — targets Shallow Lock-in:**
- Applied to first few transformer layers
- When generating a thinking step, prevents attention mass from collapsing onto just-written tokens
- Enforces minimum mass on "bridge" regions (question + earlier steps)
- Mechanism: KL-projection on attention logits → simple closed-form shift
- Only activates when bridge mass drops below bound (minimal intervention)

**Step Momentum Injection (SMI) — targets Deep Decay:**
- Applied to last few transformer layers
- At step boundaries, carries small residual summary of previous step forward
- Prevents deep layers from losing connection to full reasoning chain

**Results:** Consistent improvement across all 5 model backbones on AIME24/25, AMC23, MATH-500, GPQA-Diamond, LiveCodeBench. Largest gains on competition-style problems requiring **long reasoning chains**. No retraining required.

---

## Why This Matters

### 1. Reasoning Quality Is Diagnosable Without Retraining

This is the first work to show that reasoning failure modes have **specific, measurable information flow signatures**. Before this: we could only judge reasoning quality by checking the final answer. Now: we can predict whether a reasoning trace will succeed from its internal flow patterns.

### 2. Two Complementary Uncertainty Signals

| Signal Source | What It Detects | Requires |
|---|---|---|
| DD-656 SELFDOUBT HVR (KE-068) | Zero-hedge markers → 96.1% correct | Only text output (API-compatible) |
| DD-665 Step-Saliency | I_T/I_S flow patterns → correct vs error | Attention weights + gradients (self-hosted only) |

These are **independent and complementary** — linguistic surface (hedging) vs. computational internals (attention flow). Combined, they could provide high-confidence reasoning quality assessment.

### 3. Connects to Our Chain-of-Thought Architecture

Our system naturally provides the clean step boundaries that Step-Saliency requires:
- Thought/action/observation structure = natural step segmentation
- Agent reasoning traces are already step-structured
- Few-shot skill instructions (KE-065) may change information flow patterns — testable prediction

### 4. Test-Time Intervention Without Model Access Changes Everything

StepFlow shows you can improve reasoning **at inference time** without retraining. For systems using API models (where you can't retrain):
- Structured prompting that prevents Shallow Lock-in (e.g., forcing reference back to original question)
- Context management that prevents Deep Decay (e.g., periodic summaries of earlier reasoning)
- These are **prompt-level analogs** of OEB and SMI

### 5. Explains Long-Chain Reasoning Degradation

Deep Decay predicts that longer reasoning chains → worse summary connection to earlier steps. This explains:
- Why complex multi-step agent tasks degrade with chain length
- Why our agents sometimes "forget" the original goal in long sessions
- Why periodic re-grounding (referencing the task) improves output quality

---

## Extends the Knowledge Web

| Existing KE | How KE-077 Extends It |
|---|---|
| KE-068 (Zero-Hedge Gate) | Complementary uncertainty signal: linguistic hedging (text-only) + information flow (weights-required) |
| KE-071 (Reasoning-Behavior Gap) | Reasoning quality is now measurable internally, not just externally — the gap between good reasoning and good behavior can be precisely located |
| KE-072 (Positional Privilege) | U-shaped attention bias is architectural; Step-Saliency adds reasoning-chain-specific analysis on top of the general positional pattern |
| KE-065 (Few-Shot Skill Conversion) | Testable prediction: do few-shot examples change step-level information flow? Do they prevent Shallow Lock-in? |
| KE-074 (Universal Verification) | Process evaluation could incorporate I_T/I_S metrics as reasoning quality signals alongside rubric scoring |

---

## Limitations

1. **Requires attention weights + gradients**: Not possible with API-only models (OpenAI, Anthropic)
2. **Step segmentation assumption**: Requires clear step boundaries — may not work for unstructured reasoning
3. **OEB computational overhead**: Not quantified — practical cost of per-layer attention modification unknown
4. **Domain coverage**: Only tested on math/science/coding — unclear if patterns generalize to other reasoning domains (e.g., strategic planning, creative writing)

---

## Predictions

- **P-077-1**: Prompt-level analogs of OEB (forcing periodic reference to original question/earlier steps) will improve long-chain reasoning quality by 5-15%. (75% confidence)
- **P-077-2**: Shallow Lock-in pattern will correlate with our observation of agents "going in circles" on difficult tasks. (80% confidence)
- **P-077-3**: Deep Decay will correlate with session length → quality degradation in our agents. (70% confidence)
- **P-077-4**: Combining hedging detection (KE-068) with information flow analysis will outperform either alone for reasoning quality prediction. (70% confidence — requires self-hosted models)

---

## Connections

- **Complements**: KE-068 (Zero-Hedge Gate) — independent uncertainty signals, potentially combinable
- **Deepens**: KE-071 (Reasoning-Behavior Gap) — reasoning quality now measurable from internal flow, not just external outcomes
- **Extends**: KE-072 (Positional Privilege) — attention bias as general mechanism + step-level reasoning analysis
- **Informs**: KE-065 (Few-Shot Skills) — do few-shot examples change step information flow?
- **Cross-refs**: DD-659 (Blind Refusal — reasoning-behavior decoupling may relate to Deep Decay), DD-660 (Positional Privilege), DD-658 (SFT Generalization — training phase flow disruption)

---

## Actionable Implications

1. **HIGH PRIORITY**: Implement prompt-level Shallow Lock-in prevention — periodically reference original task in long reasoning chains
2. **MEDIUM**: For self-hosted models, implement I_T/I_S monitoring as reasoning quality signal
3. **MEDIUM**: Test whether our few-shot skill instructions (KE-065) change information flow patterns (would explain why they work)
4. **LOW**: Track agent "circling" behavior (repeated similar reasoning steps) as potential Shallow Lock-in indicator — even without weight access, behavioral signatures may correlate

---

## Open Questions

1. Can prompt-level techniques (periodic re-grounding, explicit back-references) achieve similar improvements to weight-level OEB?
2. Does step segmentation quality affect diagnostic accuracy? Our structured prompting may provide better segmentation than free-form CoT.
3. Are Shallow Lock-in and Deep Decay independent failure modes, or does one cause the other?
4. How does the Deep Decay pattern interact with our context window management strategies?

---
*Bob synthesis from DD-665 | 2026-04-09*
