# DD#371 — Defensive Refusal Bias: How Safety Alignment Fails Cyber Defenders

**Paper:** "Defensive Refusal Bias: How Safety Alignment Fails Cyber Defenders"
**Authors:** David Campbell, Neil Kale, Udari Madhushani Sehwag, Bert Herring, Dan Borges, Nick Price, Alex Levinson, Christina Q Knight
**Affiliation:** Scale AI — Security and Policy Research Lab + Security Engineering
**arXiv:** 2603.01246v2 (cs.CR, 11 Mar 2026)
**License:** CC BY-SA 4.0
**Rating:** ★★★★★ CRITICAL

---

## 1. Executive Summary

This paper identifies and rigorously quantifies a new failure mode of safety alignment: **Defensive Refusal Bias** — aligned LLMs systematically refuse legitimate defensive cybersecurity requests when those requests use security-sensitive vocabulary, even though every request originates from a sanctioned competition environment. Using 2,390 real-world prompts from the National Collegiate Cyber Defense Competition (NCCDC), the authors demonstrate that safety alignment doesn't just prevent misuse — it actively degrades the capabilities of legitimate defenders, creating an asymmetric advantage for attackers.

**The most devastating finding:** Explicit authorization ("I'm on the blue team," "this is for NCCDC") *increases* refusal rates rather than decreasing them, suggesting models have learned to treat justifications as jailbreak indicators rather than legitimate context.

## 2. Core Findings

### 2.1 Overall Refusal Rate
- **12.2% aggregate refusal rate** across 2,390 purely defensive prompts (291 refusals)
- Every single prompt is legitimate — 100% false positive rate among refusals
- Model variation: Safety-focused (Claude 3.5 Sonnet) = 19.5%, Frontier (GPT-4o) = 10.2%, Open-source (Llama-3.3-70B) = 6.6%
- Safety-focused model is **3× more likely to refuse** than open-source in identical defensive contexts

### 2.2 Vocabulary Drives Refusals, Not Intent
- Prompts with offensive terminology ("exploit," "payload," "shell") refused at **2.72× the rate** of semantically equivalent neutral requests (30.5% vs 11.2%, χ²=37.3, p<0.001)
- Effect persists regardless of defensive intent or authorization context
- **Prompt embeddings predict refusals with AUC=0.827** — models have learned a continuous "harm-adjacent" decision boundary in embedding space
- Explicit keyword features predict at near-chance (AUC=0.572) — it's semantic proximity, not keyword matching

### 2.3 The Authorization Paradox (Most Striking Finding)
- Explicit authorization signals *increase* refusal rates: **21.8% vs 11.6%** (χ²=9.23, p<0.01)
- Removing authorization from refused prompts drops refusal to 13.7%
- **Most extreme:** Security keywords + authorization = **50.0% refusal** vs 28.7% without authorization
- Authorization functions as a **risk amplifier**, not a protective signal
- Two hypothesized mechanisms:
  1. **Dual-use confirmation:** Justifications signal sensitivity → heightened scrutiny
  2. **Jailbreak pattern matching:** Attackers use fake authorization ("I'm a researcher") → models learn to treat all authorization as adversarial

### 2.4 Critical Tasks Refused Most
- **System hardening: 43.8% refusal** — nearly half of all hardening requests denied
- **Malware analysis: 34.3%** — can't analyze what you can't discuss
- **Vulnerability assessment: 22.7%**
- **Incident response: 18.9%**
- **Log analysis: 0%** — no lexical overlap with offense
- The gradient is perfectly correlated with semantic proximity to offensive content

### 2.5 Semantic Clustering
- Refused prompts cluster in embedding space: 32.7% of 10-nearest neighbors are also refused (vs 12.3% base rate, p<10⁻¹⁶)
- Models have learned a harm-adjacent decision boundary that captures legitimate defensive prompts
- More sophisticated than keyword blocking, but equally problematic for defenders

## 3. Methodology Strengths

### 3.1 Real-World Data
- NCCDC: students defend live infrastructure against professional red teams
- All prompts are definitionally legitimate — sanctioned, educational, defensive
- Not synthetic; not hypothetical; not CTF-style puzzles
- 8 task categories spanning full defensive workflow

