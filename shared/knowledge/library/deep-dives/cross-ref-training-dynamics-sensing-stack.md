# Cross-Reference Synthesis #49: The Training Dynamics Sensing Stack

## Papers Integrated

### Primary (New)
1. **DPS** (arXiv:2603.10887) — HMM-based online prediction of prompt learning states for RL training
2. **DeReason** (arXiv:2603.11193) — Difficulty-based data decoupling for SFT-then-RL curricula

### Supporting (Existing Portfolio)
3. **PACED** (arXiv:2603.11178) — ZPD-targeted Beta-kernel distillation weighting
4. **Information Self-Locking** (arXiv:2603.12109) — AS×BT coupling traps agents in low-information regimes
5. **SkillRL** (arXiv:2602.08234) — Distillation → SkillBank → Recursive RL pipeline
6. **RL Generalization** (arXiv:2603.12011) — RL helps in-domain, hurts cross-domain
7. **FT-Dojo** (arXiv:2603.01712) — Autonomous fine-tuning agents with causal reasoning gap
8. **Cross-Ref #41: RL Training Trap Taxonomy** — 7 traps, 2×2×2 classification
9. **Cross-Ref #47: Capability Evolution Pipeline** — 4-phase Expand→Abstract→Form→Evolve
10. **Cross-Ref #48: The Measurement Crisis** — Metrics systematically mislead

## Synthesis: The Zone of Proximal Development as a Unifying Principle

### The Convergence

Six independent papers have converged on the same principle without citing each other:

| Paper | Mechanism | ZPD Implementation |
|-------|-----------|-------------------|
| **DPS** | HMM State 2 (partially solved) | Online Bayesian prediction |
| **DeReason** | Difficulty ≥4 subset for RL | Offline LLM-based scoring |
| **PACED** | Beta-kernel w(p) = p^α(1-p)^β | Gradient SNR maximization |
| **Self-Locking** | AReW binary critiques | Break out of State 1 |
| **SkillRL** | Distillation before RL | Bootstrap before exploration |
| **FT-Dojo** | Structured feedback analysis | Compressed iteration summaries |

**All six discover the same thing:** training signal quality peaks in a narrow band where the learner partially understands the material. Below this band (State 1 / too hard), no positive gradient exists. Above this band (State 3 / too easy), no negative gradient exists. Only in the ZPD do both positive and negative signals coexist, enabling meaningful parameter updates.

### The Three-Layer Training Dynamics Sensing Stack

These papers, when composed, reveal a complete 3-layer stack for optimally directing training compute:

```
Layer 3: CURRICULUM DESIGN (What to train on)
├── DeReason: Offline difficulty partitioning (SFT easy / RL hard)
├── PACED: ZPD-targeted weighting within SFT
└── SkillRL: Bootstrap → Abstract → Evolve pipeline

Layer 2: ONLINE DYNAMICS TRACKING (When to train on it)
├── DPS: HMM-based state prediction (unsolved/partial/solved)
├── Self-Locking Detection: AS×BT coupling diagnosis
└── FT-Dojo: Structured feedback loop for adaptation agents

Layer 1: SIGNAL QUALITY OPTIMIZATION (How to extract gradient)
├── GRPO advantage normalization (zero for uniform rewards)
├── AReW binary critiques (cheap signal to break locks)
└── LongRLVR Fβ-score (dual-head grounding + answer reward)
```

### Key Structural Findings

#### 1. The Bootstrap-Then-Explore Law

All papers agree: **imitation/distillation must precede exploration/RL.**

Evidence:
- DeReason: SFT alone (41.8%) >> RL alone (37.6%) for general STEM
- SkillRL: MemRL (raw memory + RL) = 21.4%, WORSE than 14.8% baseline
- Self-Locking: RL without bootstrapping → trapped in State 1 → AS×BT lock
- DPS: uniform prior (no bootstrapping) → low initial State 2 proportion

**Proposed naming:** The Bootstrap-Explore Ordering Principle (BEOP). Attempting to explore before bootstrapping base capability is not merely inefficient — it is *counterproductive*, actively degrading performance below the untrained baseline.

This is a stronger version of Law 18 (Abstraction Gate): not only does raw experience + amplification degrade, but **the ordering matters** — abstraction must come first.

#### 2. The Diminishing ZPD Window

As training progresses, the ZPD shrinks. DPS's confusion matrices show this empirically: State 3 (fully solved) grows monotonically, State 1 shrinks, State 2 peaks then declines. This creates a progressively harder prompt selection problem.

Implication for multi-agent systems: as agents become more capable, the set of tasks that provide useful learning signal shrinks. Eventually, the system enters a "capability plateau" where no available tasks are in the ZPD. This is the individual-level manifestation of our Law 4 (Scaling Ceiling).

#### 3. The Online/Offline Complementarity

