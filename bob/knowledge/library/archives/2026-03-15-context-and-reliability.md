## Synthesis: Context Stability & Reliability (LongRLVR + JRH)

**Date**: 2026-03-15
**Sources**: 
- **LongRLVR** (arXiv:2603.02146): "Outcome-based rewards cause vanishing gradients for grounding. You must reward the *process* of finding context."
- **JRH** (arXiv:2603.05399): "Judges are unreliable. Formatting changes cause score flips. Agentic evaluations expose different failure modes than QA."
**Related Principles**: P11 (File System as Memory), P69 (External Grounding), P59 (Trust with Verification)

## 1. The Context-Reliability Link
Both papers converge on a single truth: **Model performance is fragile without explicit structural support.**
- **LongRLVR**: Models fail to learn "grounding" (finding the right file) if you only reward the final answer. They guess based on parametric memory (hallucination).
- **JRH**: Judges fail to evaluate reliably if the format changes. They are sensitive to whitespace and phrasing.

## 2. The Solution: Harness Engineering
We cannot fix the models (we don't train them). We must fix the **Harness**.

### A. Context Grounding (LongRLVR → P159)
We need a "Context Usage Score" to verify agents actually read the right files.
- **Current**: We check if the answer is right.
- **Problem**: Agent guesses correctly -> We reward it -> Agent learns to guess -> Context changes -> Agent fails.
- **Fix**: **Measure the Read.** Did the agent `read(AGENTS.md)`? Did it `read(relevant_file)`?
- **Mechanism**: `delegation-metrics` must track `context_usage` (Recall of relevant files).

### B. Judge Stability (JRH → P156)
We cannot trust a single evaluation score.
- **Problem**: Evaluator gives a 5/5. Is it good, or did we just hit a lucky format?
- **Fix**: **Stochastic Stability Check.**
- **Mechanism**: For high-stakes evaluations, run the judge 3 times with slight formatting perturbations (whitespace, order). If scores variance > 10%, flag as **UNSTABLE**.

## 3. Proposed Principles

### 159. Grounding is Verifiable (Context Usage) (P159) [LongRLVR]
**"A correct answer derived from zero context is a hallucination that got lucky."**
Reward the process of finding truth, not just the output.
- **The Law**: Critical tasks must prove they read the source material.
- **The Metric**: `Context Recall` = (Relevant Files Read) / (Total Relevant Files).
- **The Check**: If an agent claims to fix a bug but never read the file containing it, reject the fix.

### 156. Stability Checks (The JRH Rule) (P156) [JRH]
**"A judge that flips on whitespace is not a judge, it's a random number generator."**
Evaluation requires stability.
- **The Law**: High-stakes approvals (Promotion, Policy Change) require a **Stability Check**.
- **The Mechanism**: Perturb the input (add whitespace, rephrase) and re-evaluate.
- **The Threshold**: Variance > 10% = Human Review Required.

## 4. Implementation Plan
1. **Metrics**: Update `delegation-metrics` to log `files_read` count.
2. **Evaluator**: Add `stability_check` mode to `monitor-session` (runs 3x with noise).
3. **Philosophy**: Merge P159 and P156.
