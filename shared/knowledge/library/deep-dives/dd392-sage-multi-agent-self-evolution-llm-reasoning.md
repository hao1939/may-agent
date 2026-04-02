# Deep-Dive #392: SAGE — Multi-Agent Self-Evolution for LLM Reasoning

**Paper:** arXiv:2603.15255
**Authors:** Yulin Peng, Xinxin Zhu, Chenxing Wei, Nianbo Zeng, Leilei Wang, Ying Tiffany He, F. Richard Yu
**Institutions:** Shenzhen University, Guangdong Laboratory of AI & Digital Economy, Carleton University
**Date:** 2026-03-16
**Scout Session:** 2026-03-17
**Rating:** ★★★★ HIGH
**Portfolio Coverage:** Training, Self-Evolution, Multi-Agent Coordination, Reasoning, RL

---

## 1. Problem Statement

Reinforcement learning with verifiable rewards (RLVR) improves LLM reasoning but depends on large human-labeled datasets. Self-play approaches reduce this dependency but lack explicit planning and quality control, limiting stability in long-horizon multi-step reasoning. The fundamental question: **can a multi-agent system self-evolve its reasoning capability from just 500 seed examples?**

## 2. SAGE Architecture — Four Co-Evolving Agents

SAGE instantiates four specialized agents from a **shared LLM backbone** (single model, role-conditioned):

### 2.1 Challenger Agent
- Generates new verifiable tasks from seed reference problems
- Receives composite reward: `r_c = 1/3·s_q + 1/3·r_d + 1/3·r_f`
  - `s_q`: Critic quality score (clarity, relevance, well-formedness)
  - `r_d = 1 - solver_success_rate`: difficulty reward (harder = more reward)
  - `r_f`: format compliance reward
- **Quality filtering**: only tasks with `s_q ≥ α (0.7)` and valid verifier enter dataset
- **Difficulty suppression**: for low-quality tasks (`s_q < α`), difficulty term removed to prevent rewarding hard-but-ill-posed problems

### 2.2 Planner Agent
- Converts questions into structured multi-step plans
- Composite reward: `r_p = 0.5·s_p + 0.5·r_f`
- **Plan gating**: Critic score threshold `β = 0.3`; below threshold → Solver works without plan

### 2.3 Solver Agent
- Executes plans to produce final answers
- Composite reward: `r_s = 0.2·plan_quality + 0.6·verified_correctness + 0.2·format`
- Correctness determined by **external domain verifiers** (symbolic grading for math, test execution for code)
- Co-evolves adversarially with Challenger: Solver failures → Challenger difficulty reward

### 2.4 Critic Agent
- Provides quality scores (1-10, normalized to [0,1]) for questions and plans
- Performs format compliance checking
- **NOT** used for correctness — correctness is always external verifier
- Trained with lightweight format-consistency objective

## 3. Training Mechanism

### 3.1 Task-Relative REINFORCE++
- Critic-free policy gradient with KL penalty to reference policy
- **Per-role advantage normalization**: each agent's advantages computed within its own batch statistics
- This prevents one agent's reward scale from dominating gradient updates

### 3.2 Co-Evolutionary Loop
```
Challenge Phase → Quality Filter → Dataset Expansion
         ↓
Plan-Solve Phase → Verifier-Based Correctness → Joint Gradient Update
```
- All agents updated synchronously on shared backbone using LoRA (rank 128)
- 200 training steps total, learning rate 3e-6, batch size 128

### 3.3 Self-Generated Curriculum Growth
- Seed set: ~500 examples across MATH, GSM8K, HumanEval, MBPP
- By step 250: **20,532 valid questions** (18× expansion, fully autonomous)
- Growth rate accelerates around step 120-130 (coinciding with peak performance)

## 4. Key Results

### 4.1 Performance Improvements (pass@1 accuracy)

| Model | Metric | Base | AZR | MAE | SAGE |
|-------|--------|------|-----|-----|------|
| Qwen-2.5-3B | Overall | 40.4% | 39.9% | 40.5% | **42.0%** |
| Qwen-2.5-7B | Overall | 47.6% | 49.6% | 48.3% | **50.1%** |
| Qwen-3-4B | Overall | 55.7% | 49.5% | 54.4% | **55.9%** |

**Standout gains:**
- LiveCodeBench (OOD): 17.5% → 26.4% on 7B (+8.9%)
- OlympiadBench (OOD): 28.0% → 38.7% on 7B (+10.7%)
- LiveCodeBench (OOD): 21.5% → 30.6% on Qwen-3-4B (+9.1%)

### 4.2 OOD Generalization
- Qwen-2.5-7B OOD average: 24.6% → 28.8% (+4.2%) — best across all methods
- SAGE is the **only method that doesn't degrade** any benchmark group
- AZR on Qwen-3-4B causes **catastrophic drop**: Math Avg 56.3% → 46.7%

### 4.3 Ablation Results (Qwen-2.5-3B)

| Component Removed | Overall Avg. | Key Drop |
|-------------------|-------------|----------|
| Full SAGE | 42.0% | — |
| w/o Challenger | 39.5% | LiveCodeBench 16.9% → 9.0% |
| w/o Solver | 38.2% | GSM8K -4.3%, MATH -5.8% |
| w/o Critic | 40.4% | Code Avg -4.6% |

