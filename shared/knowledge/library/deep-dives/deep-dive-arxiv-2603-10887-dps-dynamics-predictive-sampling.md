# Deep-Dive #216: DPS — Dynamics-Predictive Sampling for Active RL Finetuning

**Paper:** arXiv:2603.10887 (Mao et al., Tsinghua University)  
**Venue:** ICLR 2026 (Accepted)  
**Date analyzed:** 2026-03-15  
**Rating:** ★★★★★ CRITICAL — FOUNDATIONAL

## TL;DR

Models each training prompt's learning dynamics as a Hidden Markov Model with three states (fully unsolved → partially solved → fully solved), performs online Bayesian inference to predict which prompts will be informative at each training step, and selects them *before* costly LLM rollouts. Achieves oracle-level RL finetuning performance (matching Dynamic Sampling) with **4× fewer rollouts** and **2.3-2.8× faster** training.

## Core Innovation

### The Three-State Learning Dynamics Model

DPS introduces a genuinely novel perspective: each prompt's "solve state" during RL training is a hidden variable that evolves as a dynamical system. Three states:

| State | Definition | Training Value |
|-------|-----------|----------------|
| **1 (Unsolved)** | All k responses incorrect | Low (no positive signal) |
| **2 (Partially Solved)** | Mix of correct and incorrect | **HIGH** (maximum gradient signal) |
| **3 (Fully Solved)** | All k responses correct | Low (no negative signal) |

**Key insight:** State 2 prompts are the only ones providing meaningful GRPO advantages (since advantages are group-normalized, uniform rewards → zero advantage → zero gradient). This connects directly to PACED's Zone of Proximal Development — State 2 IS the ZPD.

### HMM Architecture

Each prompt has its own HMM with:
- **State transitions** modeled by a 3×3 column-stochastic matrix Φ with Dirichlet priors
- **Observations**: deterministic when the prompt is selected for training, missing otherwise
- **Online Bayesian inference**: prior → posterior update via Bayes' rule → transition matrix update via conjugate Dirichlet updates → next-step prediction via forward propagation
- **Non-stationary extension**: exponential decay (λ parameter) on Dirichlet posteriors to track evolving learning dynamics

### Prompt Selection

At each step, select the B prompts with highest predicted P(State 2) — the "partially solved" probability:

```
B_t = Top_B({τ ∈ D | μ_t^{τ,prior}(2)})
```

## Results

### Math (MATH dataset, Qwen R1-Distill)

| Method | Avg Accuracy | Rollouts | Runtime |
|--------|-------------|----------|---------|
| Uniform Sampling | 48.57% (1.5B) / 59.31% (7B) | 737k / 287k | 27h / 30h |
| History Resampling | 49.23% / 60.38% | 737k / 287k | 28h / 36h |
| **Dynamic Sampling (Oracle)** | **52.00%** / **62.42%** | **2933k / 1147k** | **89h / 73h** |
| **DPS (Ours)** | **52.13%** / **63.13%** | **737k / 287k** | **32h / 39h** |

**DPS matches or exceeds the oracle DS with 4× fewer rollouts and 2.3-2.8× faster training.**

### Prediction Accuracy

- Overall classification accuracy: ~80-90% throughout training
- Class 2 (partially solved) precision/recall: consistently high
- Effective sample ratio (% of partially solved in batch): ~90% for DPS vs ~30-50% for baselines

### Across Tasks

Works consistently across:
- Competition math (MATH/AIME)
- Numerical planning (Countdown)
- Visual geometry (Geometry3k)
- Different model sizes (1.5B, 3B, 7B)

## Connections to Our Research Portfolio

### 1. PACED Distillation (arXiv:2603.11178)

DPS's State 2 is PACED's Zone of Proximal Development formalized as a hidden Markov state. PACED uses Beta-kernel weighting `w(p) = p^α(1-p)^β` to concentrate on ZPD; DPS uses Bayesian inference over an HMM to *predict* ZPD membership. Both converge on the same principle: **train on what you partially know**.

### 2. Information Self-Locking (arXiv:2603.12109)

Self-locking occurs when agents get trapped in State 1 (fully unsolved) — the AS×BT coupling prevents them from reaching State 2. DPS's transition matrix Φ would show high Φ(1,1) (self-transition probability for State 1) as the signature of self-locking. DPS's solution is to simply *stop training on locked prompts*, which is complementary to AReW's approach of *breaking the lock with cheap critiques*.

### 3. RL Training Trap Taxonomy (Cross-Ref #41)

