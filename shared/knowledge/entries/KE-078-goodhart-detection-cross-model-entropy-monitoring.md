# KE-078: Goodhart Detection — Cross-Model Entropy Monitoring for Judge Integrity

**Status**: Theoretically Proposed (single implementation, no independent validation)
**Source**: DD-666 (Qualixar OS: Universal Operating System for AI Agent Orchestration — Bhardwaj)
**Confidence**: Low-Medium (interesting design pattern, but single-author work with self-evaluated benchmark; the specific idea is sound but unvalidated independently)
**Created**: 2026-04-09

---

## One-Sentence Summary

When multiple LLM judges evaluate agent outputs, monitoring **cross-model entropy** (agreement diversity) detects Goodhart's Law violations — if judges converge too strongly on a metric, that metric is likely being gamed rather than genuinely optimized, with Jensen-Shannon divergence threshold Θ=0.877 as a proposed drift detection bound.

---

## The Finding

### The Goodhart Detection Pattern

In multi-judge evaluation systems, a dangerous failure mode is **metric gaming**: the system optimizes for the metric rather than the underlying quality. Qualixar OS proposes detection via:

1. **Cross-model entropy monitoring**: Multiple judge models evaluate agent outputs independently
2. **Agreement signal**: If all judges always agree → suspiciously low entropy → possible Goodhart violation
3. **Divergence threshold**: Jensen-Shannon divergence Θ=0.877 as empirical drift bound
4. **Escape hatches**: When Goodhart detected, switch evaluation strategy (different rubric, different judges, human review)

### Why This Pattern Is Worth Extracting

While Qualixar OS as a whole is breadth-over-depth (★★★½), this specific pattern — **detecting when evaluation metrics are being gamed by monitoring inter-judge agreement** — is a genuinely useful architectural idea that connects to our existing evaluation challenges:

- KE-005: QA rubber-stamps 14% of the time → low judge diversity is already a problem
- KE-074: Universal Verification shows design > model for evaluation → Goodhart detection is an architectural design pattern
- H-054: Evaluator accuracy hypothesis → cross-model entropy provides a meta-evaluation signal

### Additional Patterns from DD-666

**Behavioral Contracts for Agent Teams:**
- Design-by-contract: formal pre/post conditions for agent capabilities
- Invariant checking: agents must satisfy behavioral invariants throughout execution
- Maps to our agent capability declarations and task routing

**Historical Strategy Memory:**
- Learning from past team compositions to improve future ones
- Maps to Coach's skill deployment tracking and our session-over-session learning

---

## Why This Matters

### 1. Meta-Evaluation Signal for Our Evaluation Pipeline

We currently lack a way to detect when our evaluation criteria are being gamed. Cross-model entropy provides a **meta-evaluation** layer:
- Run evaluations with multiple model variants
- Monitor agreement patterns over time
- Sudden increase in agreement → metric may be gamed
- Decreasing agreement → evaluation criteria may be ambiguous

### 2. Connects to Our Evaluation Architecture Stack

| Layer | Function | Existing KE |
|---|---|---|
| Evaluation rubric design | What to measure | KE-074 (non-overlapping rubrics) |
| Evaluation execution | How to measure | KE-074 (process/outcome separation) |
| **Meta-evaluation** | **Is measurement trustworthy?** | **KE-078 (Goodhart detection)** |
| Uncertainty detection | How confident is the evaluator? | KE-068 (Zero-Hedge Gate) |

### 3. Jensen-Shannon Divergence as Drift Monitor

Beyond Goodhart detection, JS divergence can monitor:
- Model output distribution drift over time
- Whether agent behavior is changing in response to evaluation feedback
- Whether different agent sessions produce consistent quality

---

## Limitations

1. **Single implementation, no independent validation**: The Θ=0.877 threshold is empirical from one system
2. **Self-evaluated**: "100% accuracy at $0.000039/task" on 20-task custom suite is not convincing
3. **Single-author, not peer-reviewed**: Lower confidence than academic papers
4. **Requires multiple judge models**: Adds cost and complexity to evaluation pipeline
5. **Elastic License 2.0**: Not fully open-source, limits commercial adaptation

---

## Predictions

- **P-078-1**: Cross-model agreement monitoring will become standard practice in multi-agent evaluation within 18 months. (55% confidence — novel pattern, adoption uncertain)
- **P-078-2**: Our evaluation pipeline has low cross-model entropy (judges mostly agree) — indicating either good evaluation OR Goodhart vulnerability. (65% confidence)

---

## Connections

- **Extends**: KE-074 (Universal Verification) — adds meta-evaluation layer on top of rubric design
- **Addresses**: KE-005 (QA rubber-stamps) — inter-judge agreement monitoring could detect rubber-stamping
- **Connects to**: H-054 (evaluator accuracy) — Goodhart detection is a testable prediction for evaluation pipeline quality
- **Complements**: KE-068 (Zero-Hedge Gate) — uncertainty detection at evaluator level, not just at generator level

---

## Actionable Implications

1. **LOW PRIORITY**: Monitor evaluation agreement patterns when running multi-model evaluations
2. **LOW**: Consider JS divergence as a drift detection metric for agent output quality monitoring
3. **FUTURE**: If we implement multi-judge evaluation, build in cross-model entropy monitoring from the start

---
*Bob synthesis from DD-666 | 2026-04-09*