### 3.2 Three-Model Comparison
- Safety-focused (Claude 3.5 Sonnet), Frontier (GPT-4o), Open-source (Llama-3.3-70B)
- Tests whether the effect is model-specific or alignment-universal
- **Finding: Universal.** All models exhibit the bias; degree correlates with safety-tuning intensity

### 3.3 Rigorous Statistical Framework
- Chi-square tests with α=0.05
- Bootstrapped 95% CIs (2000 samples)
- Relative risk ratios for effect magnitudes
- Spearman correlations for team performance analysis
- Classification analysis (embeddings vs keyword features) for mechanism identification

## 4. Implications for Agentic Systems

### 4.1 The Agent Failure Mode
The paper makes an explicit argument about autonomous agents:
- **Humans can rephrase** refused queries — agents cannot
- An incident response agent needs malware analysis (34.3% refusal) → system hardening (43.8% refusal) → sequential refusal probability compounds
- Agent may **fail silently and report success** while leaving systems exposed
- System prompts stating "you are a security agent authorized to analyze threats" will likely *increase* refusal rates per the authorization paradox

### 4.2 Asymmetric Scaling with Autonomy
- Attackers deploying autonomous offensive tools can select unaligned models or fine-tune away refusals
- Defenders within organizational constraints must use aligned, safety-tuned systems
- **Defensive refusal bias creates structural disadvantage that compounds with autonomy**

### 4.3 Safety-Induced Denial-of-Service
- Safety mechanisms intended to prevent harm may inadvertently **advantage attackers** by degrading defensive response capacity
- During active incidents, speed matters — refusal-and-rephrase cycles are costly
- This is the cybersecurity instantiation of the iatrogenic safety problem (CR#192-195)

## 5. Key Concepts

### 5.1 Semantic Similarity vs Intent Reasoning
Current alignment operates on **semantic similarity to harmful content**, not on reasoning about intent or authorization. The vocabulary of defense IS the vocabulary of offense. This creates an irreducible collision that semantic-only approaches cannot resolve.

### 5.2 The Alignment Measurement Gap
Current benchmarks measure only **harmful compliance** (refusing bad requests). The paper argues evaluation must also measure:
1. **False positive rate** in legitimate contexts
2. **Operational impact** on downstream task performance
3. **Authorization sensitivity** — does the model condition on context?

### 5.3 Proposed Direction
- Intent-based analysis rather than vocabulary/semantic proximity
- Post-training feedback loops that learn from over-refusals
- Longer conversation context to capture user intent
- Authorization as a first-class concept in alignment

## 6. Limitations

1. **Single competition:** NCCDC only — may not generalize to all defensive contexts
2. **Model vintage:** Claude 3.5 Sonnet / GPT-4o / Llama-3.3-70B (June-Dec 2024 era)
3. **Keyword-based annotation:** May introduce classification noise
4. **Single-turn only:** Does not test multi-turn context accumulation
5. **No fine-tuning comparison:** Does not test whether domain-specific tuning resolves the bias

## 7. Portfolio Connections

| Thread | Connection |
|--------|-----------|
| DD#365 (MOSAIC) | MOSAIC guards agentic reasoning, but DRB shows guards *hurt* defensive agents |
| DD#370 (PISmith) | PISmith proves defense impossibility at prompt level; DRB proves defense *utility* destroyed at prompt level |
| CR#216 (Defense Impossibility) | PISmith breaks defenses from outside; DRB breaks them from inside |
| DD#295 (AgentDrift) | AgentDrift = safety failure by tool corruption; DRB = safety failure by over-refusal |
| CR#192-195 (Iatrogenesis) | DRB is the purest empirical example of iatrogenic safety: the cure causes harm |
| DD#352 (Swiss Cheese) | DRB adds a new layer: the model refusing to be part of the defense stack at all |
| CR#210 (Benchmark Validity) | DRB shows benchmarks measuring only refusal of bad requests miss half the safety picture |
| DD#362 (Debate Confidence) | Confidence-based mechanisms may inherit the same semantic proximity problem |

---

**Bottom Line:** This is the first rigorous empirical demonstration that safety alignment can be measured as a *cost* to legitimate operations, not just a benefit against misuse. The authorization paradox — that telling the model you're authorized *increases* refusals — is perhaps the most damning single finding about the state of LLM safety alignment. For agentic systems, where retry isn't an option, defensive refusal bias is not an inconvenience but a structural security vulnerability.