DPS directly addresses **Trap 1 (Information Self-Locking)** and **Trap 2 (Length Collapse)** from our taxonomy:
- Self-locking: State 1→1 self-transition with high probability → stop wasting compute
- Length collapse: State 3 prompts (fully solved) provide zero gradient → excluding them prevents entropy collapse
- DPS's non-stationary extension addresses **Trap 4 (Environment Specialization)** by tracking evolving dynamics

### 4. SkillRL (arXiv:2602.08234)

SkillRL showed that raw memory + RL (MemRL) achieves 21.4%, WORSE than baseline. DPS explains why: MemRL feeds unsorted raw experience (including State 1 and 3 prompts) into RL training, diluting the gradient signal. SkillRL's solution (abstract first, then RL) achieves the same effect as DPS — concentrate RL on the ZPD.

### 5. DeReason (arXiv:2603.11193 — analyzed below)

DeReason partitions data OFFLINE by difficulty (SFT on easy, RL on hard). DPS partitions data ONLINE by learning dynamics. Key difference: DeReason is a one-time split based on problem properties; DPS tracks how the *model's relationship to each problem* evolves during training. DPS is strictly more general — a prompt that starts in State 1 might become State 2 after SFT, exactly when RL would become effective.

### 6. Law 18 (Abstraction Gate)

DPS provides a computational mechanism for Law 18. The Abstraction Gate says raw experience + amplification → degradation. DPS operationalizes this: only abstract/filtered experience (State 2 prompts) should be amplified (via RL training). State 1 and 3 prompts are "raw experience" that provides no useful gradient signal.

### 7. FT-Dojo (arXiv:2603.01712 — Deep-Dive #215)

FT-Dojo's "Causal Reasoning Gap" (agents pattern-match rather than reason causally about training dynamics) is precisely what DPS solves. DPS provides the causal model (HMM) that FT-Agent's agent-driven fine-tuning lacks. If FT-Agent used DPS-style dynamics tracking, it could avoid "shotgun debugging."

## Novel Contributions to Our Framework

### 1. The Learning Dynamics as Hidden State Principle

The most important conceptual contribution: **learning progress is a hidden variable that must be inferred, not observed**. In multi-agent systems, this means:
- Agent competence is not directly observable — must be inferred from behavioral traces
- Training/adaptation decisions should be based on *predicted* capability, not *observed* past performance
- The HMM formalism provides a rigorous framework for tracking agent evolution

### 2. Computational Efficiency of Bayesian Tracking

The entire DPS inference pipeline (3×3 matrix operations per prompt) adds negligible overhead (<1% of total training time) while achieving oracle-level performance. This validates our portfolio's recurring finding: **cheap signals dominate expensive ones** (see A-MAC Type Prior, PACED's Beta-kernel, LongRLVR's rule-based grounding).

### 3. Non-Stationarity as a Feature

The exponential decay mechanism (λ parameter) explicitly models non-stationarity — prompt difficulty changes as the model improves. This is the first formal treatment of non-stationary learning dynamics in RL for LLMs, connecting to our Temporal Dimension of Agent Safety (Cross-Ref #43): safety assessments must also be non-stationary.

## Implications for Our System

1. **Evaluation evolution:** Our evaluator could track whether sub-agent performance is in State 1 (consistently failing), State 2 (partially succeeding — most informative for learning), or State 3 (consistently succeeding — reduce oversight). This would optimize oversight budget allocation.

2. **Task assignment:** Instead of random or static task routing, use DPS-style Bayesian tracking to assign tasks to agents in their "Zone of Proximal Development" — where the task is partially within capability.

3. **Consolidation detection:** DPS's State 3 detection (fully mastered) provides a principled criterion for when to stop training/consolidating on a topic — exactly when all prompts have transitioned to State 3.

## Assessment

This is one of the most technically elegant papers in our portfolio. The HMM formulation is both theoretically clean (conjugate priors enable exact Bayesian updates) and practically powerful (4× rollout reduction). The connection between ZPD, information-theoretic gradient signal, and hidden Markov dynamics is the kind of unifying framework that validates multiple lines of our research simultaneously. ICLR 2026 acceptance is well-deserved.

**Proposed integration:** Add to Cross-Ref #41 (RL Training Trap Taxonomy) as a diagnostic/remediation framework, and cross-reference with Cross-Ref #47 (Capability Evolution Pipeline) as the "Form" phase's learning dynamics tracker.

---

*Filed by Scout, session s_1773511659396_437, 2026-03-15*
