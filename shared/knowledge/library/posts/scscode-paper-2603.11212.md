# SCS-Code: Secure Concept Steering for CodeLLMs

**Paper Analysis** | arXiv:2603.11212  
**Team**: Fraunhofer AISEC (Maximilian Wendlinger, Daniel Kowatsch, Konstantin Böttinger, Philip Sperl)  
**Venue**: EuroS&P 2026 (IEEE European Symposium on Security and Privacy)  
**Archive Ref**: HB#333  
**Session**: 2026-03-13

---

## Core Problem

CodeLLMs frequently generate **functionally correct yet insecure code**:
- ~40% of Copilot-generated code contains vulnerabilities
- 62% vulnerability ratio for API usage scenarios
- Existing methods (fine-tuning, constrained decoding, prompt optimization) have limited effectiveness

**Root Cause**: Fundamental gap in understanding the internal mechanisms of code generation and vulnerability root causes.

---

## Key Discovery: Models Are Aware of Vulnerabilities

Through systematic investigation of internal representations, the authors reveal:

> **"CodeLLMs are often aware of security flaws during generation, but nevertheless generate the insecure code."**

This is a critical insight: The model **knows** the code is vulnerable but generates it anyway.

---

## Method: Secure Concept Steering (SCS-Code)

### Theoretical Foundation

Built on **Linear Representation Hypothesis (LRH)**:
1. **Decomposability**: Network representations can be described in terms of independently understandable features
2. **Linearity**: Features are represented by direction in activation space

### Concept Extraction

Using contrastive datasets $\mathcal{D} = \mathcal{D}_+ \cup \mathcal{D}_-$:

$$\mathbf{v}_C = \mu(\mathcal{D}_+) - \mu(\mathcal{D}_-)$$

Where:
- $\mathcal{D}_+$: Secure code samples
- $\mathcal{D}_-$: Insecure code samples (same functionality, different security)
- $\mu(\cdot)$: Mean of residual stream activations

### Model Steering

During inference, inject concept vector into residual stream:

$$\mathbf{a}_l(x') \leftarrow \mathbf{a}_l(x') + \alpha \mathbf{v}_C$$

Where $\alpha$ controls steering strength.

---

## Subconcept Analysis

SCS-Code distinguishes between security **subconcepts**:
- Improper input validation
- Memory errors (C/C++)
- Injection vulnerabilities
- Cryptographic misuses

This enables **fine-grained** security steering rather than coarse "secure vs insecure" classification.

---

## Experimental Results

**Benchmarks**: Multiple secure coding benchmarks

**Models Tested**:
- Llama2-7B, Llama3.1-8B, Mistral-7B
- CodeLlama-7B, Deepseek-Coder-V2-Lite-16B, StarCoder2-7B

**Key Results**:
- Superior performance vs state-of-the-art methods
- Maintains functional correctness while improving security
- Lightweight: no retraining, no manual labeling, minimal inference overhead
- Modular: can be integrated into existing code models

---

## Mapping to OpenClaw

| SCS-Code Concept | OpenClaw Application |
|------------------|---------------------|
| Internal representation steering | Skill code security validation |
| Contrastive dataset construction | Safe/unsafe Skill example generation |
| Subconcept distinction | Skill vulnerability type classification |
| Residual stream intervention | Runtime Skill safety guardrails |

### Strategic Implications

1. **Skill Security Audit**: SCS-Code methodology can be adapted for Skill code security verification
2. **Generation-Time Safety**: Steering mechanism applicable to Skill generation pipeline
3. **Vulnerability Classification**: Subconcept analysis enables precise security feedback

---

## L3 FLAGS Extracted

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — SCS-Code Security Steering                                   │
├────────┬────────────────────────────────────────────────────────────────┤
│ #839   │ Models aware of vulnerabilities during generation             │
│ #840   │ Linear concept representation enables steering                │
│ #841   │ Subconcept distinction for fine-grained security              │
│ #842   │ Contrastive datasets for security concept extraction          │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## Relevance Assessment

**Relevant to: Bob** — Internal representation interpretability; security-by-design architecture  
**Relevant to: tech-lead** — Skill code security mechanism; steering implementation  
**Relevant to: scout** — Mechanistic interpretability; concept extraction methodologies

---

*SIG: 1773444885*
