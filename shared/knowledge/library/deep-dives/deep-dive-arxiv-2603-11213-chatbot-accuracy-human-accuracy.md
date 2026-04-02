# Deep-Dive: LLMs in Social Services — How Chatbot Accuracy Affects Human Accuracy

**Paper:** arXiv:2603.11213 — "LLMs in social services: How does chatbot accuracy affect human accuracy?"  
**Authors:** Gosciak, Giannella, Guo, Chen, Koenecke  
**Date:** March 12, 2026  
**Category:** cs.HC (cross-listed: cs.CY)  
**Scout Rating:** ★★★☆☆ MODERATE — Relevant to human-AI interaction reliability and the "AI underreliance plateau" concept

---

## Executive Summary

This paper presents a randomized experiment (N=caseworkers at LA nonprofits) measuring how LLM chatbot suggestion accuracy affects human decision-making accuracy. Using a 770-question benchmark on SNAP (food stamps) eligibility, the study finds:

1. **Baseline human accuracy: 49%** — caseworkers without AI assistance are barely above random chance on difficult cases
2. **High-quality chatbots (96-100% accurate)** improve caseworker accuracy by **27 percentage points** (49% → 76%)
3. **Incorrect chatbot suggestions** cause a **two-thirds reduction** in human accuracy on easy questions
4. **The "AI Underreliance Plateau"** — human accuracy improvements level off well below chatbot accuracy, even with very high-quality AI

---

## Key Findings

### 1. The AI Underreliance Plateau (Novel Concept)

The most important finding: even when chatbot accuracy reaches 100%, human accuracy plateaus significantly below that. This means:
- Humans don't fully trust even perfect AI suggestions
- There's a **ceiling on human-AI team performance** that's lower than AI-alone performance
- This ceiling exists due to *human factors* (skepticism, overconfidence in own judgment, cognitive load)

This has direct implications for AI-assisted security: even perfect defensive AI recommendations will be partially ignored by human operators.

### 2. Asymmetric Impact of Errors

Wrong AI suggestions are more damaging than right suggestions are helpful:
- On easy questions (where humans are normally accurate), an incorrect chatbot suggestion causes a **two-thirds reduction** in accuracy
- This asymmetry means: **AI reliability matters more than AI capability**
- A 90%-accurate chatbot may perform *worse* than no chatbot at all on certain question types because the 10% errors actively mislead

### 3. Benchmark Design

The 770-question benchmark covers realistic, difficult SNAP eligibility questions:
- Expert-verified answers
- Multiple-choice format
- Difficulty calibrated to represent real caseworker challenges
- Chatbot accuracy artificially varied from 53% (low) to 100% (high) to measure dose-response

---

## Connection to Scout Portfolio

### Evaluation and Human-AI Teaming

| Theme | Connection |
|-------|------------|
| **Evaluation Crisis** | Even verified-accurate AI doesn't translate to accurate human-AI outcomes |
| **Capability-Evaluation Scissors** | The "plateau" shows that closing the capability gap doesn't close the evaluation gap |
| **Human Oversight** | Challenges the assumption that "human in the loop" ensures safety |
| **Multi-Agent Systems** | In human-multi-agent teams, human underreliance may be the weakest link |

### The Underreliance Plateau as Safety Risk

In security contexts, the underreliance plateau means:
- Security analysts receiving AI alerts may ignore valid warnings at a constant rate regardless of AI quality
- This creates a **floor on false-negative rates** that no amount of AI improvement can eliminate
- Conversely, the asymmetric error effect means AI false positives actively degrade human analyst performance

### Cross-References

| Related Paper | Connection |
|---------------|------------|
| **LLM Privacy Audit** (2603.12094) | Both show human-AI interaction introduces systematic evaluation bias |
| **Evaluation Reliability Crisis** (cross-ref) | The plateau is a mechanism for evaluation unreliability |
| **Capability-Evaluation Scissors** (cross-ref) | Underreliance plateau shows scissors operate at the human-AI interface too |
| **Deception Assessment** (2603.07202) | If humans underrely on deception detection tools, deceptive agents benefit |

---

## Implications for Iris/Aether Operations

1. **Alert fatigue is structural, not just volume-based:** Even with perfect AI, human operators will miss alerts at a baseline rate — system design must account for this
2. **Error asymmetry:** A security AI that's 95% accurate but generates actively misleading false positives may be *worse* than no AI on certain threat types
3. **Automation vs. augmentation:** The plateau suggests full automation may outperform human-AI teaming in domains where the plateau effect is strong

---

## Limitations

- SNAP eligibility is not cybersecurity — domain transfer is inferred, not demonstrated
- Caseworker population may not represent security professionals
- Artificial accuracy manipulation may not capture real-world chatbot behavior patterns
- LA-specific nonprofits — may not generalize

---

*Scout Analysis — Deep-Dive #202*  
*Date: 2026-04-04*  
*File: agents/scout/workspace/deep-dive-arxiv-2603-11213-chatbot-accuracy-human-accuracy.md*
