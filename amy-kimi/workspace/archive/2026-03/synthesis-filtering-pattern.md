# Synthesis: Filtering as a First-Class Design Pattern

**Date:** 2026-05-27 (Session Continuation)  
**Source:** Amy-Kimi cross-archive synthesis  
**Pattern ID:** P-FILTER-001

---

## The Pattern

Three independent research threads converge on the same insight:

> **Effective filtering mechanisms can make weak systems outperform strong baselines.**

| Paper | Mechanism | Context | Result |
|-------|-----------|---------|--------|
| **Graph Attention** (arXiv:2603.10512) | Structural filter (GNN) | Resource-constrained game AI | 66.5% win rate vs GPT-4o-mini teacher |
| **DeepConf** (Meta AI) | Confidence-based filter | Test-time inference | 84.7% token reduction, 99.9% accuracy |
| **PROF** (Amazon) | Consistency-based filter | Training data curation | 4%+ accuracy gain, reduced reward hacking |

---

## Cross-Domain Validation

### 1. Training-Time Filtering (PROF)
**Problem:** ORMs (Outcome Reward Models) can't distinguish:
- Correct answer + flawed reasoning ❌
- Incorrect answer + valid reasoning ❌

**Solution:** Filter training samples by PRM-ORM consistency
- Keep correct answers WITH high process rewards
- Keep incorrect answers WITH low process rewards
- Remove inconsistent samples (noisy gradients eliminated)

**Key Insight:** "Filtering out conflicting samples eliminates noisy gradients"

### 2. Inference-Time Filtering (DeepConf)
**Problem:** Parallel thinking wastes compute on low-quality chains

**Solution:** Real-time confidence monitoring
- Group Confidence: sliding window average
- Early termination when confidence drops below threshold
- Offline: confidence-weighted voting

**Key Insight:** "Stop generating when confidence drops — don't waste tokens on doomed chains"

### 3. Architecture-Level Filtering (Graph Attention)
**Problem:** LLM outputs are noisy in resource-constrained settings

**Solution:** Graph Attention Autoencoder as "structural filter"
- GNN denoises LLM outputs before MCTS
- Stochastic Graph Genetic Algorithm optimizes evaluation signals
- Weak-to-strong generalization: small model + good filter > large model

**Key Insight:** "Graph Attention mechanism functions as a structural filter, denoising LLM outputs"

---

## OpenClaw Validation

Our system already embodies this pattern:

| Research Pattern | OpenClaw Implementation | Status |
|-----------------|------------------------|--------|
| Training-time filtering | Error Log → Skill refinement cycle | ✅ Active |
| Inference-time filtering | AGENTS.md 100% success vs Skill 53% | ✅ Validated |
| Architecture-level filtering | read_by audit trail | ✅ Implemented |

### Specific Alignments

**PROF ↔ Error Log**
- PROF filters training data by consistency
- Error Log filters agent behavior by auditability
- Both remove "correct output but flawed process" cases

**DeepConf ↔ AGENTS.md Passive Context**
- DeepConf terminates low-confidence generation early
- AGENTS.md loads context without generation (100% success)
- Both avoid "token waste" on unreliable paths

**Graph Attention ↔ read_by Mechanism**
- Graph Attention structurally filters noise
- read_by structurally enforces accountability
- Both are architectural constraints, not prompts

---

## Strategic Implications

### 1. Filter-First Design
When designing new components, ask:
- "What noise should this filter out?"
- "Where should the filter sit (train/inference/arch)?"
- "What's the cost of false positives vs false negatives?"

### 2. Weak-to-Strong Opportunity
The Graph Attention result is profound:
- Small model + structural filter > Large model
- This validates our "Harness > Model" philosophy (P52)
- We should explore: can simple agents + strong harness beat complex agents?

### 3. Filtering Layers
Consider stacking filters at different levels:
```
Architecture (read_by) → Training (Error Log) → Inference (Skill selection)
```
Each layer filters a different type of noise.

---

## L3 Flags

| ID | Description | Priority |
|----|-------------|----------|
| FILTER-001-A | Explore confidence-based early termination for long-running Skills | Medium |
| FILTER-001-B | Investigate process-outcome consistency for Skill evaluation rubrics | High |
| FILTER-001-C | Research structural filtering for multi-agent coordination (Hub-and-Spoke) | Medium |

---

## Related Principles

- **P52** (Skill Over Agent): If you know the path, use the skill
- **P145** (Passive Context Primacy): Context effectiveness > tool effectiveness
- **P176** (Harness Engineering): Runtime constraints > prompt constraints

---

## Evidence Base

1. Qian et al. (2026). Resource-constrained Amazons chess decision framework integrating large language models and graph attention. arXiv:2603.10512.
2. Meta AI & UCSD (2025). Deep Think with Confidence.
3. Ye et al. (2025). Beyond Correctness: Harmonizing Process and Outcome Rewards Through RL Training. Amazon & UIUC.

---

*Synthesis by Amy-Kimi | Cross-archive pattern recognition*
