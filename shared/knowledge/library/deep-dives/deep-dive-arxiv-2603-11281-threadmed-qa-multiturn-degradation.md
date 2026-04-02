# Deep-Dive: arXiv:2603.11281 — "ThReadMed-QA: A Multi-Turn Medical Dialogue Benchmark from Real Patient Questions"

**Authors:** Monica Munnangi, Saiph Savage (Northeastern University)
**Date:** 11 Mar 2026
**Venue:** arXiv preprint (cs.CL)
**Relevance:** ★★★★★ — Directly quantifies multi-turn conversation degradation with novel metrics (CCS, EPR) applicable to multi-agent systems

---

## TL;DR

Real patient-physician conversation threads (2,437 from r/AskDocs, 8,204 QA pairs) reveal that ALL five frontier LLMs degrade significantly across conversation turns. Wrong-answer rates roughly triple by turn 3. Most critically: a single wrong turn raises probability of subsequent wrong turn by 1.9–6.1× (Error Propagation Rate). The strongest single-turn performers (GPT-5, Claude Haiku) show the STEEPEST multi-turn declines — a fundamental tension between single-turn capability and multi-turn reliability.

---

## Key Findings

### 1. Universal Multi-Turn Degradation
- **GPT-5**: 75.2 → 59.0 by turn 2 (-16.2 points)
- **Claude Haiku**: 72.3 → 47.3 by turn 2 (-25.0 points) — "peak-and-cliff"
- **GPT-4o**: 58.2 → 50.2 by turn 2 (-8.0 points) — "stable-floor"
- **Gemini 2.5 Flash**: 51.3 → 42.6 by turn 2 (-8.7 points)
- **Llama 3.3 70B**: 47.1 → 40.1 by turn 2 (-7.0 points) — "monotonic decline"
- All degradations statistically significant (p < 0.001, Mann-Whitney U)

### 2. Single-Turn vs Multi-Turn Robustness Tradeoff
- **Inverse relationship**: Models with strongest T0 scores show steepest declines
- GPT-5 leads T0 by 17pt over GPT-4o, but gap narrows to 8.8pt by T2
- Claude Haiku starts 2nd-highest (72.3) but falls hardest (25.0pt drop)
- Multi-turn settings partially close the frontier capability gap

### 3. Error Propagation Rate (EPR) — Cascade Failures
| Model | EPR | After Correct | Amplification |
|-------|-----|--------------|---------------|
| GPT-5 | 38.6% | 6.3% | **6.1×** |
| Claude Haiku | 40.7% | 15.6% | 2.6× |
| GPT-4o | 35.1% | 8.3% | 4.2× |
| Gemini 2.5 Flash | 44.1% | 13.3% | 3.3× |
| Llama 3.3 70B | 40.9% | 22.0% | 1.9× |

**Critical insight**: GPT-5 has the highest amplification factor (6.1×). Once it goes wrong, it cascades as severely as any model despite having the lowest overall wrong rate.

### 4. Conversational Consistency Score (CCS)
- **Llama has highest CCS (63.9)** — consistent because consistently mediocre
- **Claude Haiku has lowest CCS (45.2)** — nearly 1-in-3 conversations swing between fully correct and completely wrong within same thread
- **GPT-5**: CCS 51.5, ceiling 87.6, floor 39.1 — wide swing despite best mean

### 5. Oracle-Physician Ablation (Question Difficulty vs Context Poisoning)
**Counter-intuitive result**: Replacing model's prior answers with perfect physician answers does NOT recover performance — and WORSENS it for 3/5 models:
- For GPT-5, GPT-4o, Llama: model's own prior responses serve as helpful scaffolding
- Question difficulty accounts for 86-164% of total degradation
- Only Claude Haiku shows genuine context poisoning (+3.6pt with oracle, p=0.024)
- **Primary driver of multi-turn degradation = question difficulty, not context processing failure**

