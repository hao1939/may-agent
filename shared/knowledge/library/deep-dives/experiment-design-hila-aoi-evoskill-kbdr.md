# Experiment Design: HILA + AOI + EvoSkill Combined Architecture

**Proposal:** Empirical validation of the Knowledge Boundary Dual Response (CR#111, Mechanism 34)
**Date:** 2026-03-15
**Status:** Experiment Design (Theoretical)
**Sources:** HILA (2603.07972), AOI (2603.03378), EvoSkill (2603.02766), CR#111

---

## 1. Motivation

CR#111 identified that HILA (open-world deferral) and AOI (closed-world failure evolution) are complementary strategies for knowledge boundary management. **No one has tested the combination.** EvoSkill adds a third strategy: skill-level evolution from failures without model weight changes. Together these three define a complete knowledge boundary response taxonomy:

| Strategy | What Changes | Timescale | Model Weights | Human Required |
|----------|-------------|-----------|--------------|----------------|
| **HILA DEFER** | Current task gets expert solution | Real-time | Updated (SFT from expert demo) | Yes |
| **AOI EVOLVE** | Training data for future tasks | Post-hoc | Updated (GRPO from failed trajectories) | No |
| **EvoSkill DISCOVER** | Skill library for future tasks | Post-hoc | Frozen | No |

**Key hypothesis:** The three strategies are complementary because they optimize different substrates:
- HILA optimizes *when to escalate* (deferral policy)
- AOI optimizes *model weights* (GRPO from failures)
- EvoSkill optimizes *external instructions* (skill documents from failures)

---

## 2. Proposed Architecture: KBDR (Knowledge Boundary Dual Response)

```
Task T arrives → Executor Agent attempts solution
   │
   ├── SUCCESS → Output + log trajectory for diversity augmentation
   │
   └── FAILURE DETECTED (score < threshold)
        │
        ├── HILA Metacognitive Policy: Should I DEFER?
        │     ├── YES → Human expert solves T
        │     │         ├── Expert demo → SFT signal (HILA outer loop)
        │     │         └── Expert demo → Evolver seed (AOI augmentation)
        │     │         └── Expert demo → Proposer input (EvoSkill failure analysis)
        │     │
        │     └── NO → Continue to failure processing
        │
        ├── AOI Evolver: Can I repair the trajectory?
        │     ├── YES → Corrected trajectory → GRPO training
        │     └── NO → Log as hard failure
        │
        └── EvoSkill Proposer: What skill would prevent this failure?
              ├── Skill proposal → Skill-Builder → validate on held-out set
              └── Retained if improves validation performance
```

**Why this works:** Each system fills the other's blind spot:
- HILA alone: never learns from failures when human isn't available
- AOI alone: can't handle truly novel problems (no trajectory to repair)
- EvoSkill alone: can't update model weights, limited to prompt-level guidance
- **Combined:** HILA escalates novel problems → expert demos become both GRPO seeds (AOI) AND failure analysis material (EvoSkill) → model weights AND skill documents improve simultaneously

---

## 3. Experiment Design

### 3.1 Controlled Comparison (6 Conditions)

| Condition | HILA | AOI | EvoSkill | Expected Rank |
|-----------|------|-----|----------|---------------|
| C1: Baseline | ✗ | ✗ | ✗ | 6th |
| C2: HILA only | ✓ | ✗ | ✗ | 4th |
| C3: AOI only | ✗ | ✓ | ✗ | 5th |
| C4: EvoSkill only | ✗ | ✗ | ✓ | 3rd |
| C5: HILA + AOI | ✓ | ✓ | ✗ | 2nd |
| C6: Full KBDR | ✓ | ✓ | ✓ | 1st |

**Prediction:** C6 > C5 > C4 > C2 > C3 > C1

**Rationale for ordering:**
- EvoSkill alone (C4) > HILA alone (C2): EvoSkill doesn't require human expert availability; its improvements are persistent
- HILA alone (C2) > AOI alone (C3): HILA gets genuinely new knowledge from humans; AOI only recombines existing knowledge
- C5 (HILA+AOI) > C4 (EvoSkill): combined weight updates + deferral should beat frozen model
- C6 (Full) > C5: adding skill-level optimization on top of weight optimization should be additive (different optimization substrates)

### 3.2 Benchmark Selection

Need a benchmark with these properties:
1. **Clear ground truth** (for EvoSkill's failure detection and AOI's trajectory scoring)
2. **Wide difficulty range** (to trigger both DEFER and EVOLVE conditions)
3. **Multi-domain** (to test skill transfer across subdomains)

**Recommended:** OfficeQA (7.3% improvement from EvoSkill alone) or SealQA (12.1% improvement from EvoSkill alone). OfficeQA is better because:
- Grounded (fixed document corpus → deterministic difficulty)
- Already benchmarked with EvoSkill
- Has difficulty levels (easy/hard) enabling controlled DEFER analysis

### 3.3 Metrics

| Metric | What it Measures |
|--------|-----------------|
| Task accuracy | End-to-end correctness |
| DEFER rate | How often HILA requests human help |
| DEFER precision | Were DEFER decisions justified? |
| Skill discovery rate | New skills/iteration (EvoSkill) |
| Skill transfer rate | % skills useful on held-out domains |
| Trajectory repair rate | % failed trajectories successfully repaired (AOI) |
| Learning efficiency | Accuracy gain per human intervention |
| Compute cost | Total API calls, tokens, wall-clock time |

### 3.4 Key Variables

**Independent:**
- Architecture condition (C1–C6)
- Training data size (5%, 10%, 15% — EvoSkill found 10% optimal)
- Base model (LLaMA3-8B for HILA, Qwen3-14B for AOI, Opus 4.5 for EvoSkill)

**Confounds to control:**
- API cost differences across conditions (budget-equalized comparison)
- Model size differences → need normalized comparison on shared backbone
- Data ordering effects (random seeds, stratified sampling)

---

## 4. Testable Predictions

### P1: Superlinearity of Combination
C6 accuracy > sum of marginal improvements from C2–C4. Expert demos improve BOTH training signal quality (AOI) AND failure diagnosis (EvoSkill).

### P2: EvoSkill as "Free Lunch"
Adding EvoSkill to any condition yields improvement with zero additional human cost. Frozen model → no training compute for weight updates.

### P3: DEFER Rate Decreases Over Time
In C6, DEFER rate decreases as AOI+EvoSkill improve the base agent. Skills and weight updates reduce the set of problems requiring human help.

### P4: Skill Discovery Amplified by Expert Demos
EvoSkill discovers higher-quality skills in C6 than C4 because expert solutions reveal HOW to fix problems, not just WHAT was wrong.

### P5: AOI and EvoSkill Fix Complementary Layers
AOI repairs execution trajectories. EvoSkill captures strategy knowledge as reusable skills. Minimal overlap in fix types.

---

## 5. Feasibility

**Compute estimate:** ~$6,450 for 3 seeds × 6 conditions on OfficeQA.
**Human simulation:** Oracle answers from benchmark ground truth for reproducibility.
**Model compatibility:** Use Qwen3-14B as shared backbone for HILA+AOI, then apply EvoSkill skills on top.
**Timeline:** ~5 weeks (implementation + baselines + combinations + analysis).

---

## 6. GUS Framework Connections

| GUS Element | What This Tests |
|-------------|-----------------|
| Law 24 (Autonomy Lifecycle) | Does KBDR extend the Ceiling phase? |
| Law 3 (Structure Over Scale) | Does KBDR beat simply scaling model? |
| Law 21 (Multi-Layer Optimization) | Weight vs skill vs policy optimization — interference? |
| Mechanism 34 (Knowledge Boundary Dual Response) | Direct test of CR#111 |
| Prediction P91 (GRPO Dominance) | Combined GRPO performance |

---

*Experiment Design | KBDR Architecture | 2026-03-15 | Scout*
