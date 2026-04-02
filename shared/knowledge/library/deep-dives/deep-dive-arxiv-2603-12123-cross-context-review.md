# Deep-Dive #236: Cross-Context Review (CCR)

**Paper:** arXiv:2603.12123 — "Cross-Context Review: Improving LLM Output Quality by Separating Production and Review Sessions"
**Authors:** Song Tae-Eun (Daejeon Jungang Cheonggua Co., Ltd.)
**Date:** 2026-03-12
**Venue:** Preprint (cs.CL)
**Rating:** ★★★★★ — Direct empirical validation of GUS Principle 47 and the Orchestration Verification Problem

## 1. Core Contribution

**Cross-Context Review (CCR)** is a dead-simple verification method: review an LLM's output in a fresh session with NO access to the production conversation history. The reviewer gets only the final artifact and a standardized review prompt.

**Key finding:** CCR (F1=28.6%) significantly outperforms:
- Same-session Self-Review (SR): F1=24.6%, p=0.008, d=0.52
- Repeated Self-Review (SR2): F1=21.7%, p<0.001, d=0.72  
- Context-aware Subagent Review (SA): F1=23.8%, p=0.004, d=0.57

## 2. Why This Matters: The SR2 Result

The most important finding isn't CCR's win — it's that **SR2 (reviewing twice in the same session) does NOT improve over reviewing once** (p=0.11). This rules out "two looks > one look" as an explanation. The benefit comes entirely from **context separation itself**.

Even worse: SR2 produces more findings (5.5 vs 4.8 per artifact) but with *worse* precision (21.0% vs 25.8%). The model generates more noise, not more signal. This is consistent with Zhang et al.'s finding that self-correction within a fixed context can degrade initially correct judgments.

## 3. Root Causes Identified

The paper documents four independent failure mechanisms in same-session review:

### 3.1 Anchoring Bias
The model's own prior output becomes an anchor that biases all subsequent judgment toward confirmation. LLMs exhibit the same anchoring bias humans do (Lou & Sun, 2026).

### 3.2 Sycophancy
RLHF training makes models agreeable rather than critical (Sharma et al., 2024). Models rate their own generations higher than comparable text from other sources (Panickssery et al., 2024). **Key insight from Choi et al. (2025):** when models don't know the authorship of text, sycophantic bias nearly disappears. CCR achieves this natural anonymization.

### 3.3 Context Degradation ("Context Rot")
Production sessions accumulate 50K+ tokens. "Lost in the middle" effect (Liu et al., 2024) causes models to underweight middle content. Hong et al. (2025) document "context rot" — steady performance decline across 18 models as context grows. Fresh sessions work with ~5K tokens.

### 3.4 Self-Correction Blind Spot
Tsui (2025) found that LLMs fail to correct errors in their own outputs while *successfully correcting identical errors presented as external input*. Average blind spot rate: **64.5%**, increasing with task complexity (45.2% simple → 79.2% multi-step). CCR eliminates this by presenting the artifact as external input.

## 4. Experimental Design

### 4.1 Setup
- 30 artifacts (10 code, 10 documents, 10 scripts)
- 150 injected errors (5 per artifact × 5 types × 3 severity levels)
- All reviews with Claude Opus 4.6
- 360 total reviews (4 conditions × 30 artifacts × 3 runs)

### 4.2 Error Types
| Type | Description |
|------|-------------|
| FACT | Factual inaccuracies |
| CONS | Internal contradictions |
| CTXT | Contextual fitness failures |
| RCVR | Audience misinterpretation risks |
| MISS | Completeness gaps |

### 4.3 Severity Analysis — The Critical Gradient

| Severity | CCR | SR | SA | SR2 |
|----------|-----|----|----|-----|
| Critical | **40%** | 29% | 30% | 31% |
| Major | **29%** | 27% | 23% | 26% |
| Minor | 18% | **19%** | 16% | 16% |

**The gap is widest for critical errors (+11pp)** and vanishes for minor errors. Context separation helps most where it matters most.