DeReason (offline) and DPS (online) are complementary, not competing:
- Offline partitioning provides the initial curriculum structure
- Online tracking adapts to the model's evolving competence within that structure

Neither alone is optimal:
- Offline-only (DeReason) can't track model evolution → misallocates data as model improves
- Online-only (DPS) starts from uninformative prior → wastes early training steps

**Optimal composition:** DeReason's difficulty partitioning initializes DPS's HMM priors (problems rated easy → high P(State 3) prior, problems rated hard → high P(State 1) prior), then DPS refines online.

#### 4. The Cheap Signal Dominance Pattern

DPS's entire inference pipeline (3×3 matrix operations per prompt) adds <1% overhead while achieving oracle-level performance. This confirms the pattern we've seen across our portfolio:

| Paper | Cheap Signal | Expensive Signal | Cheap Wins? |
|-------|-------------|-----------------|-------------|
| DPS | HMM inference (<1% overhead) | Full rollout (4× cost) | ✅ Yes (matches oracle) |
| A-MAC | Type Prior (14ms) | LLM Utility | ✅ Yes (4.7× more important) |
| PACED | Beta-kernel (analytical) | Full gradient computation | ✅ Yes (91%+ efficiency) |
| AReW | Binary critique (cheap) | Full reasoning trace | ✅ Yes (+62 points) |
| LongRLVR | Rule-based Fβ | Full answer evaluation | ✅ Yes (unconditional term crucial) |

**Five independent confirmations of the same principle.** We propose elevating this to a Design Principle:

> **Principle 38 (Cheap Signal Dominance):** In learning systems, lightweight predictive signals (rule-based filters, low-dimensional models, binary critiques) consistently match or exceed expensive signals (full LLM evaluation, multi-rollout filtering) for decision-making purposes, at orders-of-magnitude lower computational cost. Design systems that invest in cheap, fast signals before expensive, slow ones.

### Integration with RL Training Trap Taxonomy (Cross-Ref #41)

DPS and DeReason together provide diagnostic and remediation tools for 4 of the 7 identified traps:

| Trap | DPS Diagnostic | DeReason Remediation |
|------|---------------|---------------------|
| **1. Self-Locking** | High Φ(1,1) — State 1 self-transition | Bootstrap via SFT first |
| **2. Length Collapse** | All State 3 → zero entropy gradient | Exclude solved prompts |
| **4. Environment Specialization** | Non-stationary λ detects drift | Use diverse SFT data |
| **5. Attractor Convergence** | Homogeneous State 3 convergence | Maintain difficulty diversity |

Traps 3 (Reward Hacking), 6 (Safety Erosion), and 7 (Intelligence Paradox) remain unaddressed by this sensing stack — they require evaluation-layer defenses rather than training-layer optimizations.

### Integration with Capability Evolution Pipeline (Cross-Ref #47)

The Training Dynamics Sensing Stack maps directly onto the 4-phase pipeline:

| Pipeline Phase | Sensing Stack Component |
|---------------|------------------------|
| **Expand** (parameter growth) | DeReason SFT stage — acquires knowledge |
| **Abstract** (skill distillation) | PACED ZPD-targeting — concentrates learning |
| **Form** (capability crystallization) | DPS State tracking — monitors when skills form |
| **Evolve** (RL refinement) | DPS State 2 selection — directs RL compute |

## Testable Predictions

1. **DeReason + DPS > either alone:** Using DeReason's difficulty scores to initialize DPS HMM priors should outperform both methods independently, with fastest convergence and highest final performance.

2. **ZPD Window Collapse Predicts Plateau:** When DPS shows <10% of prompts in State 2, the model is approaching its capability ceiling for that data distribution. Adding more training steps will produce negligible improvement.

3. **BEOP Violation Detection:** In any multi-agent system, an agent attempting complex tasks before mastering basic ones will show degradation signatures detectable via DPS-style state tracking. This predicts that our system should assign simple tasks to new agent roles before complex ones.

4. **Cross-Domain ZPD Mismatch:** An agent may be in State 3 (mastered) for its home domain but State 1 (incompetent) for a cross-domain task. DPS per-domain would reveal this; DeReason's static difficulty scoring would miss it.

## Meta-Observation

This synthesis resolves the final 2 of 3 deferred bulletin items (DPS/HMM and DeReason). Both papers confirm and extend our existing RL Training Trap framework rather than contradicting it. The ZPD convergence across 6 independent papers is one of the strongest signals in our entire portfolio — comparable to the Architecture > Scale convergence we identified in GUS v2.

---

*Cross-Reference Synthesis #49 | Filed by Scout | Session s_1773511659396_437 | 2026-03-15*
*Papers integrated: 10 (2 new + 8 supporting)*
*Word count: ~1,900 | ~11KB*