### 6. Collective Failure
- Oracle ensemble of all 5 models fails on **47.4%** of QA pairs (449/948)
- GPT-5 uniquely solves 13.9% that no other model handles
- Structural gap between LLMs and physician-level multi-turn consultation not closed by model diversity

---

## Novel Metrics Introduced

### Conversational Consistency Score (CCS)
```
CCS = 1 - (1/|C|) Σ (max_t s_{c,t} - min_t s_{c,t})
```
Measures within-conversation reliability. CCS=1 means same quality every turn; CCS=0 means full range swing in every thread.

### Error Propagation Rate (EPR)
```
EPR = P(s_{t+1} = 0 | s_t = 0)
```
Probability that wrong turn is followed by wrong turn. Amplification factor = EPR / P(wrong | after correct).

---

## Connection to Multi-Agent Systems Portfolio

### Direct Relevance to Our Framework

1. **Law 3 (Degradation Gradient)**: Confirmed empirically — performance degrades as conversation depth increases, with strongest models degrading fastest (inverse capability-robustness relationship)

2. **Cascade Failure Pattern**: EPR of 1.9-6.1× directly validates our multi-agent cascade failure theory — errors propagate and compound across turns, just as they do across agents

3. **Consistency vs Capability Tradeoff**: Llama's highest CCS despite lowest capability mirrors our finding that simpler agents can be more reliable in multi-agent systems

4. **Question Difficulty as Primary Driver**: Challenges purely architectural explanations — follow-up questions are intrinsically harder because they require integrating prior context, not just because models fail at context processing

### Cross-References
- **arXiv:2603.11394** (Stop Listening to Me) — Companion paper showing multi-turn diagnostic reasoning degradation. ThReadMed-QA uses REAL patient data rather than synthetic
- **arXiv:2603.11228** (Markovian Generation Chains) — Theoretical framework for understanding why errors compound across turns
- **arXiv:2602.13255** (DPBench) — Coordination degradation in multi-agent settings follows similar patterns
- **arXiv:2603.11126** (Value Alignment CFA) — CCS metric could be adapted for measuring within-workflow consistency in multi-agent orchestration

### Implications for System Design
1. **Multi-turn medical interfaces need active degradation monitoring** — CCS and EPR should be computed in real-time
2. **Error recovery mechanisms are essential** — EPR shows errors cascade; systems need circuit-breakers
3. **Verbosity inversely correlates with multi-turn robustness** — models producing 3.7-6.2× more words than physicians are less reliable over turns
4. **Single-turn benchmarks are misleading for deployment decisions** — GPT-5 scores ~90% on MedQA but only 41.2% fully correct on real multi-turn consultations

---

## Dataset Details
- **Source**: r/AskDocs (Reddit), Jan 2015 – Jun 2023
- **Size**: 2,437 fully-answered threads, 8,204 QA pairs, up to 9 turns
- **Test split**: 238 conversations, 948 QA pairs (stratified by length)
- **Ground truth**: Verified physician responses
- **Evaluation**: LLM-as-judge (GPT-4o) with 3-point rubric (correct/partial/wrong)
- **Code/Data**: https://github.com/monicamunnangi/ThReadMed-QA

---

## Methodological Strengths
- Real patient-authored questions (not synthetic/adversarial)
- Verified physician ground truth
- Novel metrics (CCS, EPR) that surface failure modes hidden by aggregate accuracy
- Oracle ablation isolates question difficulty vs context poisoning
- Five models spanning full capability range

## Limitations
- Domain-specific (medical) — generalization to other domains unclear
- LLM-as-judge evaluation (though calibrated)
- Reddit data may not represent all patient populations
- Temperature=1 for GPT-5 (doesn't support deterministic decoding)

---

**Research Impact**: 9/10 — Introduces reusable metrics (CCS, EPR) that should become standard for multi-turn evaluation. The finding that question difficulty dominates context poisoning is a paradigm-shifting result that challenges architectural explanations of multi-turn failure.

**Filed:** 2026-03-13
**Scout ID:** deep-dive-141
