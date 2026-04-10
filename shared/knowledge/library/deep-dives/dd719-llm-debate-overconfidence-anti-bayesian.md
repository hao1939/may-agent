# DD-719: LLM Debate Overconfidence — Anti-Bayesian Confidence Escalation

**Paper**: arXiv:2505.19184 — "When Two LLMs Debate, Both Think They'll Win" (Prasad, Nguyen, May 2025)
**Rating**: ★★★★★ CRITICAL
**Added**: 2026-04-10 Session 420 (Confident Failure Literature Search)
**Relevance**: Explains the MECHANISM behind confident failures — LLMs systematically escalate confidence even when facing contradictory evidence

## Core Contribution

Definitive empirical study proving that LLMs exhibit **anti-Bayesian confidence dynamics** in multi-turn adversarial settings. Rather than moderating confidence when encountering opposing arguments, LLMs systematically increase confidence — a fundamental metacognitive deficit.

## Experimental Design

- **60 three-round policy debates** across 6 motions
- **10 frontier LLMs** (state-of-the-art at time of study)
- After each round: models privately rate win confidence 0-100
- Private scratchpad reasoning captured for analysis
- Zero-sum structure controls for task uncertainty

## Five Findings

### 1. Systematic Overconfidence
- Average initial confidence: **72.9%** vs rational 50% baseline
- Before seeing ANY opponent argument, models already believe they're winning
- Overconfidence is the default state, not a response to interaction

### 2. Anti-Bayesian Confidence Escalation
- Confidence INCREASES from 72.9% → 83.3% across debate rounds
- **This is the opposite of rational behavior** — encountering opposing evidence should moderate extreme confidence
- The model becomes MORE confident it's right as it sees more arguments against its position
- This directly explains confident failures: errors compound but confidence only goes up

### 3. Mutual High Confidence (Logical Impossibility)
- In **61.7% of debates**, BOTH sides simultaneously claim ≥75% win probability
- Combined probabilities regularly sum to >150%, sometimes >180%
- Mathematically impossible — proves systematic miscalibration, not just optimism

### 4. Self-Debate Bias
- Models debating **identical copies** still increase confidence: 64.1% → 75.2%
- Even when **explicitly told their chance was exactly 50%**, confidence rose to 57.1%
- The overconfidence is not about the opponent — it's intrinsic to the generation process

### 5. Misaligned Private Reasoning
- Models' private scratchpad thoughts sometimes **differ from stated confidence ratings**
- Raises concerns about chain-of-thought faithfulness
- Models may "know" they're uncertain but still express high confidence

## Why This Matters for Our System

### The Confident Failure Mechanism Explained

This paper provides the **mechanistic explanation** for our EXP-109 finding:

1. **Agent starts a task** with moderate-to-high confidence (default)
2. **Agent encounters difficulties** (wrong tool results, unexpected data, ambiguous requirements)
3. **Instead of moderating confidence**, the agent's confidence ESCALATES (anti-Bayesian drift)
4. **Agent completes task** reporting high confidence despite accumulated errors
5. **No warning signals** because the confidence mechanism is disconnected from actual correctness

This is NOT a failure to detect errors. It's a **fundamental property of LLM confidence dynamics**: confidence escalates under adversity rather than decreasing. The model doesn't "know" it should be less confident — its confidence generation mechanism is structurally biased toward escalation.

### Implications for Multi-Agent Verification

The mutual overconfidence finding (61.7% of debates have both sides claiming ≥75%) has critical implications for our verification strategies:

1. **Peer review between agents** may not catch confident failures — both agents may be confidently wrong
2. **Debate-based verification** (DD-700 Courtroom Style) may produce false consensus where both sides agree they're right
3. **Self-consistency checks** are undermined — the model will be consistent in its confident wrongness
4. **External ground truth** is the only reliable check — no amount of LLM-to-LLM discussion reliably reduces overconfidence

### Scratchpad Misalignment Warning

Finding #5 (private reasoning differs from stated confidence) directly threatens chain-of-thought-based monitoring:
- If we monitor the agent's stated reasoning for uncertainty markers, we may miss **internal uncertainty** that doesn't surface in text
- The agent's "thoughts" about its confidence may not reflect its actual generation dynamics
- This validates CR#328's recommendation for behavioral/trajectory monitoring over text-based monitoring

## Connection to Existing Knowledge

| Reference | Connection |
|---|---|
| DD-717 (HTC) | HTC's trajectory features could detect the confidence escalation pattern empirically |
| DD-718 (Silent Failures) | IBM's approach detects the structural anomalies; this paper explains WHY the confidence signal is unreliable |
| CR#328 Three-Layer Architecture | Layer 1 (Metacognitive Monitoring) is undermined by anti-Bayesian dynamics — need Layer 2/3 as backup |
| EXP-109 Finding #4 | This paper IS the external parallel for confident failures — the phenomenon is now well-characterized |
| DD-699 (Dual-State Architecture) | Tri-state confidence mechanism assumes confidence correlates with correctness; this paper proves it may anti-correlate |
| DD-700 (Verification Debate) | Multi-agent debate may not resolve overconfidence if BOTH agents escalate confidence |

## Key Quotes

- "Models began debates with average initial confidence of 72.9% vs. a rational 50% baseline"
- "Rather than reducing confidence as debates progressed, debaters increased their win probabilities, averaging 83% by the final round"
- "In 61.7% of debates, both sides simultaneously claimed ≥75% probability of victory, a logical impossibility"
- "Models debating identical copies increased confidence from 64.1% to 75.2%"
- "LLMs lack the ability to accurately self-assess or update their beliefs in dynamic, multi-turn tasks"

## Actionable Recommendations

1. **Tech-lead/Bob**: Do NOT rely solely on self-reported confidence scores for quality gating — they anti-correlate with actual reliability under adversity
2. **Bob**: In verification experiments, test whether multi-agent debate actually reduces confident failures (this paper predicts it won't)
3. **Design**: Consider EXTERNAL verification signals (test results, diff analysis, tool output validation) over internal confidence
4. **Scout**: Track follow-up work on de-biasing confidence in multi-turn settings; check if LACIE-style training (DD-2405.21028) can mitigate the escalation
