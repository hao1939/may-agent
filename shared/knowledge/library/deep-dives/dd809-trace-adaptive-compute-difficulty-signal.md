# DD#809 — TrACE: Don't Overthink It — Adaptive Compute via Agreement as Difficulty Signal

**Source:** arXiv:2604.08369 (Sethi, Apr 2026)
**Relevance:** ★★★★ for H-107 (Difficulty Threshold Moderates Overhead Harm)
**Tags:** #adaptive-compute #difficulty-detection #overhead-allocation #H-107

## TL;DR

TrACE allocates inference-time compute adaptively by measuring inter-rollout action agreement as a proxy for step-level difficulty. High agreement → easy step → commit immediately (low overhead). Low agreement → hard step → sample more rollouts (high overhead). Achieves same accuracy as fixed-budget approaches with 33-65% fewer LLM calls. Demonstrates that **overhead is harmful on easy steps and beneficial on hard steps** — a step-level analogue of H-107.

## Key Findings

### 1. Agreement as Difficulty Signal
The model's own output consistency encodes difficulty information. When multiple rollouts agree on an action, the step is easy; when they disagree, it's hard. This is validated empirically: agreement correlates with step-level success rate.

### 2. Overhead Waste on Easy Steps
Fixed-budget self-consistency (SC-4, SC-8) wastes compute on easy steps where the first sample would have been correct. TrACE-4 matches SC-4 accuracy with 33% fewer calls (GSM8K) and 39% fewer (MiniHouse). This is direct evidence that **overhead on easy tasks is pure cost with no benefit**.

### 3. Overhead Benefit on Hard Steps
On low-agreement (hard) steps, additional rollouts improve accuracy. The adaptive allocation concentrates compute where it helps. This mirrors H-107's prediction that overhead effects are difficulty-moderated.

### 4. Step-Level vs. Task-Level
TrACE operates at the **step level** within a task, not at the task level. This is finer-grained than H-107's task-level prediction. A task with 50% baseline success rate might contain a mix of easy and hard steps — the overhead harm/benefit operates per-step.

## Relevance to H-107

| H-107 Prediction | Paper Evidence | Verdict |
|---|---|---|
| Overhead harms below ~50% difficulty | Overhead on high-agreement (easy) steps is wasted cost | **Supported** (step-level) |
| Overhead helps above ~50% difficulty | Additional rollouts on low-agreement steps improve accuracy | **Supported** (step-level) |
| ~50% threshold | No specific threshold tested; uses continuous agreement metric | **Neither confirmed nor denied** |

## Key Insight for H-107 Refinement

H-107 may be better formulated at the **step level** rather than the task level. A task's aggregate difficulty (baseline success rate) is a noisy proxy for the per-step difficulty distribution within it. This could explain EXP-151's null result: task-level difficulty averaging washes out the step-level signal.

## Limitations
- Small evaluation scale (n=50 GSM8K, n=30 MiniHouse)
- Single small model (Qwen 2.5 3B)
- CPU inference (not representative of production settings)
- Step-level analysis is conceptual bridge to H-107, not direct test

## Methodological Contribution
Training-free, no external verifier needed. The difficulty signal is endogenous to the model, which is elegant but means the "difficulty" being measured is model-relative, not objective — exactly matching H-107's use of baseline success rate as the difficulty metric.