**Key insight**: Solver is primary reasoning driver, Challenger is critical for OOD generalization, Critic is essential for code quality.

### 4.4 Training Dynamics
- **Phase 1 (steps 0-80)**: Rapid improvement, 29.1% → 65.8%
- **Phase 2 (steps 100-140)**: Peak at 69.5% — optimal difficulty-capability balance
- **Phase 3 (steps 140+)**: Gradual decline to 61.6% — **over-specialization on self-generated curriculum**
- Results reported at step ~100 (before over-specialization)

## 5. Portfolio Connections

### 5.1 Validates CR#202 (Training Signal Quality Stack)
SAGE's Critic-based quality filtering directly implements the "signal quality control" principle. The α=0.7 threshold prevents curriculum drift — exactly the mechanism CR#202 predicted would be necessary.

### 5.2 Extends DD#327 (STEVE Self-Evolution)
STEVE used experience replay for self-evolution; SAGE adds **explicit planning decomposition** and **adversarial curriculum generation**. The Challenger-Solver adversarial loop is more structured than STEVE's experience-driven approach.

### 5.3 Confirms CR#177 (Self-Improvement Triangle)
SAGE instantiates CR#177's three vertices: Evolution (Challenger), Optimization (Solver+Planner), Diagnosis (Critic). The triangle is now empirically validated with measurable ablation contributions.

### 5.4 Connects to DD#362 (Debate Dynamics)
SAGE's Challenger-Solver adversarial loop parallels debate dynamics but with **verifiable ground truth** replacing persuasion-based evaluation. This is the "verification-grounded debate" pattern — more stable than open-ended debate.

### 5.5 Warning: Over-Specialization Pattern (DD#301)
The post-step-120 decline mirrors DD#301's ChatGPT self-convergence finding. Self-generated curricula eventually lose diversity. SAGE mitigates this temporarily with quality filtering but doesn't solve it fundamentally.

### 5.6 Connects to DD#390 (BIGMAS)
Both BIGMAS and SAGE share the pattern of multiple specialized agents from a single backbone. BIGMAS uses brain-inspired graph topology; SAGE uses role-based specialization with adversarial training.

## 6. Critical Assessment

### Strengths
1. **Minimal seed requirement** — 500 examples → 20K+ self-generated, 18× expansion
2. **Consistent improvement** — never degrades any benchmark group (unlike AZR)
3. **Clean ablation** — each agent's contribution is measurable and distinct
4. **Principled quality control** — α/β thresholds prevent curriculum degradation

### Limitations
1. **Restricted to verifiable domains** — math and code only; no path to open-ended tasks
2. **Over-specialization** — performance declines after ~120 steps; diversity exhaustion
3. **Modest absolute gains** — +2.5% overall on 7B is incremental, not transformative
4. **Single backbone constraint** — all agents share parameters, limiting role specialization depth
5. **No comparison to simple baselines** — what about just training on 20K human-curated examples? The self-generation advantage isn't isolated from the data quantity advantage

### Missing Analysis
- No diversity metrics for generated questions (how different from seed set?)
- No analysis of what the Critic actually learns to filter
- No comparison with heterogeneous agent approaches (different models per role)

## 7. Predictions

**P-SAGE-1 (High confidence):** The over-specialization pattern will appear in all self-play/self-evolution systems operating beyond ~100 iterations without external diversity injection. This is a universal property, not SAGE-specific.

**P-SAGE-2 (Medium confidence):** Heterogeneous agents (different model architectures per role) will outperform SAGE's shared-backbone approach, because role specialization benefits from architectural specialization.

**P-SAGE-3 (Medium confidence):** The 500-seed minimum can be reduced to ~50 with better curriculum bootstrapping, but cannot reach zero due to the need for initial domain grounding.

## 8. Actionable Insights for P82

1. **Critic-gated quality filtering** is directly implementable: before any agent output enters shared state, a quality check with threshold rejection prevents contamination.
2. **Adversarial co-evolution** between task generators and task solvers is a viable self-improvement mechanism for our system — the evaluator agent could generate increasingly hard evaluation tasks.
3. **Over-specialization warning**: any self-improvement loop needs diversity monitoring and external data injection after ~100 cycles.
4. **Per-role advantage normalization** is important when training/evaluating multiple agents with different reward scales — prevents one agent from dominating gradient updates.

---

**Impact Assessment:** SAGE is a clean, well-executed multi-agent self-evolution framework that validates several portfolio predictions (CR#177, CR#202). The key contribution is the Challenger-Solver adversarial loop with Critic-gated quality control. However, the gains are incremental (+2.5% overall) and limited to verifiable domains. The over-specialization finding (performance drops after step 120) is potentially the most important result — it reveals a fundamental limit of self-play that applies broadly.

**Rating Justification:** ★★★★ HIGH — Clean architecture, good ablations, validates portfolio predictions, but gains are modest and domain-restricted. Not ★★★★★ because it doesn't introduce a fundamentally new principle — it's a well-engineered integration of known components (adversarial training, quality filtering, planning decomposition).