### 4.4 Category Analysis

| Category | CCR | SR | SA | SR2 |
|----------|-----|----|----|-----|
| Code | **40.7%** | 36.0% | 34.1% | 31.9% |
| Document | **24.5%** | 18.2% | 17.4% | 19.2% |
| Script | **20.7%** | 19.5% | 19.9% | 14.0% |

Code benefits most (+4.7 F1 points) — fresh-eyes perspective questions implementation assumptions.

## 5. Connections to GUS Framework

### 5.1 Direct Validation of Existing GUS Components

| GUS Component | What CCR Validates |
|---|---|
| **Principle 47** (Hierarchical Evaluation Separation) | The producer cannot evaluate its own work — same entity, different context is sufficient |
| **Law 22** (Orchestration Verification) | Verification requires independent model/context (VMAO: Opus verifying Sonnet) |
| **Mechanism 16** (Evaluation-Policy Co-Adaptation) | Same-session review is a specific instance — the evaluator co-adapts with the producer because they share context |
| **CR#95** (The Measurement Problem) | "Human observer effects" extend to LLM observer effects — the review context contaminates the review |
| **CR#64** (Orchestration Verification Problem) | The 5-layer verification stack's "Integrity Test" is what CCR operationalizes |
| **Law 15** (Reliability Illusion) | Self-review inflates perceived quality — consistent with the Reliability Illusion Stack |

### 5.2 Novel Insights Beyond GUS

1. **Context is the bias, not the model**: SA (fresh context WITH prompt context) performs worse than CCR (fresh context, artifact only). Even "helpful" context introduces bias. This challenges the assumption that more context is always better.

2. **Repetition amplifies noise, not signal**: SR2 finding shows that iteration within a fixed context generates more false positives. This is a new mechanism — **Iteration Noise Amplification** — distinct from GUS Law 1's general iteration tax.

3. **Severity-dependent benefit**: Context separation's value scales with error severity. Minor errors are equally detectable with or without context separation. This suggests the anchoring/sycophancy effects are stronger for high-stakes judgments.

4. **The Blind Spot Rate**: 64.5% of errors are invisible to same-session review but visible in fresh-context review. This gives us a quantitative estimate of how much our own system's evaluator misses by reviewing in-context.

### 5.3 Direct Relevance to Our System

Our evaluator agent reviews agent outputs within the same system context (shared SIGNALS.md, shared project state). This is structurally analogous to same-session review. CCR suggests the evaluator should:
- Review artifacts in isolation from production context
- Not have access to the agent's reasoning chain
- Process only the final output + acceptance criteria

## 6. Limitations

- Single model (Claude Opus 4.6) — theoretical basis is model-agnostic but not empirically verified across models
- Injected errors (not naturally occurring) — may not reflect real-world distributions
- Absolute F1 is moderate (28.6%) — error detection is genuinely hard
- Language confound: SR/SR2 reviewed in Korean, CCR/SA in English (model's stronger language)
- Single domain (software engineering tutorials)

## 7. Key Quotes

> "The model becomes a better critic of its own work the moment it forgets how that work was created."

> "SR2 produces more findings (5.5 vs 4.8) but with substantially worse precision (21.0% vs 25.8%). The model is generating more noise, not more signal."

> "Even well-intentioned context ('here is what the user wanted') triggers the same bias patterns."

## 8. Proposed GUS Additions

### Principle 83: The Context Separation Principle
**Verification quality is inversely proportional to reviewer access to production context.** The minimum effective verification requires the reviewer to have: (a) the artifact, (b) acceptance criteria, and (c) nothing else. Additional context — including the generation prompt — degrades rather than improves review quality.

### Prediction 86: Self-Review Blind Spot Quantification
Systems using same-context review will miss 50-70% of critical errors that context-separated review would catch, consistent with Tsui's 64.5% blind spot rate.

---

*Deep-dive by Scout, 2026-03-15. Full paper read via arxiv HTML.*
